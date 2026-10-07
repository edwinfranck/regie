import { ProviderError } from '../errors';
import { download, http, need, poll } from '../http';
import type { ProviderAdapter, ProviderConfig, RunContext } from '../types';
import { type MappingOptions, collectUrls, fromDataUri, imageInput, videoInput } from './mapping';

// Replicate : prédictions asynchrones. Un modèle "officiel" s'appelle par
// owner/name ; un modèle communautaire par owner/name:version.

const base = (cfg: ProviderConfig) => (cfg.baseUrl || 'https://api.replicate.com/v1').replace(/\/$/, '');
const headers = (cfg: ProviderConfig) => ({ Authorization: `Bearer ${need(cfg.apiKey, 'Jeton API manquant.')}`, 'Content-Type': 'application/json' });
// Replicate préfère aspect_ratio / num_outputs à image_size / num_images.
const opts = (cfg: ProviderConfig): MappingOptions => ({
  inputMap: { num_images: 'num_outputs', image_url: 'image', tail_image_url: 'end_image', ...((cfg.config.inputMap as object) ?? {}) },
  extraInput: cfg.config.extraInput as any,
});

async function predict(cfg: ProviderConfig, model: string, input: Record<string, unknown>, ctx: RunContext) {
  delete input.image_size;
  const [path, version] = model.split(':');
  const created = version
    ? await http(`${base(cfg)}/predictions`, { method: 'POST', headers: headers(cfg), body: JSON.stringify({ version, input }) }, ctx)
    : await http(`${base(cfg)}/models/${path}/predictions`, { method: 'POST', headers: headers(cfg), body: JSON.stringify({ input }) }, ctx);
  ctx.onExternalId?.(created.id);
  const done = await poll(async () => {
    const p = await http(`${base(cfg)}/predictions/${created.id}`, { headers: headers(cfg) }, ctx);
    if (p.status === 'succeeded') return { done: true as const, value: p };
    if (p.status === 'failed' || p.status === 'canceled') throw new ProviderError(/nsfw|safety/i.test(String(p.error)) ? 'content_policy' : 'upstream', String(p.error ?? p.status));
    const m = String(p.logs ?? '').match(/(\d+)%/g);
    return { done: false as const, progress: m ? Number(m[m.length - 1].replace('%', '')) : undefined };
  }, ctx);
  const urls = collectUrls(done.output);
  if (!urls.length) throw new ProviderError('upstream', 'Réponse sans fichier.');
  const outputs = await Promise.all(urls.map((u) => (u.startsWith('data:') ? fromDataUri(u)! : download(u, {}, ctx))));
  return { outputs, id: created.id as string, seconds: done.metrics?.predict_time as number | undefined };
}

export const replicate: ProviderAdapter = {
  meta: {
    id: 'replicate',
    label: 'Replicate',
    description: 'Agrégateur : Flux, SDXL, Kling, Hailuo, Veo et les modèles communautaires.',
    capabilities: ['IMAGE', 'VIDEO', 'AUDIO'],
    needsApiKey: true,
    docsUrl: 'https://replicate.com/docs',
    fields: [
      { key: 'inputMap', label: 'Renommage des champs', type: 'json', placeholder: '{"image": "start_image"}' },
      { key: 'extraInput', label: 'Champs supplémentaires', type: 'json', placeholder: '{"output_format": "png"}' },
    ],
    presets: [
      { modelId: 'black-forest-labs/flux-schnell', label: 'FLUX.1 [schnell]', capability: 'IMAGE', modes: ['text-to-image'], pricing: { unit: 'image', usd: 0.003 }, quality: 3, speed: 5 },
      { modelId: 'black-forest-labs/flux-1.1-pro', label: 'FLUX1.1 [pro]', capability: 'IMAGE', modes: ['text-to-image'], pricing: { unit: 'image', usd: 0.04 }, quality: 5, speed: 4 },
      { modelId: 'kwaivgi/kling-v2.1', label: 'Kling 2.1', capability: 'VIDEO', modes: ['image-to-video'], pricing: { unit: 'second', usd: 0.05 }, quality: 4, speed: 3, maxDuration: 10 },
      { modelId: 'minimax/hailuo-02', label: 'Hailuo 02', capability: 'VIDEO', modes: ['text-to-video', 'image-to-video'], pricing: { unit: 'second', usd: 0.045 }, quality: 4, speed: 3, maxDuration: 10 },
      { modelId: 'google/veo-3', label: 'Veo 3 (via Replicate)', capability: 'VIDEO', modes: ['text-to-video', 'image-to-video'], pricing: { unit: 'second', usd: 0.75 }, quality: 5, speed: 2, maxDuration: 8 },
    ],
  },
  image: {
    async generate(cfg, req, ctx) {
      const r = await predict(cfg, req.model, imageInput(req, opts(cfg)), ctx);
      return { outputs: r.outputs, externalId: r.id, usage: { units: r.outputs.length, unit: 'image' } };
    },
  },
  video: {
    async generate(cfg, req, ctx) {
      const input = videoInput(req, opts(cfg));
      if (input.duration) input.duration = Number(input.duration);
      const r = await predict(cfg, req.model, input, ctx);
      const seconds = req.params.durationSec ?? 5;
      return { outputs: r.outputs.map((o) => ({ ...o, durationSec: seconds })), externalId: r.id, usage: { units: seconds, unit: 'second' } };
    },
  },
  audio: {
    async generate(cfg, req, ctx) {
      const r = await predict(cfg, req.model, { prompt: req.prompt, text: req.prompt, duration: req.params.durationSec, ...((cfg.config.extraInput as object) ?? {}) }, ctx);
      return { outputs: r.outputs, externalId: r.id, usage: { units: 1, unit: 'request' } };
    },
  },
  async test(cfg) {
    const j = await http(`${base(cfg)}/account`, { headers: headers(cfg), timeoutMs: 15_000 });
    return { ok: true, message: `Compte ${j.username ?? 'valide'}.` };
  },
};
