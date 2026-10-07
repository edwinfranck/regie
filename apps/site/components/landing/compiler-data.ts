// Sorties réelles de packages/core (resolveShot + compile) sur la bible de
// test du dépôt (packages/core/src/fixtures.ts), format 16:9. Rien d'inventé :
// à régénérer si le compilateur change.
export const TARGETS = [
  {
    id: 'still',
    label: 'Image fixe',
    engines: 'gpt-image, Imagen, Flux…',
    text: `LOOK: flat anime cel shading, clean lines.

FORMAT: 16:9 horizontal, 1920x1080.

SHOT 1A — medium shot, waist up, camera at eye level, shot on a 35mm lens, camera locked off, completely static.

SCENE
Narrow cobbled Paris street, wet.

LIGHT
Soft overcast daylight.

CH1 — MARIE DUBOIS
Woman, 30, short black bob.
COSTUME: red raincoat

P1 black umbrella, wooden handle.

ACTION: Marie walks under the rain.`,
    negative: 'photorealistic, long hair, cars',
  },
  {
    id: 'veo',
    label: 'Cinématique',
    engines: 'Veo, Luma, Sora',
    text: `Medium shot, waist up, camera at eye level, shot on a 35mm lens, camera locked off, completely static. Marie walks under the rain. In frame: CH1 Marie, 1.65m, short black hair. Props: P1 black umbrella. A narrow Paris street. Soft daylight. Minimal motion. Mouth stays closed and neutral, no speech, no mouth movement. Rendered in flat anime cel shading. Duration 3 seconds, 16:9 horizontal.`,
    negative: 'photorealistic, long hair, cars, fast camera moves',
  },
  {
    id: 'kling',
    label: 'Concise',
    engines: 'Kling, Hailuo',
    text: `medium shot, eye level, 35mm lens, static camera. Marie walks under the rain. CH1 Marie Dubois, red raincoat. Single action only, minimal movement, camera does not move. Mouth closed, no speech.`,
    negative: 'photorealistic, long hair, cars, fast camera moves',
  },
  {
    id: 'wan',
    label: 'Technique',
    engines: 'Wan, LTX, ComfyUI',
    text: `camera: medium shot, eye level, 35mm lens, static camera
subject: CH1 Marie, 1.65m, short black hair.
action: Marie walks under the rain.
setting: a narrow Paris street
props: P1 black umbrella.
lighting: soft daylight
style: flat anime cel shading
motion: Minimal motion. Mouth stays closed and neutral, no speech, no mouth movement.
duration: 3s, 16:9`,
    negative: 'photorealistic, long hair, cars, fast camera moves',
  },
] as const;

export const BIBLE: { code: string; kind: string; lines: [string, string][] }[] = [
  { code: 'S1', kind: 'Style', lines: [['block', 'LOOK: flat anime cel shading, clean lines.'], ['never', 'photorealistic']] },
  {
    code: 'CH1',
    kind: 'Personnage',
    lines: [
      ['block', 'Woman, 30, short black bob.'],
      ['costume', 'red raincoat'],
      ['never', 'long hair'],
      ['ref', 'feuille de personnage'],
    ],
  },
  { code: 'L1', kind: 'Lieu', lines: [['block', 'Narrow cobbled Paris street, wet.'], ['never', 'cars'], ['ref', 'plaque du lieu']] },
  { code: 'P1', kind: 'Objet', lines: [['block', 'P1 black umbrella, wooden handle.']] },
  { code: '1A', kind: 'Plan', lines: [['cadre', 'plan taille, 35 mm, fixe'], ['action', 'Marie walks under the rain.']] },
];
