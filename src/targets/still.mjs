import { block, trim, refsList, camera, shotTag } from './_shared.mjs';

// Image fixe d'un plan. Sortie la plus verbeuse des cinq : un generateur
// d'images accepte un cahier des charges, un generateur video non.
export default {
  id: 'still', label: 'Image fixe du plan', kind: 'image',
  render(spec) {
    const s = [];
    s.push(block(spec.look.short));
    s.push(`FORMAT: ${spec.format.ratio} vertical, ${spec.format.resolution}.`);
    s.push(`SHOT ${shotTag(spec)} — ${camera.prose(spec.camera)}.`);
    s.push(`SCENE\n${block(spec.location.block)}`);
    s.push(`LIGHT\n${block(spec.light.block)}`);
    for (const c of spec.characters) s.push(`${c.id} — ${c.name.toUpperCase()}\n${block(c.block)}\nCOSTUME: ${trim(c.costume)}`);
    for (const p of spec.props) s.push(block(p.block));
    for (const r of Object.values(spec.rules.blocks || {})) s.push(block(r));
    s.push(`ACTION: ${trim(spec.action)}`);
    return {
      text: s.join('\n\n'),
      negative: spec.never,
      refs: refsList(spec),
      notes: ['Charger les references ci-dessous AVANT de lancer. Le texte seul ne fige ni le corps, ni le costume, ni les objets.'],
    };
  },
};
