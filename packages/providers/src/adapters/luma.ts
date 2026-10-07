import { ProviderError } from '../errors';
import { download, firstFrame, http, need, poll } from '../http';
import type { InputFile, ProviderAdapter, ProviderConfig } from '../types';

// Luma Dream Machine : Ray 2 (vidéo, images clés de début et de fin) et
// Photon (image). Luma exige des URLs publiques pour les images d'entrée :
// le stockage doit être joignable depuis Internet (R2, S3 public, tunnel).

const base = (cfg: ProviderConfig) => (cfg.baseUrl || 'https://api.lumalabs.ai/dream-machine/v1').replace(/\/$/, '');
const headers = (cfg: ProviderConfig) => ({ Authorization: `Bearer ${need(cfg.apiKey, 'Clé API manquante.')}`, 'Content-Type': 'application/json' });

function publicUrl(f: InputFile) {
  if (!f.url || /localhost|127\.0\.0\.1|minio:/.test(f.url))
    throw new ProviderError('unsupported', 'Luma a besoin d’une URL publique pour les images d’entrée : configurer un stockage joignable depuis Internet (S3_PUBLIC_URL).');
  return f.url;
}

async function run(cfg: ProviderConfig, path: string, body: object, ctx: any) {
  const g = await http(`${base(cfg)}/${path}`, { method: 'POST', headers: headers(cfg), body: JSON.stringify(body) }, ctx);
  ctx.onExternalId?.(g.id);
  return poll(async () => {
    const s = await http(`${base(cfg)}/generations/${g.id}`, { headers: headers(cfg) }, ctx);
    if (s.state === 'completed') return { done: true as const, value: s };
    if (s.state === 'failed') throw new ProviderError(/moderation|policy/i.test(s.failure_reason ?? '') ? 'content_policy' : 'upstream', s.failure_reason);
    return { done: false as const };
  }, ctx, { intervalMs: 5000 });
}

export const luma: ProviderAdapter = {
  meta: {
    id: 'luma',
    label: 'Luma',
    description: 'Ray 2 (vidéo, images clés de début et de fin) et Photon (image). Exige un stockage public.',
    capabilities: ['IMAGE', 'VIDEO'],
    needsApiKey: true,
    needsPublicInputUrls: true,
    docsUrl: 'https://docs.lumalabs.ai',
    presets: [
      { modelId: 'ray-2', label: 'Ray 2', capability: 'VIDEO', modes: ['text-to-video', 'image-to-video', 'first-last-frame'], pricing: { unit: 'second', usd: 0.1 }, quality: 4, speed: 3, maxDuration: 9 },
      { modelId: 'ray-flash-2', label: 'Ray Flash 2', capability: 'VIDEO', modes: ['text-to-video', 'image-to-video', 'first-last-frame'], pricing: { unit: 'second', usd: 0.04 }, quality: 3, speed: 5, maxDuration: 9 },
      { modelId: 'photon-1', label: 'Photon', capability: 'IMAGE', modes: ['text-to-image', 'image-to-image'], pricing: { unit: 'image', usd: 0.02 }, quality: 4, speed: 4 },
    ],
  },
  video: {
    async generate(cfg, req, ctx) {
      const first = firstFrame(req.inputs);
      const last = req.inputs.find((i) => i.role === 'last_frame');
      const keyframes: Record<string, unknown> = {};
      if (first) keyframes.frame0 = { type: 'image', url: publicUrl(first) };
      if (last) keyframes.frame1 = { type: 'image', url: publicUrl(last) };
      const duration = (req.params.durationSec ?? 5) > 7 ? '9s' : '5s';
      const s = await run(cfg, 'generations', { model: req.model, prompt: req.prompt, aspect_ratio: req.params.aspectRatio ?? '16:9', duration, resolution: req.params.resolution ?? '720p', ...(Object.keys(keyframes).length ? { keyframes } : {}) }, ctx);
      const file = await download(s.assets.video, {}, ctx);
      const secs = Number(duration.replace('s', ''));
      return { outputs: [{ ...file, mimeType: 'video/mp4', durationSec: secs }], externalId: s.id, usage: { units: secs, unit: 'second' } };
    },
  },
  image: {
    async generate(cfg, req, ctx) {
      const refs = req.inputs.filter((i) => i.role === 'reference');
      const s = await run(cfg, 'generations/image', { model: req.model, prompt: req.prompt, aspect_ratio: req.params.aspectRatio ?? '16:9', ...(refs.length ? { image_ref: refs.slice(0, 4).map((f) => ({ url: publicUrl(f), weight: 0.85 })) } : {}) }, ctx);
      const file = await download(s.assets.image, {}, ctx);
      return { outputs: [file], externalId: s.id, usage: { units: 1, unit: 'image' } };
    },
  },
};
