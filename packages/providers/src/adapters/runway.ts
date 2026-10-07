import { ProviderError } from '../errors';
import { dataUri, download, firstFrame, http, need, poll } from '../http';
import type { ProviderAdapter, ProviderConfig, RunContext } from '../types';

// Runway : Gen-4 Turbo (image → vidéo, première et dernière image) et
// Gen-4 Image (texte → image avec références taguées).

const base = (cfg: ProviderConfig) => (cfg.baseUrl || 'https://api.dev.runwayml.com/v1').replace(/\/$/, '');
const headers = (cfg: ProviderConfig) => ({ Authorization: `Bearer ${need(cfg.apiKey, 'Clé API manquante.')}`, 'X-Runway-Version': '2024-11-06', 'Content-Type': 'application/json' });

const VIDEO_RATIOS: Record<string, string> = { '16:9': '1280:720', '9:16': '720:1280', '1:1': '960:960', '4:3': '1104:832', '3:4': '832:1104', '2.39:1': '1584:672' };
const IMAGE_RATIOS: Record<string, string> = { '16:9': '1920:1080', '9:16': '1080:1920', '1:1': '1024:1024', '4:3': '1360:768', '3:4': '1080:1440', '2.39:1': '1808:768' };

async function task(cfg: ProviderConfig, path: string, body: object, ctx: RunContext) {
  const t = await http(`${base(cfg)}/${path}`, { method: 'POST', headers: headers(cfg), body: JSON.stringify(body) }, ctx);
  ctx.onExternalId?.(t.id);
  const done = await poll(async () => {
    const s = await http(`${base(cfg)}/tasks/${t.id}`, { headers: headers(cfg) }, ctx);
    if (s.status === 'SUCCEEDED') return { done: true as const, value: s };
    if (s.status === 'FAILED' || s.status === 'CANCELLED') throw new ProviderError(/SAFETY|moderation/i.test(`${s.failureCode} ${s.failure}`) ? 'content_policy' : 'upstream', s.failure ?? s.failureCode);
    return { done: false as const, progress: typeof s.progress === 'number' ? Math.round(s.progress * 100) : undefined };
  }, ctx, { intervalMs: 5000 });
  return { id: t.id as string, urls: (done.output ?? []) as string[] };
}

export const runway: ProviderAdapter = {
  meta: {
    id: 'runway',
    label: 'Runway',
    description: 'Gen-4 Turbo (image → vidéo, première et dernière image), Gen-4 Image (références taguées).',
    capabilities: ['IMAGE', 'VIDEO'],
    needsApiKey: true,
    docsUrl: 'https://docs.dev.runwayml.com',
    presets: [
      { modelId: 'gen4_turbo', label: 'Gen-4 Turbo', capability: 'VIDEO', modes: ['image-to-video', 'first-last-frame'], pricing: { unit: 'second', usd: 0.05 }, quality: 4, speed: 4, maxDuration: 10, aspectRatios: Object.keys(VIDEO_RATIOS) },
      { modelId: 'gen4_image', label: 'Gen-4 Image', capability: 'IMAGE', modes: ['text-to-image', 'image-to-image'], pricing: { unit: 'image', usd: 0.08 }, quality: 5, speed: 3, aspectRatios: Object.keys(IMAGE_RATIOS) },
    ],
  },
  video: {
    async generate(cfg, req, ctx) {
      const first = firstFrame(req.inputs);
      if (!first) throw new ProviderError('unsupported', 'Gen-4 Turbo part toujours d’une image : fournir une première image.');
      const last = req.inputs.find((i) => i.role === 'last_frame');
      const duration = (req.params.durationSec ?? 5) > 7 ? 10 : 5;
      const promptImage = last ? [{ uri: dataUri(first), position: 'first' }, { uri: dataUri(last), position: 'last' }] : dataUri(first);
      const r = await task(cfg, 'image_to_video', { model: req.model, promptImage, promptText: req.prompt.slice(0, 1000), ratio: VIDEO_RATIOS[req.params.aspectRatio ?? '16:9'] ?? '1280:720', duration, ...(req.params.seed !== undefined ? { seed: req.params.seed } : {}) }, ctx);
      const outputs = await Promise.all(r.urls.map((u) => download(u, {}, ctx)));
      return { outputs: outputs.map((o) => ({ ...o, durationSec: duration })), externalId: r.id, usage: { units: duration, unit: 'second' } };
    },
  },
  image: {
    async generate(cfg, req, ctx) {
      const refs = req.inputs.filter((i) => i.mimeType.startsWith('image/')).slice(0, 3);
      const r = await task(
        cfg,
        'text_to_image',
        { model: req.model, promptText: req.prompt.slice(0, 1000), ratio: IMAGE_RATIOS[req.params.aspectRatio ?? '16:9'] ?? '1920:1080', ...(refs.length ? { referenceImages: refs.map((f, i) => ({ uri: dataUri(f), tag: (f.tag ?? `ref${i + 1}`).replace(/[^a-zA-Z0-9_]/g, '') })) } : {}), ...(req.params.seed !== undefined ? { seed: req.params.seed } : {}) },
        ctx,
      );
      const outputs = await Promise.all(r.urls.map((u) => download(u, {}, ctx)));
      return { outputs, externalId: r.id, usage: { units: outputs.length, unit: 'image' } };
    },
  },
  async test(cfg) {
    const j = await http(`${base(cfg)}/organization`, { headers: headers(cfg), timeoutMs: 15_000 });
    return { ok: true, message: `Crédits : ${j.creditBalance ?? '?'}.` };
  },
};
