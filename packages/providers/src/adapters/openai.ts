import { ProviderError } from '../errors';
import { closestSize, download, firstFrame, http, need, poll, rawFetch } from '../http';
import { fromStatus } from '../errors';
import type { GenerationResult, KnownEndpoint, ModelPreset, ProviderAdapter, ProviderConfig, TextRequest } from '../types';
import { sseLines } from './sse';

// OpenAI, et par extension toute API compatible (LM Studio, vLLM, OpenRouter,
// Together…) via l'adapter "openai-compatible" qui réutilise ce code avec une
// autre URL de base.

const base = (cfg: ProviderConfig) => (cfg.baseUrl || 'https://api.openai.com/v1').replace(/\/$/, '');
const auth = (cfg: ProviderConfig, required = true): Record<string, string> => {
  const k = required ? need(cfg.apiKey, 'Clé API manquante.') : cfg.apiKey;
  return k ? { Authorization: `Bearer ${k}` } : {};
};

// Mistral refuse les champs inconnus (422) : pas de stream_options chez lui.
const NO_STREAM_OPTIONS = /(^|\.)mistral\.ai$/;

/**
 * `compat` : pour les API compatibles on envoie `max_tokens`, que tous les
 * serveurs comprennent (`max_completion_tokens` est propre à OpenAI).
 */
function chatBody(cfg: ProviderConfig, req: TextRequest, stream: boolean, compat: boolean) {
  let host = '';
  try {
    host = new URL(base(cfg)).hostname;
  } catch {}
  return {
    model: req.model,
    stream,
    ...(stream && !NO_STREAM_OPTIONS.test(host) ? { stream_options: { include_usage: true } } : {}),
    messages: [...(req.system ? [{ role: 'system', content: req.system }] : []), ...req.messages],
    ...(req.maxTokens ? (compat ? { max_tokens: req.maxTokens } : { max_completion_tokens: req.maxTokens }) : {}),
    ...(req.temperature !== undefined ? { temperature: req.temperature } : {}),
    ...(req.json ? { response_format: { type: 'json_object' } } : {}),
  };
}

export function openaiText(requireKey: boolean): NonNullable<ProviderAdapter['text']> {
  return {
    async generate(cfg, req, ctx) {
      const j = await http(`${base(cfg)}/chat/completions`, { method: 'POST', headers: { ...auth(cfg, requireKey), 'Content-Type': 'application/json' }, body: JSON.stringify(chatBody(cfg, req, false, !requireKey)), timeoutMs: 300_000 }, ctx);
      return { outputs: [], text: j.choices?.[0]?.message?.content ?? '', usage: { inputTokens: j.usage?.prompt_tokens, outputTokens: j.usage?.completion_tokens }, externalId: j.id };
    },
    async *stream(cfg, req, ctx) {
      const res = await rawFetch(`${base(cfg)}/chat/completions`, { method: 'POST', headers: { ...auth(cfg, requireKey), 'Content-Type': 'application/json' }, body: JSON.stringify(chatBody(cfg, req, true, !requireKey)), timeoutMs: 600_000 }, ctx);
      if (!res.ok) throw fromStatus(res.status, await res.text());
      let text = '';
      let usage: GenerationResult['usage'];
      for await (const data of sseLines(res)) {
        if (data === '[DONE]') break;
        const j = JSON.parse(data);
        const d = j.choices?.[0]?.delta?.content;
        if (d) {
          text += d;
          yield d;
        }
        if (j.usage) usage = { inputTokens: j.usage.prompt_tokens, outputTokens: j.usage.completion_tokens };
      }
      yield { done: { outputs: [], text, usage } };
    },
  };
}

const IMAGE_SIZES = ['1024x1024', '1536x1024', '1024x1536'];

