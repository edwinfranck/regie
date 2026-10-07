import type { Capability } from './types';

// Le routeur AUTO : parmi les modèles disponibles, lequel utiliser pour cette
// tâche. Les routes déclarées par l'admin passent en premier (dans leur ordre) ;
// sinon on note chaque candidat selon la préférence qualité / coût / vitesse.
// L'utilisateur peut toujours forcer un modèle précis.

export interface Candidate {
  id: string;
  providerId: string;
  providerName: string;
  adapter: string;
  capability: Capability;
  modes: string[];
  quality: number;
  speed: number;
  pricing: { unit?: string; usd?: number };
  aspectRatios: string[];
  maxDuration?: number | null;
  enabled: boolean;
  providerEnabled: boolean;
  /** Clé présente (ou provider local sans clé). */
  configured: boolean;
  /** Position dans les routes déclarées pour la tâche, si routé. */
  routePriority?: number;
}

export interface RouteQuery {
  capability: Capability;
  mode: string;
  aspectRatio?: string;
  durationSec?: number;
  prefer?: 'quality' | 'cost' | 'speed';
}

export interface RouteDecision {
  chosen: Candidate | null;
  ranked: { candidate: Candidate; score: number; reasons: string[] }[];
  rejected: { candidate: Candidate; why: string }[];
}

export function route(candidates: Candidate[], q: RouteQuery): RouteDecision {
  const rejected: RouteDecision['rejected'] = [];
  const ok: Candidate[] = [];
  for (const c of candidates) {
    const why =
      c.capability !== q.capability
        ? 'autre capacité'
        : !c.enabled || !c.providerEnabled
          ? 'désactivé'
          : !c.configured
            ? 'provider non configuré'
            : c.modes.length && !c.modes.includes(q.mode)
              ? `ne fait pas ${q.mode}`
              : q.durationSec && c.maxDuration && q.durationSec > c.maxDuration
                ? `durée max ${c.maxDuration}s`
                : null;
    if (why) rejected.push({ candidate: c, why });
    else ok.push(c);
  }

  // Normalisation du coût entre les candidats : le moins cher vaut 5, le plus cher 1.
  const prices = ok.map((c) => c.pricing.usd ?? 0);
  const lo = Math.min(...prices);
  const hi = Math.max(...prices);
  const cheap = (c: Candidate) => (hi === lo ? 3 : 5 - (4 * ((c.pricing.usd ?? 0) - lo)) / (hi - lo));
  const w = { quality: [5, 1, 1], cost: [1, 4, 1], speed: [1, 1, 4] }[q.prefer ?? 'quality'];

  const ranked = ok
    .map((c) => {
      const reasons: string[] = [];
      let score = w[0] * c.quality + w[1] * cheap(c) + w[2] * c.speed;
      if (c.routePriority !== undefined) {
        score += 1000 - c.routePriority * 10;
        reasons.push(`route déclarée n°${c.routePriority + 1}`);
      }
      if (q.aspectRatio && c.aspectRatios.length && !c.aspectRatios.includes(q.aspectRatio)) {
        score -= 5;
        reasons.push(`format ${q.aspectRatio} non natif`);
      }
      reasons.push(`qualité ${c.quality}/5, vitesse ${c.speed}/5${c.pricing.usd !== undefined ? `, ${c.pricing.usd} $/${c.pricing.unit}` : ''}`);
      return { candidate: c, score, reasons };
    })
    .sort((a, b) => b.score - a.score);

  return { chosen: ranked[0]?.candidate ?? null, ranked, rejected };
}
