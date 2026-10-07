import { describe, expect, it } from 'vitest';
import { route, type Candidate } from './router';
import { estimateCost, quote } from './cost';
import { encryptSecret, decryptSecret, secretHint } from './secrets';
import { fillGraph } from './adapters/comfyui';
import { collectUrls, imageInput } from './adapters/mapping';
import { fromStatus, ProviderError } from './errors';
import { classifyCompatModel, openaiCompatible } from './adapters/openai';
import { ADAPTERS, supports } from './registry';

const cand = (over: Partial<Candidate>): Candidate => ({
  id: 'm', providerId: 'p', providerName: 'P', adapter: 'fal', capability: 'IMAGE', modes: ['text-to-image'], quality: 3, speed: 3,
  pricing: { unit: 'image', usd: 0.04 }, aspectRatios: [], enabled: true, providerEnabled: true, configured: true, ...over,
});

describe('router', () => {
  const pool = [
    cand({ id: 'cheap', quality: 3, speed: 5, pricing: { unit: 'image', usd: 0.003 } }),
    cand({ id: 'best', quality: 5, speed: 2, pricing: { unit: 'image', usd: 0.08 } }),
    cand({ id: 'off', quality: 5, configured: false }),
    cand({ id: 'video', capability: 'VIDEO' }),
  ];
  it('préfère la qualité par défaut', () => expect(route(pool, { capability: 'IMAGE', mode: 'text-to-image' }).chosen?.id).toBe('best'));
  it('préfère le coût sur demande', () => expect(route(pool, { capability: 'IMAGE', mode: 'text-to-image', prefer: 'cost' }).chosen?.id).toBe('cheap'));
  it('écarte les providers non configurés et explique pourquoi', () => {
    const r = route(pool, { capability: 'IMAGE', mode: 'text-to-image' });
    expect(r.rejected.find((x) => x.candidate.id === 'off')?.why).toBe('provider non configuré');
  });
  it('une route déclarée l’emporte', () => {
    const r = route([...pool.slice(0, 2).map((c) => (c.id === 'cheap' ? { ...c, routePriority: 0 } : c))], { capability: 'IMAGE', mode: 'text-to-image' });
    expect(r.chosen?.id).toBe('cheap');
  });
  it('écarte un modèle trop court', () => {
    const r = route([cand({ capability: 'VIDEO', modes: ['image-to-video'], maxDuration: 5 })], { capability: 'VIDEO', mode: 'image-to-video', durationSec: 8 });
    expect(r.chosen).toBeNull();
  });
  it('ne choisit rien quand aucun provider n’est configuré', () => {
    expect(route([cand({ configured: false })], { capability: 'IMAGE', mode: 'text-to-image' }).chosen).toBeNull();
  });
});

describe('coûts', () => {
  it('par image, par seconde, par token', () => {
    expect(estimateCost({ unit: 'image', usd: 0.04 }, { units: 2 })).toBe(0.08);
    expect(estimateCost({ unit: 'second', usd: 0.1 }, { units: 8 })).toBe(0.8);
    expect(estimateCost({ unit: '1k_tokens', usd: 0.01 }, { inputTokens: 1500, outputTokens: 500 })).toBe(0.02);
    expect(estimateCost({}, {})).toBeNull();
    expect(quote({ unit: 'second', usd: 0.5 }, { durationSec: 8 })).toBe(4);
  });
});

describe('secrets', () => {
  it('chiffre et déchiffre', () => {
    process.env.ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
    const blob = encryptSecret('sk-test-1234567890');
    expect(blob).not.toContain('sk-test');
    expect(decryptSecret(blob)).toBe('sk-test-1234567890');
    expect(secretHint('sk-test-1234567890')).toBe('…7890');
  });
});

describe('ComfyUI', () => {
  it('remplace les variables et type les nombres', () => {
    const g = fillGraph({ '3': { inputs: { seed: '{{seed}}', text: 'a {{prompt}}', w: '{{width}}', keep: '{{unknown}}' } } }, { seed: 42, prompt: 'cat', width: 512 });
    expect(g).toEqual({ '3': { inputs: { seed: 42, text: 'a cat', w: 512, keep: '{{unknown}}' } } });
  });
});

describe('mapping des agrégateurs', () => {
  it('renomme les champs et ajoute les extras', () => {
    const input = imageInput({ model: 'x', mode: 'text-to-image', prompt: 'p', params: { aspectRatio: '16:9' }, inputs: [] }, { inputMap: { num_images: 'num_outputs' }, extraInput: { a: 1 } });
    expect(input).toMatchObject({ prompt: 'p', num_outputs: 1, a: 1, aspect_ratio: '16:9', width: 1024, height: 576 });
    expect(input).not.toHaveProperty('negative_prompt');
  });
  it('trouve les fichiers produits', () => {
    expect(collectUrls({ images: [{ url: 'https://a/1.png' }, { url: 'https://a/2.png' }] })).toEqual(['https://a/1.png', 'https://a/2.png']);
    expect(collectUrls({ video: { url: 'https://a/v.mp4' } })).toEqual(['https://a/v.mp4']);
    expect(collectUrls(['https://a/x.png'])).toEqual(['https://a/x.png']);
  });
});

