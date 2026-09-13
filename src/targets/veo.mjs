import { sentence, cap, trim, castLine, propsLine, camera, LIPSYNC, shotTag } from './_shared.mjs';

// Veo : prose cinematographique d'un seul tenant. Les listes de mots-cles
// y donnent de moins bons resultats que les phrases.
export default {
  id: 'veo', label: 'Veo (image-to-video, prose)', kind: 'video',
  render(spec) {
    const p = [
      sentence(camera.prose(spec.camera)),
      cap(spec.action),
      spec.characters.length ? `In frame: ${castLine(spec)}` : '',
      spec.props.length ? `Props: ${propsLine(spec)}` : '',
      cap(spec.location.short),
      cap(spec.light.short),
      cap(spec.motion.short),
      LIPSYNC,
      sentence(`Rendered in ${trim(spec.look.short)}`),
      `Duration ${spec.duration} seconds, ${spec.format.ratio} vertical.`,
    ].filter(Boolean);
    return {
      text: p.join(' '),
      negative: spec.neverVideo,
      refs: [`[image fixe du plan ${shotTag(spec)}]  (frame de depart)`],
      notes: ['Cible image-to-video : partir de l’image fixe compilee par la cible "still".'],
    };
  },
};
