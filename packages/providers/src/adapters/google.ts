import { ProviderError, fromStatus } from '../errors';
import { b64, download, firstFrame, http, need, poll, rawFetch } from '../http';
import type { GenerationResult, ProviderAdapter, ProviderConfig, TextRequest } from '../types';
import { sseLines } from './sse';

// Google AI (Gemini API) : Gemini pour le texte, Gemini Image et Imagen pour
// l'image, Veo pour la vidéo. Une seule clé pour tout.

const base = (cfg: ProviderConfig) => (cfg.baseUrl || 'https://generativelanguage.googleapis.com/v1beta').replace(/\/$/, '');
const headers = (cfg: ProviderConfig) => ({ 'x-goog-api-key': need(cfg.apiKey, 'Clé API manquante.'), 'Content-Type': 'application/json' });

function textBody(req: TextRequest) {
  return {
    contents: req.messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
    ...(req.system ? { systemInstruction: { parts: [{ text: req.system }] } } : {}),
    generationConfig: {
      ...(req.maxTokens ? { maxOutputTokens: req.maxTokens } : {}),
      ...(req.temperature !== undefined ? { temperature: req.temperature } : {}),
      ...(req.json ? { responseMimeType: 'application/json' } : {}),
    },
  };
}

function textOf(j: any) {
  const c = j.candidates?.[0];
  if (!c && j.promptFeedback?.blockReason) throw new ProviderError('content_policy', j.promptFeedback.blockReason);
  return (c?.content?.parts ?? []).map((p: any) => p.text ?? '').join('');
}
const usageOf = (j: any) => ({ inputTokens: j.usageMetadata?.promptTokenCount, outputTokens: j.usageMetadata?.candidatesTokenCount });