export const openai: ProviderAdapter = {
  meta: {
    id: 'openai',
    label: 'OpenAI',
    description: 'Texte (GPT), images (gpt-image), vidéo (Sora), voix (TTS).',
    capabilities: ['TEXT', 'IMAGE', 'VIDEO', 'AUDIO'],
    needsApiKey: true,
    defaultBaseUrl: 'https://api.openai.com/v1',
    docsUrl: 'https://platform.openai.com/docs',
    presets: [
      { modelId: 'gpt-5', label: 'GPT-5', capability: 'TEXT', modes: ['text'], pricing: { unit: '1k_tokens', usd: 0.01 }, quality: 5, speed: 3 },
      { modelId: 'gpt-5-mini', label: 'GPT-5 mini', capability: 'TEXT', modes: ['text'], pricing: { unit: '1k_tokens', usd: 0.002 }, quality: 4, speed: 4 },
      { modelId: 'gpt-image-1', label: 'GPT Image 1', capability: 'IMAGE', modes: ['text-to-image', 'image-to-image'], pricing: { unit: 'image', usd: 0.07 }, quality: 5, speed: 2, aspectRatios: ['1:1', '3:2', '2:3'] },
      { modelId: 'sora-2', label: 'Sora 2', capability: 'VIDEO', modes: ['text-to-video', 'image-to-video'], pricing: { unit: 'second', usd: 0.1 }, quality: 4, speed: 2, maxDuration: 12, aspectRatios: ['16:9', '9:16'] },
      { modelId: 'sora-2-pro', label: 'Sora 2 Pro', capability: 'VIDEO', modes: ['text-to-video', 'image-to-video'], pricing: { unit: 'second', usd: 0.3 }, quality: 5, speed: 1, maxDuration: 12, aspectRatios: ['16:9', '9:16'] },
      { modelId: 'gpt-4o-mini-tts', label: 'GPT-4o mini TTS', capability: 'AUDIO', modes: ['text-to-speech'], pricing: { unit: '1k_chars', usd: 0.015 }, quality: 4, speed: 5 },
    ],
  },

  text: openaiText(true),

  image: {
    async generate(cfg, req, ctx) {
      const size = closestSize(req.params.aspectRatio, IMAGE_SIZES);
      const quality = req.params.quality === 'draft' ? 'low' : req.params.quality === 'high' ? 'high' : 'medium';
      const prompt = req.negative ? `${req.prompt}\n\nAvoid: ${req.negative}` : req.prompt;
      const refs = req.inputs.filter((i) => i.role !== 'mask');
      ctx.onProgress?.(10, 'Envoi à OpenAI');
      let j: any;
      if (refs.length) {
        // Avec références : endpoint d'édition, multipart, jusqu'à 16 images.
        const form = new FormData();
        form.set('model', req.model);
        form.set('prompt', prompt);
        form.set('size', size);
        form.set('quality', quality);
        form.set('n', String(req.params.count ?? 1));
        for (const [i, f] of refs.slice(0, 16).entries()) form.append('image[]', new Blob([new Uint8Array(f.data)], { type: f.mimeType }), f.name ?? `ref-${i}.png`);
        j = await http(`${base(cfg)}/images/edits`, { method: 'POST', headers: auth(cfg), body: form, timeoutMs: 300_000 }, ctx);
      } else {
        j = await http(`${base(cfg)}/images/generations`, { method: 'POST', headers: { ...auth(cfg), 'Content-Type': 'application/json' }, body: JSON.stringify({ model: req.model, prompt, size, quality, n: req.params.count ?? 1 }), timeoutMs: 300_000 }, ctx);
      }
      const [w, h] = size.split('x').map(Number);
      const outputs = await Promise.all(
        (j.data ?? []).map(async (d: any) => (d.b64_json ? { data: Buffer.from(d.b64_json, 'base64'), mimeType: 'image/png', width: w, height: h } : { ...(await download(d.url)), width: w, height: h })),
      );
      if (!outputs.length) throw new ProviderError('upstream', 'Aucune image renvoyée.');
      return { outputs, usage: { units: outputs.length, unit: 'image', inputTokens: j.usage?.input_tokens, outputTokens: j.usage?.output_tokens } };
    },
  },

  video: {
    async generate(cfg, req, ctx) {
      const portrait = (() => {
        const [w, h] = (req.params.aspectRatio ?? '16:9').split(':').map(Number);
        return h > w;
      })();
      const size = portrait ? '720x1280' : '1280x720';
      const allowed = [4, 8, 12];
      const seconds = allowed.reduce((b, s) => (Math.abs(s - (req.params.durationSec ?? 4)) < Math.abs(b - (req.params.durationSec ?? 4)) ? s : b), 4);
      const form = new FormData();
      form.set('model', req.model);
      form.set('prompt', req.prompt);
      form.set('size', size);
      form.set('seconds', String(seconds));
      const start = firstFrame(req.inputs);
      if (start) form.set('input_reference', new Blob([new Uint8Array(start.data)], { type: start.mimeType }), start.name ?? 'start.png');
      const job = await http(`${base(cfg)}/videos`, { method: 'POST', headers: auth(cfg), body: form }, ctx);
      ctx.onExternalId?.(job.id);
      const done = await poll(async () => {
        const s = await http(`${base(cfg)}/videos/${job.id}`, { headers: auth(cfg) }, ctx);
        if (s.status === 'completed') return { done: true as const, value: s };
        if (s.status === 'failed') throw new ProviderError(/moderation|policy/i.test(JSON.stringify(s.error)) ? 'content_policy' : 'upstream', s.error?.message);
        return { done: false as const, progress: s.progress };
      }, ctx);
      const file = await download(`${base(cfg)}/videos/${done.id}/content`, auth(cfg), ctx);
      const [w, h] = size.split('x').map(Number);
      return { outputs: [{ ...file, mimeType: 'video/mp4', width: w, height: h, durationSec: seconds }], usage: { units: seconds, unit: 'second' }, externalId: job.id };
    },
  },

  audio: {
    async generate(cfg, req, ctx) {
      if (req.mode !== 'text-to-speech') throw new ProviderError('unsupported', 'OpenAI ne fait que la synthèse vocale.');
      const res = await rawFetch(`${base(cfg)}/audio/speech`, { method: 'POST', headers: { ...auth(cfg), 'Content-Type': 'application/json' }, body: JSON.stringify({ model: req.model, input: req.prompt, voice: req.params.voiceId || 'alloy', response_format: 'mp3' }) }, ctx);
      if (!res.ok) throw fromStatus(res.status, await res.text());
      return { outputs: [{ data: Buffer.from(await res.arrayBuffer()), mimeType: 'audio/mpeg' }], usage: { units: req.prompt.length / 1000, unit: '1k_chars' } };
    },
  },

  async test(cfg) {
    const j = await http(`${base(cfg)}/models`, { headers: auth(cfg), timeoutMs: 15_000 });
    return { ok: true, message: `${j.data?.length ?? 0} modèles accessibles.` };
  },
};

