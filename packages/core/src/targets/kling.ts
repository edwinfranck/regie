import type { Target } from './types';
import { cap, castTag, camera, sentence, speech, words } from './shared';

// Kling / Hailuo : prompt court. Au-delà d'environ 70 mots le moteur décroche
// et l'action se dilue. Les personnages sont identifiés par leur marqueur de
// silhouette, pas par leur description complète.
export const kling: Target = {
  id: 'kling',
  label: 'Concis — mouvement explicite (Kling, Hailuo)',
  kind: 'video',
  variant: 'concise',
  engines: ['fal', 'replicate'],
  render(spec) {
    const still = !spec.camera.move || spec.camera.move === 'STATIC';
    const text = [
      sentence(camera.keywords(spec.camera).join(', ')),
      cap(spec.action),
      spec.characters.length ? castTag(spec) : cap(spec.location?.short),
      still ? 'Single action only, minimal movement, camera does not move.' : 'Single action only.',
      speech(spec, true),
    ]
      .filter(Boolean)
      .join(' ');
    const n = words(text);
    return {
      target: 'kling',
      text,
      negative: spec.neverVideo.slice(0, 12),
      refs: spec.refs.filter((r) => r.kind === 'character'),
      startFrame: `image fixe du plan ${spec.code}`,
      notes: [
        n > 70 ? `${n} mots — au-delà de 70 ce moteur dilue l’action, raccourcir.` : `${n} mots.`,
        'Négatifs tronqués à 12 : ce moteur ignore les listes longues.',
      ],
    };
  },
};
