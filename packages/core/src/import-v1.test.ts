import { describe, expect, it } from 'vitest';
import { importV1 } from './import-v1';

const BIBLE = `
film: { title: "Le Fil", format: { ratio: "9:16", resolution: "1080x1920" } }
look:
  active: S2
  never: [text]
  variants:
    S1: { name: Comic, short: comic }
    S2: { name: Anime, short: anime }
rules: { max_characters_per_shot: 2, never_together: [[CH1, CH2]] }
motion: { clip_seconds: [2, 4], allowed_moves: [STATIC, PUSH_IN_SLOW] }
light: { DAY: { short: day }, NIGHT: { short: night } }
characters:
  CH1: { name: Awa, short: "CH1 Awa", block: "woman", ref: refs/ch1.png, frozen: true, height_m: 1.6 }
locations:
  L1: { name: Cour, block: "yard", ref: refs/l1.png }
  L2: { name: Case, block: "hut" }
props: {}
`;
const PLANS = `
episode: { id: EP1, light: DAY, target_seconds: 60 }
shots:
  - { id: 1, duration: 3, location: L1, characters: [CH1], camera: { size: WS, move: PUSH_IN_SLOW }, action: "a" }
  - { id: 2, duration: 3, location: L1, characters: [CH1], camera: { size: CU, angle: OTS }, action: "b" }
  - { id: 3, duration: 3, location: L2, characters: [], camera: { size: WS }, action: "c" }
sheets: [{ id: P1, shots: [1, 2] }]
`;

describe('import v0.1', () => {
  const out = importV1(BIBLE, PLANS);
  it('reprend le style actif', () => {
    expect(out.styles.find((s) => s.active)?.code).toBe('S2');
    expect(out.styles[0].never).toContain('text');
  });
  it('regroupe les plans par lieu en scènes', () => {
    expect(out.scenes.map((s) => s.locationCode)).toEqual(['L1', 'L2']);
    expect(out.shots.map((s) => s.sceneNumber)).toEqual([1, 1, 2]);
  });
  it('traduit le vocabulaire caméra', () => {
    expect(out.shots[0].move).toBe('PUSH_IN');
    expect(out.shots[1].size).toBe('OTS');
    expect(out.motion.allowedMoves).toEqual(['STATIC', 'PUSH_IN']);
  });
  it('garde les chemins de référence et les règles', () => {
    expect(out.characters[0].refPath).toBe('refs/ch1.png');
    expect(out.rules.neverTogether).toEqual([['CH1', 'CH2']]);
    expect(out.lights.find((l) => l.isDefault)?.code).toBe('DAY');
  });
});
