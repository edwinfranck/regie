import { fromStatus } from '../errors';
import { http, rawFetch } from '../http';
import type { ProviderAdapter, ProviderConfig, TextRequest } from '../types';
import { ndjson } from './sse';

// Ollama : modèles de langage locaux. Aucune clé, aucun coût, rien ne sort
// de la machine.

const base = (cfg: ProviderConfig) => (cfg.baseUrl || 'http://localhost:11434').replace(/\/$/, '');
// Ollama tronque silencieusement au-delà de sa fenêtre par défaut (souvent
// 4096 tokens) : le résumé du projet envoyé aux modèles la dépasse vite.
const numCtx = (cfg: ProviderConfig) => Number(cfg.config.numCtx) || 16384;
const body = (cfg: ProviderConfig, req: TextRequest, stream: boolean) => ({
  model: req.model,
  stream,
  messages: [...(req.system ? [{ role: 'system', content: req.system }] : []), ...req.messages],
  ...(req.json ? { format: 'json' } : {}),
  options: { num_ctx: numCtx(cfg), ...(req.temperature !== undefined ? { temperature: req.temperature } : {}), ...(req.maxTokens ? { num_predict: req.maxTokens } : {}) },
});

export const ollama: ProviderAdapter = {
  meta: {
    id: 'ollama',
    label: 'Ollama (local)',
    description: 'Modèles de langage locaux. Gratuit, hors ligne, privé.',
    capabilities: ['TEXT', 'EMBEDDING'],
    local: true,
    needsApiKey: false,
    needsBaseUrl: true,
    defaultBaseUrl: 'http://localhost:11434',
    docsUrl: 'https://github.com/ollama/ollama/blob/main/docs/api.md',
    fields: [{ key: 'numCtx', label: 'Fenêtre de contexte (tokens)', type: 'number', placeholder: '16384', help: 'Taille du contexte demandée au modèle. Plus grand = plus de mémoire.' }],
    presets: [],
  },
  text: {
    async generate(cfg, req, ctx) {
      const j = await http(`${base(cfg)}/api/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body(cfg, req, false)), timeoutMs: 900_000 }, ctx);
      return { outputs: [], text: j.message?.content ?? '', usage: { inputTokens: j.prompt_eval_count, outputTokens: j.eval_count }, costUsd: 0 };
    },
    async *stream(cfg, req, ctx) {
      const res = await rawFetch(`${base(cfg)}/api/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body(cfg, req, true)), timeoutMs: 900_000 }, ctx);
      if (!res.ok) throw fromStatus(res.status, await res.text());
      let text = '';
      for await (const j of ndjson(res)) {
        if (j.error) throw fromStatus(500, j.error);
        const d = j.message?.content;
        if (d) {
          text += d;
          yield d;
        }
        if (j.done) yield { done: { outputs: [], text, usage: { inputTokens: j.prompt_eval_count, outputTokens: j.eval_count }, costUsd: 0 } };
      }
    },
  },
  async test(cfg) {
    const j = await http(`${base(cfg)}/api/tags`, { timeoutMs: 5000 });
    return { ok: true, message: `${j.models?.length ?? 0} modèles installés.` };
  },
  async listModels(cfg) {
    const j = await http(`${base(cfg)}/api/tags`, { timeoutMs: 5000 });
    return (j.models ?? []).map((m: any) => ({
      modelId: m.name,
      label: `${m.name}${m.details?.parameter_size ? ` (${m.details.parameter_size})` : ''}`,
      capability: /embed/i.test(m.name) ? ('EMBEDDING' as const) : ('TEXT' as const),
      modes: /embed/i.test(m.name) ? ['embedding'] : ['text'],
      pricing: { unit: '1k_tokens' as const, usd: 0 },
      quality: 3,
      speed: 3,
    }));
  },
};
