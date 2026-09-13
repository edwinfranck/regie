import { sentence, cap, trim, castTag, camera, LIPSYNC_SHORT } from './_shared.mjs';

// Kling / Hailuo : prompt court. Au-dela d'environ 70 mots le moteur decroche
// et l'action se dilue. On identifie donc les personnages par leur marqueur de
// silhouette, pas par leur description complete.
export default {
  id: 'kling', label: 'Kling / Hailuo (court, mouvement explicite)', kind: 'video',
  render(spec) {
    const text = [
      sentence(camera.keywords(spec.camera).join(', ')),
      cap(spec.action),
      spec.characters.length ? castTag(spec) : cap(spec.location.short),
      'Single action only, minimal movement, camera does not move.',
      LIPSYNC_SHORT,
    ].filter(Boolean).join(' ');
    const words = text.split(/\s+/).length;
    return {
      text,
      negative: spec.neverVideo.slice(0, 12),
      refs: ['[image fixe du plan]  (frame de depart)'],
      notes: [
        words > 70 ? `${words} mots — au-dela de 70 ce moteur dilue l’action, raccourcir.` : `${words} mots.`,
        'Negatifs tronques a 12 : ce moteur ignore les listes longues.',
      ],
    };
  },
};
