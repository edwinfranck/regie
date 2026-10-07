// Une erreur de génération doit être compréhensible : quoi, chez qui, et que
// faire. Les adapters traduisent les erreurs brutes en ProviderError ; le
// worker décide du retry à partir de `retryable`.

export type ErrorCode =
  | 'not_configured'
  | 'auth'
  | 'quota'
  | 'rate_limit'
  | 'invalid_input'
  | 'content_policy'
  | 'unsupported'
  | 'timeout'
  | 'network'
  | 'upstream'
  | 'canceled'
  | 'internal';

const MESSAGES: Record<ErrorCode, string> = {
  not_configured: 'Provider non configuré.',
  auth: 'Clé API refusée par le provider.',
  quota: 'Crédit ou quota épuisé chez le provider.',
  rate_limit: 'Trop de requêtes : le provider demande de ralentir.',
  invalid_input: 'Le provider a refusé la requête.',
  content_policy: 'Contenu refusé par la politique du provider.',
  unsupported: 'Ce modèle ne sait pas faire ça.',
  timeout: 'Le provider n’a pas répondu à temps.',
  network: 'Provider injoignable.',
  upstream: 'Erreur côté provider.',
  canceled: 'Génération annulée.',
  internal: 'Erreur interne de régie (stockage ou base de données) : le provider n’est pas en cause.',
};

export const RETRYABLE: ErrorCode[] = ['rate_limit', 'timeout', 'network', 'upstream', 'internal'];

export class ProviderError extends Error {
  readonly retryable: boolean;
  constructor(
    public code: ErrorCode,
    public detail?: string,
    public status?: number,
  ) {
    super(detail ? `${MESSAGES[code]} ${detail}` : MESSAGES[code]);
    this.retryable = RETRYABLE.includes(code);
  }
  get title() {
    return MESSAGES[this.code];
  }
}

export function fromStatus(status: number, body: string): ProviderError {
  const detail = extractMessage(body);
  if (status === 401 || status === 403) return new ProviderError('auth', detail, status);
  if (status === 402) return new ProviderError('quota', detail, status);
  if (status === 429) return /quota|credit|billing|insufficient/i.test(body) ? new ProviderError('quota', detail, status) : new ProviderError('rate_limit', detail, status);
  if (status === 408 || status === 504) return new ProviderError('timeout', detail, status);
  if (status >= 500) return new ProviderError('upstream', detail, status);
  if (/safety|moderation|content[_ ]policy|nsfw|flagged/i.test(body)) return new ProviderError('content_policy', detail, status);
  return new ProviderError('invalid_input', detail, status);
}

function extractMessage(body: string) {
  try {
    const j = JSON.parse(body);
    const m = j?.error?.message ?? j?.message ?? j?.detail ?? j?.error;
    if (typeof m === 'string') return m.slice(0, 500);
    if (Array.isArray(m)) return JSON.stringify(m).slice(0, 500);
  } catch {}
  return body.slice(0, 300);
}

export function toProviderError(e: unknown): ProviderError {
  if (e instanceof ProviderError) return e;
  if (e instanceof Error) {
    if (e.name === 'AbortError') return new ProviderError('canceled');
    if (e.name === 'TimeoutError') return new ProviderError('timeout');
    const cause = (e as any).cause;
    if (e.message === 'fetch failed' || cause?.code === 'ECONNREFUSED' || cause?.code === 'ENOTFOUND')
      return new ProviderError('network', cause?.code ? `(${cause.code})` : undefined);
    return new ProviderError('upstream', e.message);
  }
  return new ProviderError('upstream', String(e));
}
