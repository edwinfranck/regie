import type { Target } from './types';
import { cap, camera, castTag, sentence, speech, trim } from './shared';

// Runway Gen-4 : l'image de départ porte déjà le sujet et le décor. Le prompt
// ne décrit que ce qui bouge — la caméra, puis l'action — et reste sous la
// limite de 1000 caractères de l'API.
export const runway: Target = {
  id: 'runway',
  label: 'Mouvement seul (Runway)',
  kind: 'video',
  variant: 'concise',
  engines: ['runway'],
  render(spec) {
    let text = [
      cap(camera.prose(spec.camera)),
      cap(spec.action),
      spec.characters.length > 1 ? castTag(spec) : '',
      spec.emotion ? sentence(`Mood: ${trim(spec.emotion)}`) : '',
      speech(spec, true),
    ]
      .filter(Boolean)
      .join(' ');
    const notes = ['Runway ignore les négatifs : tout ce qui est interdit doit être absent de l’image de départ.'];
    if (text.length > 1000) {
      text = text.slice(0, 997) + '…';
      notes.push('Tronqué à 1000 caractères (limite de l’API).');
    }
    return { target: 'runway', text, negative: [], refs: [], startFrame: `image fixe du plan ${spec.code}`, notes };
  },
};
