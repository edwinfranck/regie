import { randomUUID } from 'node:crypto';
import { ProviderError } from '../errors';
import { download, firstFrame, http, poll, ratioToDims } from '../http';
import type { GenerationResult, InputFile, ModelPreset, ProviderAdapter, ProviderConfig, RunContext } from '../types';

// ComfyUI : n'importe quel workflow exporté au format API ("Save (API)").
// Chaque workflow déclaré dans la configuration devient un modèle. Les
// valeurs du graphe peuvent contenir des variables remplacées à l'envoi :
//   {{prompt}} {{negative}} {{seed}} {{width}} {{height}} {{steps}} {{cfg}}
//   {{image}} (première image / référence)  {{image_last}}  {{frames}}
// Une variable seule dans une chaîne ("{{seed}}") devient un nombre.

interface Workflow {
  label?: string;
  capability?: 'IMAGE' | 'VIDEO';
  modes?: string[];
  graph: Record<string, any>;
}

const base = (cfg: ProviderConfig) => (cfg.baseUrl || 'http://127.0.0.1:8188').replace(/\/$/, '');
const headers = (cfg: ProviderConfig): Record<string, string> => (cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {});

function workflows(cfg: ProviderConfig): Record<string, Workflow> {
  const w = cfg.config.workflows;
  if (!w || typeof w !== 'object') return {};
  return w as Record<string, Workflow>;
}

async function upload(cfg: ProviderConfig, f: InputFile, ctx: RunContext) {
  const form = new FormData();
  form.set('image', new Blob([new Uint8Array(f.data)], { type: f.mimeType }), f.name ?? `regie-${randomUUID()}.png`);
  form.set('overwrite', 'true');
  const j = await http(`${base(cfg)}/upload/image`, { method: 'POST', headers: headers(cfg), body: form }, ctx);
  return j.subfolder ? `${j.subfolder}/${j.name}` : j.name;
}

export function fillGraph(graph: unknown, vars: Record<string, string | number | undefined>): unknown {
  if (typeof graph === 'string') {
    const whole = graph.match(/^\{\{\s*(\w+)\s*\}\}$/);
    if (whole && vars[whole[1]] !== undefined) return vars[whole[1]];
    return graph.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k) => (vars[k] !== undefined ? String(vars[k]) : m));
  }
  if (Array.isArray(graph)) return graph.map((g) => fillGraph(g, vars));
  if (graph && typeof graph === 'object') return Object.fromEntries(Object.entries(graph).map(([k, v]) => [k, fillGraph(v, vars)]));
  return graph;
}

async function run(cfg: ProviderConfig, name: string, vars: Record<string, string | number | undefined>, ctx: RunContext): Promise<GenerationResult> {
  const wf = workflows(cfg)[name];
  if (!wf) throw new ProviderError('invalid_input', `Workflow « ${name} » absent de la configuration ComfyUI.`);
  const prompt = fillGraph(wf.graph, vars);
  const clientId = randomUUID();
  const sub = await http(`${base(cfg)}/prompt`, { method: 'POST', headers: { ...headers(cfg), 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt, client_id: clientId }) }, ctx);
  if (sub.node_errors && Object.keys(sub.node_errors).length) throw new ProviderError('invalid_input', JSON.stringify(sub.node_errors).slice(0, 400));
  const id = sub.prompt_id as string;
  ctx.onExternalId?.(id);
  const entry = await poll(async () => {
    const h = await http(`${base(cfg)}/history/${id}`, { headers: headers(cfg) }, ctx);
    const e = h?.[id];
    if (!e) return { done: false as const, message: 'En file' };
    if (e.status?.status_str === 'error') {
      const err = (e.status.messages ?? []).find((m: any) => m[0] === 'execution_error')?.[1];
      throw new ProviderError('upstream', err?.exception_message ?? 'Erreur d’exécution du workflow.');
    }
    return e.status?.completed ? { done: true as const, value: e } : { done: false as const, message: 'En cours' };
  }, ctx, { intervalMs: 1500, timeoutMs: 60 * 60_000 });

  const files: { filename: string; subfolder: string; type: string }[] = [];
  for (const out of Object.values<any>(entry.outputs ?? {})) for (const k of ['images', 'gifs', 'videos']) for (const f of out[k] ?? []) if (f.type !== 'temp') files.push(f);
  if (!files.length) throw new ProviderError('upstream', 'Le workflow n’a produit aucun fichier (nœud de sauvegarde manquant ?).');
  const outputs = await Promise.all(files.map((f) => download(`${base(cfg)}/view?${new URLSearchParams({ filename: f.filename, subfolder: f.subfolder, type: f.type })}`, headers(cfg), ctx)));
  return { outputs, externalId: id, costUsd: 0, usage: { units: outputs.length, unit: 'image' } };
}

