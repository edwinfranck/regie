import { activeLook } from './film.mjs';

const trim = (s) => (s || '').trim();

// Les prompts qui fabriquent les references elles-memes : feuille de
// personnage, plaque de decor, planche d'objets. Ce sont les images que
// tout le reste du projet charge ensuite, donc les seules qui se generent
// sans reference.
export function charSheetPrompt(bible, c) {
  const look = activeLook(bible);
  const r = bible.rules?.blocks || {};
  return {
    text: [
      look.short,
      'CHARACTER SHEET — one single image, plain light grey background, no scenery, no props.',
      'Three full-body views of the SAME man at the same scale, side by side: front view, three-quarter view, back view. Full body from head to feet in every view, nothing cropped. Neutral expression, arms relaxed at the sides, standing straight.',
      trim(c.block),
      `COSTUME: ${trim(c.costume)}`,
      trim(r.build),
      trim(r.handedness),
    ].filter(Boolean).join('\n\n'),
    negative: [...(look.never || []), ...(c.never || []), 'cropped head', 'cropped feet', 'close-up', 'scenery', 'background objects', 'multiple different men', 'text', 'labels'],
  };
}

export function locationPlatePrompt(bible, l) {
  const look = activeLook(bible);
  const light = bible.light[bible.light.DAY ? 'DAY' : Object.keys(bible.light)[0]];
  return {
    text: [
      look.short,
      'LOCATION PLATE — one single establishing image of the empty set. No people in frame.',
      trim(l.block),
      trim(light.block),
    ].filter(Boolean).join('\n\n'),
    negative: [...(look.never || []), ...(l.never || []), 'people', 'characters', 'silhouettes', 'text', 'labels'],
  };
}

export function propsSheetPrompt(bible) {
  const look = activeLook(bible);
  const props = Object.entries(bible.props).map(([id, p]) => `${trim(p.block)}`);
  return {
    text: [
      look.short,
      `PROP SHEET — one single image, plain light grey background. The ${props.length} objects below laid out in a grid, isolated, at a COMMON scale so their relative sizes read correctly. No hands, no people, no scenery.`,
      ...props,
    ].join('\n\n'),
    negative: [...(look.never || []), 'hands', 'people', 'scenery', 'text', 'labels', 'brand logos'],
  };
}

export function lineupPrompt(bible) {
  const look = activeLook(bible);
  const cast = Object.entries(bible.characters).filter(([, c]) => c.frozen !== false)
    .sort((a, b) => b[1].height_m - a[1].height_m);
  return {
    text: [
      look.short,
      'HEIGHT LINEUP — one single image, plain light grey background, all characters standing on the SAME ground line at the SAME scale, front view, full body, side by side, tallest to shortest.',
      cast.map(([id, c]) => `${id} ${c.name} — ${c.height_m} m — ${trim(c.short)}`).join('\n'),
      trim(bible.rules?.blocks?.build),
    ].filter(Boolean).join('\n\n'),
    negative: [...(look.never || []), 'different ground lines', 'perspective distortion', 'cropped feet', 'text', 'labels'],
  };
}
