import type { Target } from './types';
import { block, camera, orientation, trim } from './shared';

// Image fixe d'un plan. La sortie la plus verbeuse : un générateur d'images
// accepte un cahier des charges, un générateur vidéo non.
export const still: Target = {
  id: 'still',
  label: 'Image fixe du plan',
  kind: 'image',
  render(spec) {
    const s: string[] = [];
    if (spec.style.block || spec.style.short) s.push(block(spec.style.block || spec.style.short));
    s.push(`FORMAT: ${orientation(spec.format.ratio)}, ${spec.format.resolution}.`);
    const cam = camera.prose(spec.camera);
    s.push(`SHOT ${spec.code}${cam ? ` — ${cam}` : ''}.`);
    if (spec.composition) s.push(`COMPOSITION: ${trim(spec.composition)}`);
    if (spec.location?.block || spec.location?.short) s.push(`SCENE\n${block(spec.location.block || spec.location.short)}`);
    if (spec.light?.block || spec.light?.short) s.push(`LIGHT\n${block(spec.light.block || spec.light.short)}`);
    for (const c of spec.characters)
      s.push([`${c.code} — ${c.name.toUpperCase()}`, block(c.block || c.short), c.costume && `COSTUME: ${trim(c.costume)}`].filter(Boolean).join('\n'));
    for (const p of spec.props) s.push(block(p.block || `${p.code} ${p.name}: ${p.short}`));
    for (const r of Object.values(spec.rules.blocks ?? {})) if (r) s.push(block(r));
    if (spec.emotion) s.push(`MOOD: ${trim(spec.emotion)}`);
    s.push(`ACTION: ${trim(spec.action)}`);
    return {
      target: 'still',
      text: s.join('\n\n'),
      negative: spec.never,
      refs: spec.refs,
      notes: ['Charger les références AVANT de lancer. Le texte seul ne fige ni le corps, ni le costume, ni les objets.'],
    };
  },
};
