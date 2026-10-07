import type { Target } from './types';
import { camera, castLine, propsLine, speech, trim } from './shared';

// Wan / LTX et les moteurs open source : champs structurés + negative prompt
// séparé, comme une interface ComfyUI l'attend.
export const wan: Target = {
  id: 'wan',
  label: 'Technique — champs structurés (Wan, LTX, ComfyUI)',
  kind: 'video',
  variant: 'technical',
  engines: ['comfyui'],
  render(spec) {
    const fields: [string, string][] = [
      ['camera', camera.keywords(spec.camera).join(', ')],
      ['subject', castLine(spec) || trim(spec.location?.short)],
      ['action', trim(spec.action)],
      ['setting', trim(spec.location?.short)],
      ['props', propsLine(spec)],
      ['lighting', trim(spec.light?.short)],
      ['mood', trim(spec.emotion)],
      ['style', trim(spec.style.short)],
      ['motion', `${trim(spec.motion.short)} ${speech(spec)}`.trim()],
      ['duration', `${spec.duration}s, ${spec.format.ratio}`],
    ];
    return {
      target: 'wan',
      text: fields
        .filter(([, v]) => v)
        .map(([k, v]) => `${k}: ${v}`)
        .join('\n'),
      negative: spec.neverVideo,
      refs: spec.refs,
      startFrame: `image fixe du plan ${spec.code}`,
      notes: ['Coller la liste négative dans le champ negative prompt, pas dans le prompt.'],
    };
  },
};
