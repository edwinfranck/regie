import type { Target } from './types';
import { cap, castLine, camera, orientation, propsLine, sentence, speech, trim } from './shared';

// Prose cinématographique d'un seul tenant (Veo, Sora, Luma). Les listes de
// mots-clés y donnent de moins bons résultats que les phrases.
export const veo: Target = {
  id: 'veo',
  label: 'Cinématique — prose (Veo, Luma, Sora)',
  kind: 'video',
  variant: 'cinematic',
  engines: ['google', 'luma', 'openai'],
  render(spec) {
    const p = [
      cap(camera.prose(spec.camera)),
      cap(spec.action),
      spec.characters.length ? `In frame: ${castLine(spec)}` : '',
      spec.props.length ? `Props: ${propsLine(spec)}` : '',
      cap(spec.location?.short),
      cap(spec.light?.short),
      spec.emotion ? sentence(`The mood is ${trim(spec.emotion)}`) : '',
      cap(spec.motion.short),
      speech(spec),
      spec.style.short ? sentence(`Rendered in ${trim(spec.style.short)}`) : '',
      `Duration ${spec.duration} seconds, ${orientation(spec.format.ratio)}.`,
    ].filter(Boolean);
    return {
      target: 'veo',
      text: p.join(' '),
      negative: spec.neverVideo,
      refs: spec.refs,
      startFrame: `image fixe du plan ${spec.code}`,
      notes: ['Image-to-video : partir de l’image fixe compilée par la cible « still ».'],
    };
  },
};
