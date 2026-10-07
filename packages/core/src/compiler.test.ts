import { describe, expect, it } from 'vitest';
import { resolveShot, detectEntities } from './context';
import { compile, compileAll, sheet } from './targets';
import { characterPrompt, lineupPrompt } from './references';
import { makeBible, scene, shot } from './fixtures';
import { shotCode, nextCode } from './codes';

describe('Context Builder', () => {
  it('hérite du lieu et de la lumière de la scène', () => {
    const spec = resolveShot(makeBible(), shot(), scene());
    expect(spec.location?.code).toBe('L1');
    expect(spec.light?.code).toBe('DAY');
    expect(spec.sound).toBe('rain on cobbles');
  });

  it('sépare les négatifs image et vidéo', () => {
    const spec = resolveShot(makeBible(), shot(), scene());
    expect(spec.never).toContain('long hair');
    expect(spec.never).not.toContain('fast camera moves');
    expect(spec.neverVideo).toContain('fast camera moves');
  });

  it('liste les références dans l’ordre personnages, lieu', () => {
    const spec = resolveShot(makeBible(), shot(), scene());
    expect(spec.refs.map((r) => r.id)).toEqual(['CH1', 'L1']);
  });

  it('refuse un personnage absent de la bible', () => {
    expect(() => resolveShot(makeBible(), shot({ characterIds: ['nope'] }), scene())).toThrow(/absent/);
  });

  it('repère les entités dans une demande libre', () => {
    const hits = detectEntities(makeBible(), 'Marie marche dans la rue sous la pluie avec le parapluie.');
    expect(hits.characters.map((c) => c.code)).toEqual(['CH1']);
    expect(hits.locations.map((l) => l.code)).toEqual(['L1']);
    expect(hits.props.map((p) => p.code)).toEqual(['P1']);
  });
});

describe('Prompt Compiler', () => {
  const spec = resolveShot(makeBible(), shot(), scene());

  it('still injecte le bloc gelé, le costume et le format', () => {
    const p = compile(spec, 'still');
    expect(p.text).toContain('Woman, 30, short black bob.');
    expect(p.text).toContain('COSTUME: red raincoat');
    expect(p.text).toContain('9:16 vertical');
  });

  it('kling reste court et tronque les négatifs', () => {
    const p = compile(spec, 'kling');
    expect(p.text.split(/\s+/).length).toBeLessThan(70);
    expect(p.negative.length).toBeLessThanOrEqual(12);
  });

  it('un plan sans dialogue interdit le mouvement des lèvres, un plan dialogué le demande', () => {
    expect(compile(spec, 'veo').text).toContain('no speech');
    const talk = resolveShot(makeBible(), shot({ dialogue: 'Viens.' }), scene());
    expect(compile(talk, 'veo').text).toContain('speaks: "Viens."');
  });

  it('une réécriture manuelle l’emporte', () => {
    const edited = resolveShot(makeBible(), shot({ overrides: { veo: 'my own prompt' } }), scene());
    const p = compile(edited, 'veo');
    expect(p.text).toBe('my own prompt');
    expect(p.edited).toBe(true);
  });

  it('compile toutes les cibles', () => {
    expect(Object.keys(compileAll(spec)).sort()).toEqual(['kling', 'runway', 'still', 'veo', 'wan']);
  });

  it('la planche décrit chaque personnage une seule fois', () => {
    const a = resolveShot(makeBible(), shot(), scene());
    const b = resolveShot(makeBible(), shot({ id: 'sh2', code: '1B', size: 'CU' }), scene());
    const p = sheet.render([a, b], 'P1');
    expect(p.text.match(/CH1 — MARIE DUBOIS/g)).toHaveLength(1);
    expect(p.text).toContain('PANEL 2 (1B)');
  });

  it('les prompts de référence ne demandent aucune référence', () => {
    const b = makeBible();
    expect(characterPrompt(b, b.characters[0]).refs).toEqual([]);
    expect(lineupPrompt(b).text.indexOf('CH2')).toBeLessThan(lineupPrompt(b).text.indexOf('CH1'));
  });
});

describe('codes', () => {
  it('numérote les plans en lettres', () => {
    expect(shotCode(12, 0)).toBe('12A');
    expect(shotCode(12, 25)).toBe('12Z');
    expect(shotCode(12, 26)).toBe('12AA');
  });
  it('trouve le prochain code libre', () => {
    expect(nextCode('CH', ['CH1', 'CH4'])).toBe('CH5');
    expect(nextCode('L', [])).toBe('L1');
  });
});
