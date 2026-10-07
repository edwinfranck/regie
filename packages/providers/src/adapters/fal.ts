import { ProviderError } from '../errors';
import { download, http, need, poll } from '../http';
import type { GenerationResult, OutputFile, ProviderAdapter, ProviderConfig, RunContext } from '../types';
import { type MappingOptions, collectUrls, fromDataUri, imageInput, videoInput } from './mapping';

// Fal : une file d'attente commune devant des centaines de modèles — Flux,
// SDXL, Kling, Hailuo, Veo, Luma… Soumission, attente, récupération.

const QUEUE = 'https://queue.fal.run';
const headers = (cfg: ProviderConfig) => ({ Authorization: `Key ${need(cfg.apiKey, 'Clé API manquante.')}`, 'Content-Type': 'application/json' });
const opts = (cfg: ProviderConfig): MappingOptions => ({ inputMap: cfg.config.inputMap as any, extraInput: cfg.config.extraInput as any });

async function run(cfg: ProviderConfig, model: string, input: Record<string, unknown>, ctx: RunContext) {
  const base = (cfg.baseUrl || QUEUE).replace(/\/$/, '');
  const sub = await http(`${base}/${model}`, { method: 'POST', headers: headers(cfg), body: JSON.stringify(input) }, ctx);
  ctx.onExternalId?.(sub.request_id);
  const statusUrl = sub.status_url ?? `${base}/${model}/requests/${sub.request_id}/status`;
  const responseUrl = sub.response_url ?? `${base}/${model}/requests/${sub.request_id}`;
  await poll(async () => {
    const s = await http(statusUrl, { headers: headers(cfg) }, ctx);
    if (s.status === 'COMPLETED') {
      if (s.error) throw new ProviderError('upstream', String(s.error));
      return { done: true as const, value: s };
    }
    return { done: false as const, message: s.status === 'IN_QUEUE' ? `En file (position ${s.queue_position ?? '?'})` : 'En cours' };
  }, ctx);
  const out = await http(responseUrl, { headers: headers(cfg) }, ctx);
  return { out, id: sub.request_id as string };
}

async function files(out: unknown, ctx: RunContext): Promise<OutputFile[]> {
  const urls = collectUrls(out);
  if (!urls.length) throw new ProviderError('upstream', 'Réponse sans fichier.');
  return Promise.all(urls.map(async (u) => (u.startsWith('data:') ? fromDataUri(u)! : download(u, {}, ctx))));
}

export const fal: ProviderAdapter = {
  meta: {
    id: 'fal',
    label: 'Fal',
    description: 'Agrégateur : Flux, SDXL, Kling, Hailuo, Veo, Luma… via une seule clé.',
    capabilities: ['IMAGE', 'VIDEO', 'AUDIO'],
    needsApiKey: true,
    docsUrl: 'https://docs.fal.ai',
    fields: [
      { key: 'inputMap', label: 'Renommage des champs', type: 'json', placeholder: '{"image_url": "start_image_url"}', help: 'Pour un modèle dont le schéma diffère des noms usuels.' },
      { key: 'extraInput', label: 'Champs supplémentaires', type: 'json', placeholder: '{"enable_safety_checker": true}' },
    ],
    presets: [
      { modelId: 'fal-ai/flux/dev', label: 'FLUX.1 [dev]', capability: 'IMAGE', modes: ['text-to-image'], pricing: { unit: 'image', usd: 0.025 }, quality: 4, speed: 4 },
      { modelId: 'fal-ai/flux-pro/v1.1', label: 'FLUX1.1 [pro]', capability: 'IMAGE', modes: ['text-to-image'], pricing: { unit: 'image', usd: 0.04 }, quality: 5, speed: 4 },
      { modelId: 'fal-ai/fast-sdxl', label: 'SDXL (rapide)', capability: 'IMAGE', modes: ['text-to-image'], pricing: { unit: 'image', usd: 0.01 }, quality: 3, speed: 5 },
      { modelId: 'fal-ai/kling-video/v2.1/standard/image-to-video', label: 'Kling 2.1 (image → vidéo)', capability: 'VIDEO', modes: ['image-to-video'], pricing: { unit: 'second', usd: 0.05 }, quality: 4, speed: 3, maxDuration: 10 },
      { modelId: 'fal-ai/minimax/hailuo-02/standard/image-to-video', label: 'Hailuo 02 (image → vidéo)', capability: 'VIDEO', modes: ['image-to-video'], pricing: { unit: 'second', usd: 0.045 }, quality: 4, speed: 3, maxDuration: 10 },
      { modelId: 'fal-ai/veo3', label: 'Veo 3 (via Fal)', capability: 'VIDEO', modes: ['text-to-video'], pricing: { unit: 'second', usd: 0.5 }, quality: 5, speed: 2, maxDuration: 8 },
    ],
  },
  image: {
    async generate(cfg, req, ctx) {
      const { out, id } = await run(cfg, req.model, imageInput(req, opts(cfg)), ctx);
      const outputs = await files(out, ctx);
      return { outputs, externalId: id, usage: { units: outputs.length, unit: 'image' } } satisfies GenerationResult;
    },
  },
  video: {
    async generate(cfg, req, ctx) {
      const { out, id } = await run(cfg, req.model, videoInput(req, opts(cfg)), ctx);
      const outputs = await files(out, ctx);
      const seconds = req.params.durationSec ?? 5;
      return { outputs: outputs.map((o) => ({ ...o, durationSec: seconds })), externalId: id, usage: { units: seconds, unit: 'second' } };
    },
  },
  audio: {
    async generate(cfg, req, ctx) {
      const { out, id } = await run(cfg, req.model, { prompt: req.prompt, text: req.prompt, duration: req.params.durationSec, ...(cfg.config.extraInput as object) }, ctx);
      return { outputs: await files(out, ctx), externalId: id, usage: { units: 1, unit: 'request' } };
    },
  },
};
