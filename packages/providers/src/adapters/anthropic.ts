import Anthropic from '@anthropic-ai/sdk';
import { ProviderError } from '../errors';
import { need } from '../http';
import type { GenerationResult, ProviderAdapter, ProviderConfig, TextRequest } from '../types';

// Claude, via le SDK officiel. Texte seulement : assistant de production,
// concept, réécriture, dépouillement, vérification de continuité.

const client = (cfg: ProviderConfig) =>
  new Anthropic({ apiKey: need(cfg.apiKey, 'Clé API manquante.'), ...(cfg.baseUrl ? { baseURL: cfg.baseUrl } : {}), maxRetries: 2 });

// Sur les modèles qui ont des classifieurs de sécurité, un refus bascule
// côté serveur vers le modèle adapté plutôt que d'arrêter la réponse.
const FALLBACK_MODELS = ['claude-opus-5', 'claude-fable-5-1'];

function params(req: TextRequest) {
  const p: Record<string, unknown> = {
    model: req.model,
    max_tokens: req.maxTokens ?? 16000,
    messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
    ...(req.system ? { system: req.system + (req.json ? '\n\nRéponds uniquement par un objet JSON valide, sans texte autour.' : '') } : req.json ? { system: 'Réponds uniquement par un objet JSON valide, sans texte autour.' } : {}),
  };
  if (FALLBACK_MODELS.includes(req.model)) {
    p.betas = ['server-side-fallback-2026-07-01'];
    p.fallbacks = 'default';
  }
  return p;
}

function translate(e: unknown): never {
  if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) throw new ProviderError('auth', e.message, e.status);
  if (e instanceof Anthropic.RateLimitError) throw new ProviderError('rate_limit', e.message, 429);
  if (e instanceof Anthropic.BadRequestError) throw new ProviderError(/credit|billing/i.test(e.message) ? 'quota' : 'invalid_input', e.message, 400);
  if (e instanceof Anthropic.NotFoundError) throw new ProviderError('invalid_input', `Modèle inconnu : ${e.message}`, 404);
  if (e instanceof Anthropic.APIConnectionTimeoutError) throw new ProviderError('timeout');
  if (e instanceof Anthropic.APIConnectionError) throw new ProviderError('network', e.message);
  if (e instanceof Anthropic.APIError) throw new ProviderError('upstream', e.message, e.status);
  throw e;
}

function result(msg: any): GenerationResult {
  if (msg.stop_reason === 'refusal') throw new ProviderError('content_policy', msg.stop_details?.explanation ?? undefined);
  const text = (msg.content ?? [])
    .filter((b: any) => b.type === 'text')
    .map((b: any) => b.text)
    .join('');
  return { outputs: [], text, usage: { inputTokens: msg.usage?.input_tokens, outputTokens: msg.usage?.output_tokens }, externalId: msg.id };
}

export const anthropic: ProviderAdapter = {
  meta: {
    id: 'anthropic',
    label: 'Anthropic',
    description: 'Claude : assistant de production, développement narratif, réécriture, analyse de continuité.',
    capabilities: ['TEXT'],
    needsApiKey: true,
    docsUrl: 'https://platform.claude.com/docs',
    presets: [
      { modelId: 'claude-opus-5', label: 'Claude Opus 5', capability: 'TEXT', modes: ['text'], pricing: { unit: '1k_tokens', usd: 0.015 }, quality: 5, speed: 3 },
      { modelId: 'claude-sonnet-5', label: 'Claude Sonnet 5', capability: 'TEXT', modes: ['text'], pricing: { unit: '1k_tokens', usd: 0.006 }, quality: 4, speed: 4 },
      { modelId: 'claude-haiku-4-5', label: 'Claude Haiku 4.5', capability: 'TEXT', modes: ['text'], pricing: { unit: '1k_tokens', usd: 0.003 }, quality: 3, speed: 5 },
    ],
  },
  text: {
    async generate(cfg, req, ctx) {
      try {
        const c = client(cfg);
        const p = params(req) as any;
        const stream = p.betas ? c.beta.messages.stream(p, { signal: ctx.signal }) : c.messages.stream(p, { signal: ctx.signal });
        return result(await stream.finalMessage());
      } catch (e) {
        translate(e);
      }
    },
    async *stream(cfg, req, ctx) {
      const c = client(cfg);
      const p = params(req) as any;
      let stream;
      try {
        stream = p.betas ? c.beta.messages.stream(p, { signal: ctx.signal }) : c.messages.stream(p, { signal: ctx.signal });
      } catch (e) {
        translate(e);
      }
      try {
        for await (const ev of stream as AsyncIterable<any>) {
          if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta') yield ev.delta.text as string;
        }
        yield { done: result(await stream.finalMessage()) };
      } catch (e) {
        translate(e);
      }
    },
  },
  async test(cfg) {
    try {
      const page = await client(cfg).models.list({ limit: 20 });
      return { ok: true, message: `${page.data.length} modèles accessibles.` };
    } catch (e) {
      translate(e);
    }
  },
};