export const google: ProviderAdapter = {
  meta: {
    id: 'google',
    label: 'Google AI',
    description: 'Gemini (texte), Gemini Image et Imagen (image), Veo (vidéo).',
    capabilities: ['TEXT', 'IMAGE', 'VIDEO'],
    needsApiKey: true,
    docsUrl: 'https://ai.google.dev/gemini-api/docs',
    presets: [
      { modelId: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', capability: 'TEXT', modes: ['text'], pricing: { unit: '1k_tokens', usd: 0.006 }, quality: 5, speed: 3 },
      { modelId: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', capability: 'TEXT', modes: ['text'], pricing: { unit: '1k_tokens', usd: 0.001 }, quality: 4, speed: 5 },
      { modelId: 'gemini-2.5-flash-image', label: 'Gemini 2.5 Flash Image', capability: 'IMAGE', modes: ['text-to-image', 'image-to-image'], pricing: { unit: 'image', usd: 0.039 }, quality: 4, speed: 4, aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4', '21:9'] },
      { modelId: 'imagen-4.0-generate-001', label: 'Imagen 4', capability: 'IMAGE', modes: ['text-to-image'], pricing: { unit: 'image', usd: 0.04 }, quality: 5, speed: 3, aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4'] },
      { modelId: 'veo-3.0-generate-001', label: 'Veo 3', capability: 'VIDEO', modes: ['text-to-video', 'image-to-video'], pricing: { unit: 'second', usd: 0.4 }, quality: 5, speed: 2, maxDuration: 8, aspectRatios: ['16:9', '9:16'] },
      { modelId: 'veo-3.0-fast-generate-001', label: 'Veo 3 Fast', capability: 'VIDEO', modes: ['text-to-video', 'image-to-video'], pricing: { unit: 'second', usd: 0.15 }, quality: 4, speed: 4, maxDuration: 8, aspectRatios: ['16:9', '9:16'] },
    ],
  },

  text: {
    async generate(cfg, req, ctx) {
      const j = await http(`${base(cfg)}/models/${req.model}:generateContent`, { method: 'POST', headers: headers(cfg), body: JSON.stringify(textBody(req)), timeoutMs: 300_000 }, ctx);
      return { outputs: [], text: textOf(j), usage: usageOf(j) };
    },
    async *stream(cfg, req, ctx) {
      const res = await rawFetch(`${base(cfg)}/models/${req.model}:streamGenerateContent?alt=sse`, { method: 'POST', headers: headers(cfg), body: JSON.stringify(textBody(req)), timeoutMs: 600_000 }, ctx);
      if (!res.ok) throw fromStatus(res.status, await res.text());
      let text = '';
      let usage: GenerationResult['usage'];
      for await (const data of sseLines(res)) {
        const j = JSON.parse(data);
        const d = textOf(j);
        if (d) {
          text += d;
          yield d;
        }
        if (j.usageMetadata) usage = usageOf(j);
      }
      yield { done: { outputs: [], text, usage } };
    },
  },

  image: {
    async generate(cfg, req, ctx) {
      ctx.onProgress?.(10, 'Envoi à Google');
      if (req.model.startsWith('imagen')) {
        const j = await http(
          `${base(cfg)}/models/${req.model}:predict`,
          { method: 'POST', headers: headers(cfg), body: JSON.stringify({ instances: [{ prompt: req.prompt }], parameters: { sampleCount: req.params.count ?? 1, aspectRatio: req.params.aspectRatio ?? '1:1', ...(req.negative ? { negativePrompt: req.negative } : {}) } }), timeoutMs: 300_000 },
          ctx,
        );
        const outputs = (j.predictions ?? []).filter((p: any) => p.bytesBase64Encoded).map((p: any) => ({ data: Buffer.from(p.bytesBase64Encoded, 'base64'), mimeType: p.mimeType ?? 'image/png' }));
        if (!outputs.length) throw new ProviderError('content_policy', 'Aucune image renvoyée (filtrée ?).');
        return { outputs, usage: { units: outputs.length, unit: 'image' } };
      }
      // Gemini Image : les références passent en parties inline, avant le texte.
      const parts = [...req.inputs.filter((i) => i.mimeType.startsWith('image/')).map((i) => ({ inlineData: { mimeType: i.mimeType, data: b64(i) } })), { text: req.negative ? `${req.prompt}\n\nAvoid: ${req.negative}` : req.prompt }];
      const j = await http(
        `${base(cfg)}/models/${req.model}:generateContent`,
        { method: 'POST', headers: headers(cfg), body: JSON.stringify({ contents: [{ role: 'user', parts }], generationConfig: { responseModalities: ['IMAGE'], ...(req.params.aspectRatio ? { imageConfig: { aspectRatio: req.params.aspectRatio } } : {}) } }), timeoutMs: 300_000 },
        ctx,
      );
      const outputs = (j.candidates?.[0]?.content?.parts ?? []).filter((p: any) => p.inlineData).map((p: any) => ({ data: Buffer.from(p.inlineData.data, 'base64'), mimeType: p.inlineData.mimeType }));
      if (!outputs.length) throw new ProviderError(j.candidates?.[0]?.finishReason === 'SAFETY' || j.promptFeedback ? 'content_policy' : 'upstream', 'Aucune image renvoyée.');
      return { outputs, usage: { ...usageOf(j), units: outputs.length, unit: 'image' } };
    },
  },

  video: {
    async generate(cfg, req, ctx) {
      const start = firstFrame(req.inputs);
      const last = req.inputs.find((i) => i.role === 'last_frame');
      const instance: Record<string, unknown> = { prompt: req.prompt };
      if (start) instance.image = { bytesBase64Encoded: b64(start), mimeType: start.mimeType };
      if (last) instance.lastFrame = { bytesBase64Encoded: b64(last), mimeType: last.mimeType };
      const refs = req.inputs.filter((i) => i.role === 'reference').slice(0, 3);
      if (refs.length) instance.referenceImages = refs.map((r) => ({ image: { bytesBase64Encoded: b64(r), mimeType: r.mimeType }, referenceType: 'asset' }));
      const parameters: Record<string, unknown> = { aspectRatio: req.params.aspectRatio === '9:16' ? '9:16' : '16:9' };
      if (req.negative) parameters.negativePrompt = req.negative;
      if (req.params.durationSec) parameters.durationSeconds = Math.min(8, Math.max(4, Math.round(req.params.durationSec)));
      if (req.params.seed !== undefined) parameters.seed = req.params.seed;

      const op = await http(`${base(cfg)}/models/${req.model}:predictLongRunning`, { method: 'POST', headers: headers(cfg), body: JSON.stringify({ instances: [instance], parameters }) }, ctx);
      ctx.onExternalId?.(op.name);
      const done = await poll(async () => {
        const s = await http(`${base(cfg)}/${op.name}`, { headers: headers(cfg) }, ctx);
        if (s.error) throw new ProviderError('upstream', s.error.message);
        return s.done ? { done: true as const, value: s } : { done: false as const };
      }, ctx, { intervalMs: 8000 });
      const resp = done.response?.generateVideoResponse;
      const uri = resp?.generatedSamples?.[0]?.video?.uri;
      if (!uri) throw new ProviderError(resp?.raiMediaFilteredCount ? 'content_policy' : 'upstream', resp?.raiMediaFilteredReasons?.join(' ') ?? 'Aucune vidéo renvoyée.');
      const file = await download(uri, { 'x-goog-api-key': cfg.apiKey! }, ctx);
      const seconds = (parameters.durationSeconds as number) ?? 8;
      return { outputs: [{ ...file, mimeType: 'video/mp4', durationSec: seconds }], usage: { units: seconds, unit: 'second' }, externalId: op.name };
    },
  },

  async test(cfg) {
    const j = await http(`${base(cfg)}/models?pageSize=50`, { headers: headers(cfg), timeoutMs: 15_000 });
    return { ok: true, message: `${j.models?.length ?? 0} modèles accessibles.` };
  },
};
