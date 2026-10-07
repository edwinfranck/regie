import { type Bible, type CharacterEntity, type LocationEntity, activeStyle, defaultLight } from './bible';
import type { CompiledPrompt } from './targets/types';
import { block, trim } from './targets/shared';

// Les prompts qui fabriquent les références elles-mêmes : feuille de
// personnage, plaque de décor, planche d'objets. Ce sont les images que tout
// le reste du projet charge ensuite, donc les seules qui se génèrent sans
// référence. C'est le socle du moteur de cohérence.

const out = (target: string, parts: (string | false | null | undefined)[], negative: string[], notes: string[] = []): CompiledPrompt => ({
  target,
  text: parts.filter(Boolean).join('\n\n'),
  negative: [...new Set(negative.map((n) => n.trim().toLowerCase()).filter(Boolean))],
  refs: [],
  notes,
});

const styleShort = (b: Bible) => {
  const s = activeStyle(b);
  return block(s.block || s.short);
};
const ruleBlocks = (b: Bible) => Object.values(b.project.rules.blocks ?? {}).map(block);

/** Les vues de cohérence qu'on peut demander pour un personnage (§9). */
export const CHARACTER_VIEWS = {
  sheet: 'Feuille de personnage (face, trois-quarts, dos)',
  portrait: 'Portrait neutre',
  expressions: 'Planche d’expressions',
  poses: 'Planche de poses',
  angles: 'Tête sous plusieurs angles',
  costume: 'Costume seul',
} as const;
export type CharacterView = keyof typeof CHARACTER_VIEWS;

const VIEW_TEXT: Record<CharacterView, string> = {
  sheet:
    'CHARACTER SHEET — one single image, plain light grey background, no scenery, no props. Three full-body views of the SAME person at the same scale, side by side: front view, three-quarter view, back view. Full body from head to feet in every view, nothing cropped. Neutral expression, arms relaxed at the sides, standing straight.',
  portrait:
    'PORTRAIT REFERENCE — one single image, plain light grey background. Head and shoulders, facing camera, neutral expression, even soft studio light, sharp focus on the face.',
  expressions:
    'EXPRESSION SHEET — one single image, plain light grey background, a 3x2 grid of head-and-shoulders views of the SAME person: neutral, joy, anger, sadness, fear, surprise. Identical face, hair and costume in every cell.',
  poses:
    'POSE SHEET — one single image, plain light grey background, four full-body poses of the SAME person at the same scale: walking, running, sitting, pointing. Identical face, hair and costume in every pose.',
  angles:
    'HEAD TURNAROUND — one single image, plain light grey background, five views of the SAME head at the same scale: front, three-quarter left, profile left, three-quarter right, back. Neutral expression.',
  costume:
    'COSTUME REFERENCE — one single image, plain light grey background, the costume alone laid out flat and on an invisible mannequin, front and back, no person.',
};

export function characterPrompt(bible: Bible, c: CharacterEntity, view: CharacterView = 'sheet'): CompiledPrompt {
  return out(
    `character:${view}`,
    [
      styleShort(bible),
      VIEW_TEXT[view],
      view !== 'costume' && `${c.code} — ${c.name.toUpperCase()}\n${block(c.block || c.short)}`,
      c.costume && `COSTUME: ${trim(c.costume)}`,
      c.silhouette && `SILHOUETTE MARKER: ${trim(c.silhouette)}`,
      ...ruleBlocks(bible),
    ],
    [...activeStyle(bible).never, ...c.never, 'cropped head', 'cropped feet', 'scenery', 'background objects', 'multiple different people', 'text', 'labels'],
    ['Aucune référence en entrée : c’est cette image qui deviendra la référence du personnage.'],
  );
}

export const LOCATION_VIEWS = {
  establishing: 'Plan d’ensemble (plaque)',
  interior: 'Intérieur',
  exterior: 'Extérieur',
  night: 'De nuit',
  rain: 'Sous la pluie',
} as const;
export type LocationView = keyof typeof LOCATION_VIEWS;

const LOC_TEXT: Record<LocationView, string> = {
  establishing: 'LOCATION PLATE — one single establishing image of the empty set, wide lens, eye level. No people in frame.',
  interior: 'LOCATION PLATE — interior view of the empty set, wide lens, showing the full depth of the room. No people in frame.',
  exterior: 'LOCATION PLATE — exterior view of the empty set, wide lens, showing its surroundings. No people in frame.',
  night: 'LOCATION PLATE — the same empty set at night, practical lights only. No people in frame.',
  rain: 'LOCATION PLATE — the same empty set in heavy rain, wet reflective surfaces. No people in frame.',
};

export function locationPrompt(bible: Bible, l: LocationEntity, view: LocationView = 'establishing'): CompiledPrompt {
  const light = defaultLight(bible);
  return out(
    `location:${view}`,
    [styleShort(bible), LOC_TEXT[view], block(l.block || l.short), view === 'establishing' && light && block(light.block || light.short)],
    [...activeStyle(bible).never, ...l.never, 'people', 'characters', 'silhouettes', 'text', 'labels'],
  );
}

export function propsSheetPrompt(bible: Bible): CompiledPrompt {
  const props = bible.props.filter((p) => p.kind !== 'COSTUME');
  return out(
    'props_sheet',
    [
      styleShort(bible),
      `PROP SHEET — one single image, plain light grey background. The ${props.length} objects below laid out in a grid, isolated, at a COMMON scale so their relative sizes read correctly. No hands, no people, no scenery.`,
      ...props.map((p) => block(p.block || `${p.code} ${p.name}: ${p.short}`)),
    ],
    [...activeStyle(bible).never, 'hands', 'people', 'scenery', 'text', 'labels', 'brand logos'],
  );
}

export function lineupPrompt(bible: Bible): CompiledPrompt {
  const cast = bible.characters.filter((c) => c.frozen !== false).sort((a, b) => (b.heightM ?? 0) - (a.heightM ?? 0));
  return out(
    'lineup',
    [
      styleShort(bible),
      'HEIGHT LINEUP — one single image, plain light grey background, all characters standing on the SAME ground line at the SAME scale, front view, full body, side by side, tallest to shortest.',
      cast.map((c) => `${c.code} ${c.name}${c.heightM ? ` — ${c.heightM} m` : ''} — ${trim(c.short)}`).join('\n'),
      ...ruleBlocks(bible),
    ],
    [...activeStyle(bible).never, 'different ground lines', 'perspective distortion', 'cropped feet', 'text', 'labels'],
    cast.length ? [] : ['Aucun personnage gelé : cocher « gelé » sur les fiches à inclure.'],
  );
}
