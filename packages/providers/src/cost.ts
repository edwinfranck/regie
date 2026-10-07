import type { Usage } from './types';

export interface Pricing {
  unit?: 'image' | 'second' | '1k_tokens' | 'request' | '1k_chars';
  usd?: number;
}

/** Coût estimé d'un appel à partir du tarif du modèle et de l'usage mesuré. */
export function estimateCost(pricing: Pricing | null | undefined, usage: Usage | undefined): number | null {
  if (!pricing?.usd && pricing?.usd !== 0) return null;
  const usd = pricing.usd;
  switch (pricing.unit) {
    case '1k_tokens': {
      const t = (usage?.inputTokens ?? 0) + (usage?.outputTokens ?? 0);
      return round((t / 1000) * usd);
    }
    case 'image':
    case 'second':
    case '1k_chars':
      return round((usage?.units ?? 1) * usd);
    case 'request':
    default:
      return round(usd);
  }
}

/** Estimation avant lancement, pour afficher le coût sur le bouton Générer. */
export function quote(pricing: Pricing | null | undefined, req: { count?: number; durationSec?: number; chars?: number }): number | null {
  if (!pricing || pricing.usd === undefined) return null;
  switch (pricing.unit) {
    case 'image':
      return round((req.count ?? 1) * pricing.usd);
    case 'second':
      return round((req.durationSec ?? 5) * pricing.usd);
    case '1k_chars':
      return round(((req.chars ?? 0) / 1000) * pricing.usd);
    case '1k_tokens':
      return null;
    default:
      return round(pricing.usd);
  }
}

const round = (n: number) => Math.round(n * 10000) / 10000;
