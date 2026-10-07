import { ProviderError, fromStatus, toProviderError } from './errors';
import type { InputFile, OutputFile, RunContext } from './types';

// Petits outils HTTP partagés par les adapters : fetch avec erreurs
// traduites, attente d'une tâche asynchrone, téléchargement du résultat.

export async function http<T = any>(url: string, init: RequestInit & { timeoutMs?: number } = {}, ctx?: RunContext): Promise<T> {
  const res = await rawFetch(url, init, ctx);
  const text = await res.text();
  if (!res.ok) throw fromStatus(res.status, text);
  if (!text) return undefined as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return text as T;
  }
}

export async function rawFetch(url: string, init: RequestInit & { timeoutMs?: number } = {}, ctx?: RunContext) {
  const timeout = AbortSignal.timeout(init.timeoutMs ?? 120_000);
  const signal = ctx?.signal ? AbortSignal.any([ctx.signal, timeout]) : timeout;
  try {
    return await fetch(url, { ...init, signal });
  } catch (e) {
    throw toProviderError(e);
  }
}

export async function download(url: string, headers: Record<string, string> = {}, ctx?: RunContext): Promise<OutputFile> {
  const res = await rawFetch(url, { headers, timeoutMs: 600_000 }, ctx);
  if (!res.ok) throw fromStatus(res.status, await res.text());
  const data = Buffer.from(await res.arrayBuffer());
  return { data, mimeType: res.headers.get('content-type')?.split(';')[0] || guessMime(url) };
}

export function guessMime(url: string) {
  const ext = url.split('?')[0].split('.').pop()?.toLowerCase();
  return (
    { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', mp3: 'audio/mpeg', wav: 'audio/wav' }[ext ?? ''] ??
    'application/octet-stream'
  );
}

export const dataUri = (f: InputFile) => `data:${f.mimeType};base64,${f.data.toString('base64')}`;
export const b64 = (f: InputFile) => f.data.toString('base64');

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(t);
      reject(new ProviderError('canceled'));
    });
  });

/**
 * Attend la fin d'une tâche asynchrone chez le provider. `check` renvoie
 * `{ done: true, value }` quand c'est fini, ou une progression estimée.
 */
export async function poll<T>(
  check: () => Promise<{ done: true; value: T } | { done: false; progress?: number; message?: string }>,
  ctx: RunContext,
  { intervalMs = 3000, timeoutMs = 20 * 60_000 } = {},
): Promise<T> {
  const start = Date.now();
  let wait = intervalMs;
  while (Date.now() - start < timeoutMs) {
    const r = await check();
    if (r.done) return r.value;
    const elapsed = (Date.now() - start) / timeoutMs;
    ctx.onProgress?.(r.progress ?? Math.min(95, Math.round(10 + elapsed * 300)), r.message);
    await sleep(wait, ctx.signal);
    wait = Math.min(wait * 1.25, 15_000);
  }
  throw new ProviderError('timeout', `Pas de résultat après ${Math.round(timeoutMs / 60000)} min.`);
}

export function need<T>(v: T | null | undefined, what: string): T {
  if (v === null || v === undefined || v === '') throw new ProviderError('not_configured', what);
  return v;
}

export const inputsBy = (inputs: InputFile[], role: InputFile['role']) => inputs.filter((i) => i.role === role);
export const firstFrame = (inputs: InputFile[]) => inputs.find((i) => i.role === 'first_frame') ?? inputs.find((i) => i.role === 'init');

/** "16:9" → "1792x1024" ou la dimension la plus proche d'une liste. */
export function closestSize(ratio: string | undefined, sizes: string[], fallback = sizes[0]) {
  if (!ratio) return fallback;
  const [w, h] = ratio.split(':').map(Number);
  if (!w || !h) return fallback;
  const target = w / h;
  return sizes.reduce((best, s) => {
    const [sw, sh] = s.split('x').map(Number);
    const [bw, bh] = best.split('x').map(Number);
    return Math.abs(sw / sh - target) < Math.abs(bw / bh - target) ? s : best;
  }, fallback);
}

export function ratioToDims(ratio: string | undefined, long = 1024): { width: number; height: number } {
  const [w, h] = (ratio ?? '1:1').split(':').map(Number);
  if (!w || !h) return { width: long, height: long };
  const r8 = (n: number) => Math.round(n / 8) * 8;
  return w >= h ? { width: long, height: r8((long * h) / w) } : { width: r8((long * w) / h), height: long };
}
