import type { ShotSpec } from '../context';
import { kling } from './kling';
import { runway } from './runway';
import { sheet } from './sheet';
import { still } from './still';
import type { CompiledPrompt, Target } from './types';
import { veo } from './veo';
import { wan } from './wan';

export * from './types';
export { sheet };

// Ajouter un moteur = ajouter un fichier ici. Rien d'autre ne bouge.
export const TARGETS: Record<string, Target> = { still, veo, kling, wan, runway };

export const imageTargets = () => Object.values(TARGETS).filter((t) => t.kind === 'image');
export const videoTargets = () => Object.values(TARGETS).filter((t) => t.kind === 'video');

/** Les trois versions de prompt vidéo demandées par le Video Prompt Engine. */
export const VIDEO_VARIANTS = { concise: 'kling', cinematic: 'veo', technical: 'wan' } as const;

export function getTarget(id: string): Target {
  const t = TARGETS[id];
  if (!t) throw new Error(`Cible inconnue : "${id}". Disponibles : ${Object.keys(TARGETS).join(', ')}`);
  return t;
}

/** La cible naturelle d'un adapter vidéo (grammaire spécifique au modèle). */
export function targetForAdapter(adapter: string, kind: 'image' | 'video'): Target {
  if (kind === 'image') return still;
  return videoTargets().find((t) => t.engines?.includes(adapter)) ?? veo;
}

/**
 * Compile un plan pour une cible. Une réécriture manuelle enregistrée sur le
 * plan l'emporte toujours : le prompt final reste visible et éditable.
 */
export function compile(spec: ShotSpec, targetId: string): CompiledPrompt {
  const out = getTarget(targetId).render(spec);
  const override = spec.overrides[targetId];
  if (override?.trim()) return { ...out, text: override, edited: true, notes: ['Prompt réécrit à la main.', ...out.notes] };
  return out;
}

export function compileAll(spec: ShotSpec) {
  return Object.fromEntries(Object.keys(TARGETS).map((id) => [id, compile(spec, id)])) as Record<string, CompiledPrompt>;
}
