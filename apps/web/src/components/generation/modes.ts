import { GENERATION_MODES, type GenerationMode } from '@regie/core';

export type MediaCapability = 'IMAGE' | 'VIDEO' | 'AUDIO';
export type InputRole = 'reference' | 'first_frame' | 'last_frame' | 'init';

export const CAPABILITY_MODES: Record<MediaCapability, GenerationMode[]> = {
  IMAGE: ['text-to-image', 'image-to-image'],
  VIDEO: ['text-to-video', 'image-to-video', 'first-last-frame', 'reference-to-video'],
  AUDIO: ['text-to-speech', 'sound-effect', 'music'],
};

export const modeLabel = (m: string) => GENERATION_MODES[m as GenerationMode] ?? m;

export const ROLE_LABELS: Record<InputRole, string> = {
  reference: 'Référence',
  first_frame: 'Première image',
  last_frame: 'Dernière image',
  init: 'Image de départ',
};

/**
 * Les entrées qu'accepte chaque mode : rôles possibles et rôles obligatoires.
 * Le serveur refuse image-to-video et first-last-frame sans image ; on le dit
 * avant l'envoi plutôt qu'après.
 */
export const MODE_INPUTS: Record<string, { roles: InputRole[]; required: InputRole[]; max: number }> = {
  'text-to-image': { roles: ['reference'], required: [], max: 6 },
  'image-to-image': { roles: ['init', 'reference'], required: ['init'], max: 6 },
  'text-to-video': { roles: [], required: [], max: 0 },
  'image-to-video': { roles: ['first_frame', 'reference'], required: ['first_frame'], max: 4 },
  'first-last-frame': { roles: ['first_frame', 'last_frame'], required: ['first_frame', 'last_frame'], max: 2 },
  'reference-to-video': { roles: ['reference'], required: [], max: 6 },
  'text-to-speech': { roles: [], required: [], max: 0 },
  'sound-effect': { roles: [], required: [], max: 0 },
  music: { roles: [], required: [], max: 0 },
};

/** Le rôle à donner à une nouvelle entrée : le premier rôle obligatoire encore vide. */
export function nextRole(mode: string, current: { role: string }[]): InputRole {
  const spec = MODE_INPUTS[mode] ?? { roles: ['reference'], required: [] };
  return spec.required.find((r) => !current.some((i) => i.role === r)) ?? (spec.roles.includes('reference') ? 'reference' : spec.roles[0] ?? 'reference');
}

export const PAGE_OF: Record<MediaCapability, string> = { IMAGE: 'images', VIDEO: 'videos', AUDIO: 'audio' };
