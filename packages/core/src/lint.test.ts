import { describe, expect, it } from 'vitest';
import { lint, contradicts } from './lint';
import { makeBible, scene, shot } from './fixtures';

const codes = (r: ReturnType<typeof lint>) => r.issues.map((i) => i.code);

describe('lint', () => {
  it('bloque un plan dont un personnage n’a pas de feuille', () => {
    const r = lint(makeBible(), [scene({ characterIds: ['c2'] })], [shot({ characterIds: ['c2'] })]);
    const i = r.issues.find((x) => x.code === 'character-no-ref');
    expect(i?.blocking).toBe(true);
    expect(r.blocking).toBeGreaterThan(0);
  });

  it('refuse un mouvement hors des règles', () => {
    expect(codes(lint(makeBible(), [scene()], [shot({ move: 'ORBIT' })]))).toContain('move-forbidden');
  });

  it('refuse un plan trop long', () => {
    expect(codes(lint(makeBible(), [scene()], [shot({ durationSec: 8 })]))).toContain('too-long');
  });

  it('refuse un duo interdit hors plan de groupe, le tolère en groupe', () => {
    const bible = makeBible();
    const pair = shot({ characterIds: ['c1', 'c3'] });
    expect(codes(lint(bible, [scene({ characterIds: ['c1', 'c3'] })], [pair]))).toContain('pair-forbidden');
    expect(codes(lint(bible, [scene({ characterIds: ['c1', 'c3'] })], [{ ...pair, isGroup: true, note: 'dos' }]))).toContain('pair-in-group');
  });

  it('signale une lumière de jour dans une scène de nuit', () => {
    expect(codes(lint(makeBible(), [scene({ timeOfDay: 'NIGHT' })], [shot()]))).toContain('light-vs-time');
  });

  it('signale un personnage de plan absent de la scène', () => {
    expect(codes(lint(makeBible(), [scene({ characterIds: ['c1'] })], [shot({ characterIds: ['c1', 'c2'] })]))).toContain('shot-cast-vs-scene');
  });

  it('un projet propre ne remonte aucune erreur', () => {
    const bible = makeBible();
    bible.characters[1].frozen = false; // CH2 gelé sans feuille : erreur légitime
    const r = lint(bible, [scene()], [shot()]);
    expect(r.issues.filter((i) => i.level === 'error')).toEqual([]);
  });

  it('contradicts', () => {
    expect(contradicts('NIGHT', 'DAY')).toBe(true);
    expect(contradicts('DAY', 'NIGHT')).toBe(true);
    expect(contradicts('DAY', 'GOLDEN')).toBe(false);
    expect(contradicts('CONTINUOUS', 'NIGHT')).toBe(false);
  });
});
