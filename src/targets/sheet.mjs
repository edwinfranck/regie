import { block, trim, refsList, camera, shotTag } from './_shared.mjs';

// Planche storyboard multi-cases. La lecon du projet : dans une seule passe,
// le modele dessine les cases avec le meme personnage. Vingt generations
// isolees donnent vingt personnages differents.
export default {
  id: 'sheet', label: 'Planche storyboard multi-cases', kind: 'image', multi: true,
  render(specs, sheet) {
    const first = specs[0];
    const chars = dedupeBy(specs.flatMap((s) => s.characters), 'id');
    const props = dedupeBy(specs.flatMap((s) => s.props), 'id');
    const locs  = dedupeBy(specs.map((s) => s.location), 'id');

    const s = [];
    s.push(block(first.look.short));
    s.push(`STORYBOARD SHEET ${sheet.id} — ${specs.length} panels in a single image, arranged in a ${grid(specs.length)} grid, thin white gutters between panels, no borders drawn inside a panel, no numbers, no text, no speech bubbles. Every panel is ${first.format.ratio} vertical. The SAME characters appear in every panel and must be identical from panel to panel.`);
    for (const l of locs) s.push(`SETTING\n${block(l.block)}`);
    s.push(`LIGHT\n${block(first.light.block)}`);
    for (const c of chars) s.push(`${c.id} — ${c.name.toUpperCase()}\n${block(c.block)}\nCOSTUME: ${trim(c.costume)}`);
    for (const p of props) s.push(block(p.block));
    for (const r of Object.values(first.rules.blocks || {})) s.push(block(r));
    s.push(specs.map((sp, i) => `PANEL ${i + 1} (${shotTag(sp)}) — ${camera.prose(sp.camera)}. ${trim(sp.action)}`).join('\n'));

    return {
      text: s.join('\n\n'),
      negative: first.never,
      refs: dedupeBy(specs.flatMap((sp) => refsList(sp).map((path) => ({ id: path, path }))), 'id').map((r) => r.path),
      notes: [`${specs.length} cases : plans ${specs.map((sp) => sp.id).join(', ')}.`, 'Une seule passe. Ne jamais regenerer une case seule : elle reviendra differente.'],
    };
  },
};

const grid = (n) => (n <= 2 ? '1x2' : n <= 4 ? '2x2' : n <= 6 ? '2x3' : '3x3');
const dedupeBy = (arr, k) => [...new Map(arr.map((x) => [x[k], x])).values()];