// Services qui exposent une API compatible OpenAI. Les URLs changent parfois :
// en cas de doute, la note invite à vérifier dans la doc du service.
const ENDPOINTS: KnownEndpoint[] = [
  { id: 'deepinfra', label: 'DeepInfra', baseUrl: 'https://api.deepinfra.com/v1/openai', docsUrl: 'https://deepinfra.com/docs/openai_api', capabilities: ['TEXT', 'IMAGE', 'EMBEDDING'], note: 'Images (Flux, SDXL…) par /images/generations.' },
  { id: 'together', label: 'Together AI', baseUrl: 'https://api.together.xyz/v1', docsUrl: 'https://docs.together.ai/docs/openai-api-compatibility', capabilities: ['TEXT', 'IMAGE', 'EMBEDDING'], note: 'Images Flux par /images/generations.' },
  { id: 'openrouter', label: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', docsUrl: 'https://openrouter.ai/docs', capabilities: ['TEXT'], note: 'Des centaines de modèles texte derrière une seule clé.' },
  { id: 'groq', label: 'Groq', baseUrl: 'https://api.groq.com/openai/v1', docsUrl: 'https://console.groq.com/docs/openai', capabilities: ['TEXT'], note: 'Texte très rapide (Llama, Qwen, GPT-OSS…).' },
  { id: 'fireworks', label: 'Fireworks AI', baseUrl: 'https://api.fireworks.ai/inference/v1', docsUrl: 'https://docs.fireworks.ai/tools-sdks/openai-compatibility', capabilities: ['TEXT', 'EMBEDDING'], note: 'Leurs modèles d’image passent par une API propre : utilisez l’API personnalisée pour eux.' },
  { id: 'mistral', label: 'Mistral AI', baseUrl: 'https://api.mistral.ai/v1', docsUrl: 'https://docs.mistral.ai/api/', capabilities: ['TEXT', 'EMBEDDING'] },
  { id: 'deepseek', label: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', docsUrl: 'https://api-docs.deepseek.com', capabilities: ['TEXT'] },
  { id: 'xai', label: 'xAI (Grok)', baseUrl: 'https://api.x.ai/v1', docsUrl: 'https://docs.x.ai/docs', capabilities: ['TEXT'], note: 'Les images Grok passent par /images/generations mais sans choix de taille : à vérifier dans leur doc.' },
  { id: 'novita', label: 'Novita AI', baseUrl: 'https://api.novita.ai/v3/openai', docsUrl: 'https://novita.ai/docs', capabilities: ['TEXT'], note: 'URL à vérifier dans leur doc (certains comptes utilisent https://api.novita.ai/openai).' },
  { id: 'hyperbolic', label: 'Hyperbolic', baseUrl: 'https://api.hyperbolic.xyz/v1', docsUrl: 'https://docs.hyperbolic.xyz', capabilities: ['TEXT'], note: 'Leurs images passent par une API propre : utilisez l’API personnalisée pour elles.' },
  { id: 'siliconflow', label: 'SiliconFlow', baseUrl: 'https://api.siliconflow.com/v1', docsUrl: 'https://docs.siliconflow.com', capabilities: ['TEXT', 'EMBEDDING'], note: 'Depuis la Chine : https://api.siliconflow.cn/v1. Leur API d’images ne suit pas exactement le format OpenAI.' },
  { id: 'cerebras', label: 'Cerebras', baseUrl: 'https://api.cerebras.ai/v1', docsUrl: 'https://inference-docs.cerebras.ai', capabilities: ['TEXT'] },
  { id: 'nebius', label: 'Nebius AI Studio', baseUrl: 'https://api.studio.nebius.com/v1', docsUrl: 'https://docs.nebius.com/studio/inference/api', capabilities: ['TEXT', 'IMAGE', 'EMBEDDING'], note: 'URL à vérifier dans leur doc (le service a été renommé Token Factory).' },
  { id: 'perplexity', label: 'Perplexity', baseUrl: 'https://api.perplexity.ai', docsUrl: 'https://docs.perplexity.ai', capabilities: ['TEXT'], note: 'Pas de liste des modèles : ajoutez-les à la main (sonar, sonar-pro…).' },
  { id: 'moonshot', label: 'Moonshot AI (Kimi)', baseUrl: 'https://api.moonshot.ai/v1', docsUrl: 'https://platform.moonshot.ai/docs', capabilities: ['TEXT'] },
  { id: 'dashscope', label: 'Alibaba Cloud (Qwen)', baseUrl: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1', docsUrl: 'https://www.alibabacloud.com/help/en/model-studio/compatibility-of-openai-with-dashscope', capabilities: ['TEXT', 'EMBEDDING'], note: 'Région internationale ; à vérifier selon la région de votre compte.' },
  { id: 'lmstudio', label: 'LM Studio (local)', baseUrl: 'http://localhost:1234/v1', docsUrl: 'https://lmstudio.ai/docs/app/api/endpoints/openai', capabilities: ['TEXT', 'EMBEDDING'], note: 'Démarrez le serveur local dans LM Studio. Aucune clé nécessaire.' },
  { id: 'vllm', label: 'vLLM (local)', baseUrl: 'http://localhost:8000/v1', docsUrl: 'https://docs.vllm.ai/en/latest/serving/openai_compatible_server.html', capabilities: ['TEXT', 'EMBEDDING'], note: 'Clé seulement si le serveur est lancé avec --api-key.' },
  { id: 'llamacpp', label: 'llama.cpp server (local)', baseUrl: 'http://localhost:8080/v1', docsUrl: 'https://github.com/ggml-org/llama.cpp/tree/master/tools/server', capabilities: ['TEXT', 'EMBEDDING'] },
];

// Familles de modèles d'image, reconnues à l'identifiant quand le serveur ne
// dit rien de plus.
const IMAGE_ID = /(^|[\/_.:-])(flux|sdxl|sd-?xl|sd-?[1-3](\.\d)?|sd3|stable-diffusion|stablediffusion|dall-e|dalle|gpt-image|imagen|playground|recraft|ideogram|kolors|hidream|seedream|qwen-image|juggernaut|dreamshaper|kandinsky|pixart|cogview|lumina|sana|photon|midjourney|wan2?\.?\d*-t2i|hunyuan-?image)/i;
const EMBEDDING_ID = /(embed|embedding|(^|[\/_-])(bge|e5|gte|m3e)([\/_-]|$)|text-similarity)/i;
// Ni génération ni conversation : inutile de les proposer.
const SKIP_ID = /(rerank|whisper|transcri|moderation|(^|[\/_-])tts([\/_-]|$))/i;
const SKIP_TYPE = /^(rerank|moderation|audio|transcribe|transcription|speech|stt|tts)$/i;

/**
 * Classe un modèle renvoyé par GET /models. Les métadonnées l'emportent quand
 * elles existent (`type` chez Together, `architecture.output_modalities` chez
 * OpenRouter…), sinon on devine à l'identifiant.
 */
export function classifyCompatModel(m: any): ModelPreset | null {
  const id = String(m?.id ?? '');
  if (!id) return null;
  const label = String(m.display_name || m.name || id);
  const type = String(m.type ?? m.model_type ?? m.task ?? m.kind ?? '').toLowerCase();
  const out: string[] = (m.architecture?.output_modalities ?? []).map((x: unknown) => String(x).toLowerCase());
  const modality = String(m.architecture?.modality ?? m.modality ?? '').toLowerCase();
  const image = (): ModelPreset => ({ modelId: id, label, capability: 'IMAGE', modes: ['text-to-image'] });
  const embedding = (): ModelPreset => ({ modelId: id, label, capability: 'EMBEDDING', modes: ['text'] });
  const text = (): ModelPreset => ({ modelId: id, label, capability: 'TEXT', modes: ['text'] });

  if (SKIP_TYPE.test(type)) return null;
  if (/image/.test(type) && !/chat|language|text/.test(type)) return image();
  if (/embed/.test(type)) return embedding();
  if (/^(chat|language|code|text|llm|completion)/.test(type)) return text();
  // OpenRouter : un modèle qui répond texte + image passe par /chat/completions,
  // pas par /images/generations ; seul un modèle qui ne rend que des images est IMAGE.
  if (out.length) {
    if (out.includes('embeddings') || out.includes('embedding')) return embedding();
    if (out.includes('image') && !out.includes('text')) return image();
    return text();
  }
  if (modality.includes('->')) {
    const target = modality.split('->')[1];
    if (target.includes('image') && !target.includes('text')) return image();
    if (target.includes('embed')) return embedding();
    return text();
  }
  if (SKIP_ID.test(id)) return null;
  if (EMBEDDING_ID.test(id)) return embedding();
  if (IMAGE_ID.test(id)) return image();
  return text();
}

/** OpenAI-compatible : DeepInfra, Together, OpenRouter, Groq, LM Studio, vLLM… */
export const openaiCompatible: ProviderAdapter = {
  meta: {
    id: 'openai-compatible',
    label: 'API compatible OpenAI',
    description: 'La plupart des services à clé API (DeepInfra, Together, OpenRouter, Groq, Mistral…) et les serveurs locaux (LM Studio, vLLM) : /chat/completions et /images/generations.',
    capabilities: ['TEXT', 'IMAGE'],
    needsApiKey: false,
    optionalApiKey: true,
    needsBaseUrl: true,
    defaultBaseUrl: 'http://localhost:1234/v1',
    docsUrl: 'https://platform.openai.com/docs/api-reference',
    presets: [],
    endpoints: ENDPOINTS,
  },
  text: openaiText(false),
  image: {
    async generate(cfg, req, ctx) {
      const size = closestSize(req.params.aspectRatio, IMAGE_SIZES);
      // Pas de response_format : certains services (Together) ne connaissent pas
      // « b64_json ». On accepte les deux formes de réponse.
      const j = await http(`${base(cfg)}/images/generations`, { method: 'POST', headers: { ...auth(cfg, false), 'Content-Type': 'application/json' }, body: JSON.stringify({ model: req.model, prompt: req.prompt, size, n: req.params.count ?? 1 }), timeoutMs: 600_000 }, ctx);
      const outputs = await Promise.all((j.data ?? []).map(async (d: any) => (d.b64_json ? { data: Buffer.from(d.b64_json, 'base64'), mimeType: 'image/png' } : download(d.url, {}, ctx))));
      if (!outputs.length) throw new ProviderError('upstream', 'Aucune image renvoyée.');
      return { outputs, usage: { units: outputs.length, unit: 'image' } };
    },
  },
  async test(cfg) {
    const j = await http(`${base(cfg)}/models`, { headers: auth(cfg, false), timeoutMs: 10_000 });
    const list = Array.isArray(j) ? j : j.data;
    return { ok: true, message: `${list?.length ?? 0} modèles exposés.` };
  },
  async listModels(cfg) {
    const j = await http(`${base(cfg)}/models`, { headers: auth(cfg, false), timeoutMs: 15_000 });
    // Together renvoie un tableau nu, les autres { data: [...] }.
    const list: unknown[] = Array.isArray(j) ? j : (j.data ?? []);
    return list.map(classifyCompatModel).filter((m): m is ModelPreset => m !== null);
  },
};