describe('erreurs', () => {
  it('traduit les statuts', () => {
    expect(fromStatus(401, '{}').code).toBe('auth');
    expect(fromStatus(429, '{"error":{"message":"slow down"}}').retryable).toBe(true);
    expect(fromStatus(429, 'insufficient_quota').code).toBe('quota');
    expect(fromStatus(400, '{"error":{"message":"flagged by moderation"}}').code).toBe('content_policy');
    expect(new ProviderError('not_configured').message).toBe('Provider non configuré.');
  });
});

describe('registre', () => {
  it('chaque adapter déclare ce qu’il implémente', () => {
    for (const a of Object.values(ADAPTERS)) for (const c of a.meta.capabilities) if (c !== 'EMBEDDING') expect(supports(a, c), `${a.meta.id} ${c}`).toBe(true);
  });
});

describe('API compatible OpenAI : classement des modèles', () => {
  const cap = (m: unknown) => classifyCompatModel(m)?.capability ?? null;
  it('devine à l’identifiant quand le serveur ne dit rien', () => {
    expect(cap({ id: 'black-forest-labs/FLUX-1-schnell' })).toBe('IMAGE');
    expect(cap({ id: 'stabilityai/sdxl-turbo' })).toBe('IMAGE');
    expect(cap({ id: 'stabilityai/stable-diffusion-3.5-large' })).toBe('IMAGE');
    expect(cap({ id: 'dall-e-3' })).toBe('IMAGE');
    expect(cap({ id: 'playgroundai/playground-v2.5-1024px-aesthetic' })).toBe('IMAGE');
    expect(cap({ id: 'recraft-v3' })).toBe('IMAGE');
    expect(cap({ id: 'ideogram-v2' })).toBe('IMAGE');
    expect(cap({ id: 'BAAI/bge-large-en-v1.5' })).toBe('EMBEDDING');
    expect(cap({ id: 'text-embedding-3-small' })).toBe('EMBEDDING');
    expect(cap({ id: 'nomic-embed-text' })).toBe('EMBEDDING');
    expect(cap({ id: 'meta-llama/Llama-3.3-70B-Instruct' })).toBe('TEXT');
    expect(cap({ id: 'mistral-large-latest' })).toBe('TEXT');
    expect(cap({ id: 'deepseek-chat' })).toBe('TEXT');
  });
  it('modes cohérents avec la capacité', () => {
    expect(classifyCompatModel({ id: 'flux-dev' })?.modes).toEqual(['text-to-image']);
    expect(classifyCompatModel({ id: 'qwen2.5-7b' })?.modes).toEqual(['text']);
    expect(classifyCompatModel({ id: 'e5-mistral-7b-instruct-embed' })?.modes).toEqual(['text']);
  });
  it('suit le champ type (Together) plutôt que l’identifiant', () => {
    expect(cap({ id: 'black-forest-labs/FLUX.1-pro', type: 'image', display_name: 'FLUX.1 [pro]' })).toBe('IMAGE');
    expect(classifyCompatModel({ id: 'x/y', type: 'image', display_name: 'Y' })?.label).toBe('Y');
    expect(cap({ id: 'togethercomputer/m2-bert-80M-8k-retrieval', type: 'embedding' })).toBe('EMBEDDING');
    expect(cap({ id: 'some/flux-prompt-writer', type: 'chat' })).toBe('TEXT');
    expect(cap({ id: 'Salesforce/Llama-Rank-V1', type: 'rerank' })).toBeNull();
  });
  it('suit architecture.output_modalities (OpenRouter)', () => {
    expect(cap({ id: 'anthropic/claude-sonnet-4', name: 'Claude Sonnet 4', architecture: { input_modalities: ['text', 'image'], output_modalities: ['text'] } })).toBe('TEXT');
    // Texte + image en sortie : servi par /chat/completions, donc TEXT.
    expect(cap({ id: 'google/gemini-2.5-flash-image', architecture: { output_modalities: ['image', 'text'] } })).toBe('TEXT');
    expect(cap({ id: 'vendor/painter', architecture: { output_modalities: ['image'] } })).toBe('IMAGE');
    expect(cap({ id: 'vendor/painter', architecture: { modality: 'text->image' } })).toBe('IMAGE');
  });
  it('écarte ce qui ne génère rien', () => {
    expect(cap({ id: 'whisper-large-v3' })).toBeNull();
    expect(cap({ id: '' })).toBeNull();
  });
  it('déclare des services connus, clé facultative', () => {
    const m = openaiCompatible.meta;
    expect(m.optionalApiKey).toBe(true);
    expect(m.needsApiKey).toBe(false);
    const ids = new Set(m.endpoints?.map((e) => e.id));
    for (const id of ['deepinfra', 'together', 'openrouter', 'groq', 'mistral', 'lmstudio', 'vllm']) expect(ids.has(id), id).toBe(true);
    for (const e of m.endpoints ?? []) expect(e.baseUrl).toMatch(/^https?:\/\/[^/]+/);
    expect(ids.size).toBe(m.endpoints?.length);
  });
});