export const comfyui: ProviderAdapter = {
  meta: {
    id: 'comfyui',
    label: 'ComfyUI (local)',
    description: 'Vos workflows ComfyUI : génération, upscale, inpainting, cohérence de visage, vidéo (Wan, LTX)…',
    capabilities: ['IMAGE', 'VIDEO'],
    local: true,
    needsApiKey: false,
    needsBaseUrl: true,
    defaultBaseUrl: 'http://127.0.0.1:8188',
    docsUrl: 'https://docs.comfy.org',
    fields: [
      {
        key: 'workflows',
        label: 'Workflows',
        type: 'json',
        required: true,
        placeholder: '{ "flux-portrait": { "label": "Portrait Flux", "capability": "IMAGE", "graph": { …export API… } } }',
        help: 'Un workflow par clé, exporté avec « Save (API) ». Variables : {{prompt}}, {{negative}}, {{seed}}, {{width}}, {{height}}, {{steps}}, {{cfg}}, {{image}}, {{image_last}}, {{frames}}.',
      },
    ],
    presets: [],
  },
  image: {
    async generate(cfg, req, ctx) {
      const { width, height } = req.params.width && req.params.height ? { width: req.params.width, height: req.params.height } : ratioToDims(req.params.aspectRatio);
      const img = req.inputs.find((i) => i.role === 'init' || i.role === 'reference');
      return run(cfg, req.model, { prompt: req.prompt, negative: req.negative ?? '', seed: req.params.seed ?? Math.floor(Math.random() * 2 ** 31), width, height, steps: req.params.steps, cfg: req.params.cfg, image: img ? await upload(cfg, img, ctx) : undefined }, ctx);
    },
  },
  video: {
    async generate(cfg, req, ctx) {
      const { width, height } = ratioToDims(req.params.aspectRatio, 832);
      const first = firstFrame(req.inputs);
      const last = req.inputs.find((i) => i.role === 'last_frame');
      const fps = req.params.fps ?? 16;
      const r = await run(
        cfg,
        req.model,
        { prompt: req.prompt, negative: req.negative ?? '', seed: req.params.seed ?? Math.floor(Math.random() * 2 ** 31), width, height, frames: Math.round((req.params.durationSec ?? 5) * fps) + 1, image: first ? await upload(cfg, first, ctx) : undefined, image_last: last ? await upload(cfg, last, ctx) : undefined },
        ctx,
      );
      return { ...r, usage: { units: req.params.durationSec ?? 5, unit: 'second' } };
    },
  },
  async test(cfg) {
    const j = await http(`${base(cfg)}/system_stats`, { headers: headers(cfg), timeoutMs: 5000 });
    const gpu = j.devices?.[0]?.name;
    return { ok: true, message: `ComfyUI ${j.system?.comfyui_version ?? ''} joignable${gpu ? ` — ${gpu}` : ''}. ${Object.keys(workflows(cfg)).length} workflow(s) déclaré(s).` };
  },
  async listModels(cfg): Promise<ModelPreset[]> {
    return Object.entries(workflows(cfg)).map(([id, w]) => ({
      modelId: id,
      label: w.label ?? id,
      capability: w.capability ?? 'IMAGE',
      modes: w.modes ?? (w.capability === 'VIDEO' ? ['text-to-video', 'image-to-video'] : ['text-to-image', 'image-to-image']),
      pricing: { unit: 'image', usd: 0 },
      quality: 3,
      speed: 3,
    }));
  },
};
