import { ProviderError } from '../errors';
import { dataUri, download, http, need } from '../http';
import type { InputFile, OutputFile, ProviderAdapter, ProviderConfig, RunContext } from '../types';
import { fillGraph } from './comfyui';
import { fromDataUri } from './mapping';

// API personnalisée : un serveur d'inférence maison qui répond en une seule
// requête. On décrit le corps JSON avec des variables et l'endroit où lire
// le résultat ; aucun code à écrire.

function at(obj: any, path: string) {
  return path.split('.').reduce((o, k) => (o == null ? o : o[/^\d+$/.test(k) ? Number(k) : k]), obj);
}

async function call(cfg: ProviderConfig, vars: Record<string, string | number | undefined>, ctx: RunContext) {
  const endpoint = need(cfg.baseUrl, 'URL de l’endpoint manquante.');
  const template = cfg.config.bodyTemplate ?? { prompt: '{{prompt}}' };
  const body = fillGraph(typeof template === 'string' ? JSON.parse(template) : template, vars);
  const extra = (cfg.config.headers as Record<string, string>) ?? {};
  return http(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}), ...extra }, body: JSON.stringify(body), timeoutMs: 30 * 60_000 }, ctx);
}

async function outputOf(cfg: ProviderConfig, res: unknown, ctx: RunContext): Promise<OutputFile[]> {
  const path = (cfg.config.outputPath as string) || 'output';
  const v = at(res, path);
  const list = Array.isArray(v) ? v : [v];
  const out: OutputFile[] = [];
  for (const item of list) {
    if (typeof item !== 'string') continue;
    if (item.startsWith('data:')) out.push(fromDataUri(item)!);
    else if (/^https?:/.test(item)) out.push(await download(item, {}, ctx));
    else out.push({ data: Buffer.from(item, 'base64'), mimeType: (cfg.config.outputMime as string) || 'image/png' });
  }
  if (!out.length) throw new ProviderError('upstream', `Rien à « ${path} » dans la réponse.`);
  return out;
}

const vars = (prompt: string, negative: string | undefined, p: Record<string, any>, inputs: InputFile[]) => ({
  prompt,
  negative: negative ?? '',
  seed: p.seed,
  width: p.width,
  height: p.height,
  aspect_ratio: p.aspectRatio,
  duration: p.durationSec,
  image: inputs[0] ? dataUri(inputs[0]) : undefined,
});

export const customHttp: ProviderAdapter = {
  meta: {
    id: 'custom-http',
    label: 'API personnalisée',
    description: 'Un endpoint HTTP maison, synchrone : corps JSON à variables, chemin du résultat.',
    capabilities: ['TEXT', 'IMAGE', 'VIDEO', 'AUDIO'],
    needsApiKey: false,
    optionalApiKey: true,
    needsBaseUrl: true,
    fields: [
      { key: 'bodyTemplate', label: 'Corps de la requête', type: 'json', required: true, placeholder: '{"prompt": "{{prompt}}", "seed": "{{seed}}", "image": "{{image}}"}', help: 'Variables : {{prompt}} {{negative}} {{seed}} {{width}} {{height}} {{aspect_ratio}} {{duration}} {{image}} (data URI).' },
      { key: 'outputPath', label: 'Chemin du résultat', type: 'text', placeholder: 'images.0.url', help: 'URL, data URI ou base64 brut.' },
      { key: 'outputMime', label: 'Type du résultat (si base64 brut)', type: 'text', placeholder: 'image/png' },
      { key: 'headers', label: 'En-têtes', type: 'json', placeholder: '{"X-Api-Version": "2"}' },
    ],
    presets: [],
  },
  text: {
    async generate(cfg, req, ctx) {
      const prompt = [req.system, ...req.messages.map((m) => `${m.role}: ${m.content}`)].filter(Boolean).join('\n\n');
      const res = await call(cfg, { prompt }, ctx);
      const text = at(res, (cfg.config.outputPath as string) || 'output');
      return { outputs: [], text: typeof text === 'string' ? text : JSON.stringify(text) };
    },
  },
  image: { generate: async (cfg, req, ctx) => ({ outputs: await outputOf(cfg, await call(cfg, vars(req.prompt, req.negative, req.params, req.inputs), ctx), ctx) }) },
  video: { generate: async (cfg, req, ctx) => ({ outputs: await outputOf(cfg, await call(cfg, vars(req.prompt, req.negative, req.params, req.inputs), ctx), ctx) }) },
  audio: { generate: async (cfg, req, ctx) => ({ outputs: await outputOf(cfg, await call(cfg, vars(req.prompt, undefined, req.params, req.inputs), ctx), ctx) }) },
};
