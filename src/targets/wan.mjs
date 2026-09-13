import { trim, castLine, propsLine, camera, LIPSYNC } from './_shared.mjs';

// Wan / LTX et les moteurs open source : champs structures + negative prompt
// separe, comme une interface ComfyUI l'attend.
export default {
  id: 'wan', label: 'Wan / LTX (structure, negative prompt separe)', kind: 'video',
  render(spec) {
    const fields = [
      ['camera', camera.keywords(spec.camera).join(', ')],
      ['subject', castLine(spec) || trim(spec.location.short)],
      ['action', trim(spec.action)],
      ['setting', trim(spec.location.short)],
      ['props', propsLine(spec)],
      ['lighting', trim(spec.light.short)],
      ['style', trim(spec.look.short)],
      ['motion', `${trim(spec.motion.short)} ${LIPSYNC}`],
      ['duration', `${spec.duration}s, ${spec.format.ratio}`],
    ].filter(([, v]) => v);
    return {
      text: fields.map(([k, v]) => `${k}: ${v}`).join('\n'),
      negative: spec.neverVideo,
      refs: ['[image fixe du plan]  (init image)'],
      notes: ['Coller la ligne "negative" dans le champ negative prompt, pas dans le prompt.'],
    };
  },
};
