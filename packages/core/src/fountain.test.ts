import { describe, expect, it } from 'vitest';
import { parseFountain, toFountain, scenesOf, parseHeading, scriptStats } from './fountain';

const SRC = `INT. CUISINE - NUIT

Marie entre, trempée.

MARIE
(essoufflée)
Il est là ?

PAUL
Non.

CUT TO:

EXT. RUE - JOUR

La pluie tombe.
`;

describe('Fountain', () => {
  it('reconnaît les éléments', () => {
    const els = parseFountain(SRC);
    expect(els.map((e) => e.type)).toEqual([
      'scene_heading', 'action', 'character', 'parenthetical', 'dialogue', 'character', 'dialogue', 'transition', 'scene_heading', 'action',
    ]);
  });

  it('fait l’aller-retour sans perte', () => {
    const els = parseFountain(SRC);
    expect(parseFountain(toFountain(els))).toEqual(els);
  });

  it('découpe en scènes avec la distribution', () => {
    const sc = scenesOf(parseFountain(SRC));
    expect(sc).toHaveLength(2);
    expect(sc[0].characters).toEqual(['MARIE', 'PAUL']);
    expect(sc[0].parsed).toEqual({ setting: 'INT', location: 'CUISINE', timeOfDay: 'NUIT' });
  });

  it('lit les en-têtes INT./EXT.', () => {
    expect(parseHeading('INT./EXT. VOITURE - CONTINUOUS').setting).toBe('INT_EXT');
  });

  it('force une action qui ressemble à un personnage', () => {
    const out = toFountain([{ type: 'action', text: 'BOUM' }]);
    expect(parseFountain(out)[0]).toEqual({ type: 'action', text: 'BOUM' });
  });

  it('compte les répliques par personnage', () => {
    expect(Object.keys(scriptStats(parseFountain(SRC)).dialogueBySpeaker)).toEqual(['MARIE', 'PAUL']);
  });
});
