import { cameraProse, cameraKeywords } from '../camera.mjs';

export const trim = (s) => (s || '').trim().replace(/\n(?!\n)/g, ' ').replace(/ {2,}/g, ' ');
export const block = (s) => (s || '').trim();
// Les cibles en prose concatenent des fragments : sans ce garde-fou,
// deux phrases se collent et le moteur lit une seule phrase absurde.
export const sentence = (s) => { const t = trim(s); return !t || /[.!?]$/.test(t) ? t : `${t}.`; };

export const cap = (s) => { const t = sentence(s); return t ? t[0].toUpperCase() + t.slice(1) : t; };

export const LIPSYNC = 'Mouth stays closed and neutral, no speech, no mouth movement.';
export const LIPSYNC_SHORT = 'Mouth closed, no speech.';

// c.short commence deja par "CH7 Mel, 1.90m ..." : pas de prefixe a rajouter.
export const castLine = (spec) => spec.characters.map((c) => sentence(c.short)).join(' ');
// Version courte pour les moteurs qui decrochent au-dela de ~70 mots.
export const castTag = (spec) => spec.characters.map((c) => sentence(`${c.id} ${c.name}, ${trim(c.silhouette)}`)).join(' ');
export const propsLine = (spec) => spec.props.map((p) => sentence(`${p.id} ${trim(p.short)}`)).join(' ');

export const refsList = (spec) => spec.refs.map((r) => `${r.path}  (${r.why})`);
export const camera = { prose: cameraProse, keywords: cameraKeywords };
export const shotTag = (spec) => `${spec.episode}-${String(spec.id).padStart(2, '0')}`;
