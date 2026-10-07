import { cameraKeywords, cameraProse } from '../camera';
import type { ShotSpec } from '../context';

export const trim = (s?: string | null) => (s || '').trim().replace(/\n(?!\n)/g, ' ').replace(/ {2,}/g, ' ');
export const block = (s?: string | null) => (s || '').trim();
// Les cibles en prose concatènent des fragments : sans ce garde-fou, deux
// phrases se collent et le moteur lit une seule phrase absurde.
export const sentence = (s?: string | null) => {
  const t = trim(s);
  return !t || /[.!?]$/.test(t) ? t : `${t}.`;
};
export const cap = (s?: string | null) => {
  const t = sentence(s);
  return t ? t[0].toUpperCase() + t.slice(1) : t;
};

export const LIPSYNC = 'Mouth stays closed and neutral, no speech, no mouth movement.';
export const LIPSYNC_SHORT = 'Mouth closed, no speech.';

export const castLine = (spec: ShotSpec) =>
  spec.characters.map((c) => sentence(c.short || `${c.code} ${c.name}`)).join(' ');
// Version courte pour les moteurs qui décrochent au-delà de ~70 mots : le
// marqueur de silhouette identifie mieux qu'une description complète.
export const castTag = (spec: ShotSpec) =>
  spec.characters.map((c) => sentence(`${c.code} ${c.name}${c.silhouette ? `, ${trim(c.silhouette)}` : ''}`)).join(' ');
export const propsLine = (spec: ShotSpec) => spec.props.map((p) => sentence(`${p.code} ${trim(p.short || p.name)}`)).join(' ');

export const camera = { prose: cameraProse, keywords: cameraKeywords };

export function orientation(ratio: string) {
  const [w, h] = ratio.split(':').map(Number);
  if (!w || !h) return ratio;
  return w > h ? `${ratio} horizontal` : w < h ? `${ratio} vertical` : `${ratio} square`;
}

// Un plan sans dialogue ne doit pas faire parler : les moteurs vidéo animent
// les bouches par défaut. Avec dialogue, on le dit explicitement.
export const speech = (spec: ShotSpec, short = false) =>
  spec.dialogue ? `The character speaks: "${trim(spec.dialogue)}"` : short ? LIPSYNC_SHORT : LIPSYNC;

export const words = (s: string) => s.split(/\s+/).filter(Boolean).length;
