import type { ShotSpec } from '../context';
import type { MultiTarget } from './types';
import { block, camera, orientation, trim } from './shared';

// Planche storyboard multi-cases. La leçon de régie v0.1 : dans une seule
// passe, le modèle dessine toutes les cases avec le même personnage. Vingt
// générations isolées donnent vingt personnages différents.
export const sheet: MultiTarget = {
  id: 'sheet',
  label: 'Planche storyboard multi-cases',
  kind: 'image',
  render(specs: ShotSpec[], title: string) {
    if (!specs.length) throw new Error('Une planche demande au moins un plan.');
    const first = specs[0];
    const chars = dedupeBy(specs.flatMap((s) => s.characters), 'id');
    const props = dedupeBy(specs.flatMap((s) => s.props), 'id');
    const locs = dedupeBy(specs.map((s) => s.location).filter((l): l is NonNullable<typeof l> => !!l && !!l.id), 'id');

    const s: string[] = [];
    if (first.style.block || first.style.short) s.push(block(first.style.block || first.style.short));
    s.push(
      `STORYBOARD SHEET ${title} — ${specs.length} panels in a single image, arranged in a ${grid(specs.length)} grid, thin white gutters between panels, no borders drawn inside a panel, no numbers, no text, no speech bubbles. Every panel is ${orientation(first.format.ratio)}. The SAME characters appear in every panel and must be identical from panel to panel.`,
    );
    for (const l of locs) s.push(`SETTING\n${block(l.block || l.short)}`);
    if (first.light) s.push(`LIGHT\n${block(first.light.block || first.light.short)}`);
    for (const c of chars) s.push([`${c.code} — ${c.name.toUpperCase()}`, block(c.block || c.short), c.costume && `COSTUME: ${trim(c.costume)}`].filter(Boolean).join('\n'));
    for (const p of props) s.push(block(p.block || p.short));
    for (const r of Object.values(first.rules.blocks ?? {})) if (r) s.push(block(r));
    s.push(specs.map((sp, i) => `PANEL ${i + 1} (${sp.code}) — ${camera.prose(sp.camera)}. ${trim(sp.action)}`).join('\n'));

    return {
      target: 'sheet',
      text: s.join('\n\n'),
      negative: first.never,
      refs: dedupeBy(specs.flatMap((sp) => sp.refs), 'id'),
      notes: [
        `${specs.length} cases : plans ${specs.map((sp) => sp.code).join(', ')}.`,
        'Une seule passe. Ne jamais régénérer une case seule : elle reviendrait différente.',
      ],
    };
  },
};

const grid = (n: number) => (n <= 2 ? '1x2' : n <= 4 ? '2x2' : n <= 6 ? '2x3' : n <= 9 ? '3x3' : '3x4');
const dedupeBy = <T, K extends keyof T>(arr: T[], k: K) => [...new Map(arr.map((x) => [x[k], x])).values()];
