import type { Bible, SceneInput, ShotInput } from './bible';

// Une bible minimale mais complète, partagée par les tests.
export function makeBible(over: Partial<Bible['project']> = {}): Bible {
  return {
    project: {
      id: 'p1',
      title: 'Test',
      aspectRatio: '9:16',
      resolution: '1080x1920',
      fps: 24,
      language: 'fr',
      rules: { maxCharactersPerShot: 2, neverTogether: [['CH1', 'CH3']] },
      motion: { clipSeconds: [2, 4], allowedMoves: ['STATIC', 'PUSH_IN'], short: 'Minimal motion.', never: ['fast camera moves'] },
      ...over,
    },
    styles: [{ id: 's1', code: 'S1', name: 'Anime', short: 'flat anime cel shading', block: 'LOOK: flat anime cel shading, clean lines.', never: ['photorealistic'], active: true }],
    lights: [
      { id: 'l-day', code: 'DAY', name: 'Jour', short: 'soft daylight', block: 'Soft overcast daylight.', never: [], isDefault: true },
      { id: 'l-night', code: 'NIGHT', name: 'Nuit', short: 'moonlight', block: 'Cold moonlight.', never: ['sun'], isDefault: false },
    ],
    characters: [
      { id: 'c1', code: 'CH1', name: 'Marie Dubois', short: 'CH1 Marie, 1.65m, short black hair.', block: 'Woman, 30, short black bob.', costume: 'red raincoat', silhouette: 'red raincoat', never: ['long hair'], heightM: 1.65, frozen: true, refAssetId: 'a-c1' },
      { id: 'c2', code: 'CH2', name: 'Paul', short: 'CH2 Paul, 1.90m, beard.', block: 'Man, 40, thick beard.', costume: 'grey suit', silhouette: 'very tall, beard', never: [], heightM: 1.9, frozen: true, refAssetId: null },
      { id: 'c3', code: 'CH3', name: 'Mira', short: 'CH3 Mira.', block: 'Woman, 30, short black bob.', costume: 'blue coat', silhouette: 'blue coat', never: [], heightM: 1.64, frozen: false },
    ],
    locations: [{ id: 'loc1', code: 'L1', name: 'Rue', short: 'a narrow Paris street', block: 'Narrow cobbled Paris street, wet.', never: ['cars'], interior: false, frozen: true, refAssetId: 'a-l1', sound: 'rain on cobbles' }],
    props: [{ id: 'pr1', code: 'P1', name: 'Parapluie', short: 'black umbrella', block: 'P1 black umbrella, wooden handle.', never: [], kind: 'PROP' }],
  };
}

export const scene = (over: Partial<SceneInput> = {}): SceneInput => ({
  id: 'sc1',
  number: 1,
  title: 'La rue',
  setting: 'EXT',
  timeOfDay: 'DAY',
  description: '',
  locationId: 'loc1',
  lightId: 'l-day',
  characterIds: ['c1'],
  ...over,
});

export const shot = (over: Partial<ShotInput> = {}): ShotInput => ({
  id: 'sh1',
  code: '1A',
  sceneId: 'sc1',
  order: 0,
  description: '',
  action: 'Marie walks under the rain.',
  size: 'MS',
  angle: 'EYE',
  lens: '35mm',
  move: 'STATIC',
  durationSec: 3,
  isGroup: false,
  characterIds: ['c1'],
  propIds: [],
  ...over,
});
