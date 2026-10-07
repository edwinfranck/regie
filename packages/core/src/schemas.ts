import { z } from 'zod';

// Les schémas de validation partagés entre les formulaires (client) et les
// route handlers (serveur). Une seule définition : ce que l'interface accepte
// est exactement ce que l'API accepte.

const text = (max = 20000) => z.string().max(max);
const opt = (max = 20000) => z.string().max(max).nullish();
const never = z.array(z.string().max(200)).max(80);

export const PROJECT_KINDS = [
  'FEATURE',
  'SHORT',
  'SERIES',
  'EPISODE',
  'COMMERCIAL',
  'MUSIC_VIDEO',
  'ANIMATION',
  'ANIME',
  'DOCUMENTARY',
  'EXPERIMENTAL',
  'VERTICAL',
  'SOCIAL',
] as const;

export const KIND_LABELS: Record<(typeof PROJECT_KINDS)[number], string> = {
  FEATURE: 'Long-métrage',
  SHORT: 'Court-métrage',
  SERIES: 'Série',
  EPISODE: 'Épisode',
  COMMERCIAL: 'Publicité',
  MUSIC_VIDEO: 'Clip musical',
  ANIMATION: 'Animation',
  ANIME: 'Anime',
  DOCUMENTARY: 'Documentaire',
  EXPERIMENTAL: 'Film expérimental',
  VERTICAL: 'Vidéo verticale',
  SOCIAL: 'Contenu social',
};

export const STAGES = ['IDEA', 'DEVELOPMENT', 'PRE_PRODUCTION', 'PRODUCTION', 'POST_PRODUCTION', 'COMPLETED'] as const;
export const STAGE_LABELS: Record<(typeof STAGES)[number], string> = {
  IDEA: 'Idée',
  DEVELOPMENT: 'Développement',
  PRE_PRODUCTION: 'Préproduction',
  PRODUCTION: 'Production',
  POST_PRODUCTION: 'Postproduction',
  COMPLETED: 'Terminé',
};

export const ROLES = ['OWNER', 'ADMIN', 'DIRECTOR', 'WRITER', 'ART_DIRECTOR', 'EDITOR', 'VIEWER'] as const;
export type RoleName = (typeof ROLES)[number];

export const projectRulesSchema = z.object({
  maxCharactersPerShot: z.number().int().min(1).max(20).optional(),
  neverTogether: z.array(z.array(z.string().max(20)).max(4)).max(50).optional(),
  blocks: z.record(z.string(), text(4000)).optional(),
  lineupKey: z.string().nullish(),
  propsSheetKey: z.string().nullish(),
  targetSeconds: z.number().min(0).max(100000).nullish(),
});

export const motionRulesSchema = z.object({
  clipSeconds: z.tuple([z.number().min(0), z.number().min(0)]).optional(),
  allowedMoves: z.array(z.string()).optional(),
  short: text(1000).optional(),
  block: text(4000).optional(),
  never: never.optional(),
});

export const projectCreateSchema = z.object({
  title: z.string().trim().min(1, 'Un titre, même provisoire.').max(160),
  kind: z.enum(PROJECT_KINDS).default('SHORT'),
  aspectRatio: z.string().max(12).default('16:9'),
  resolution: z.string().max(20).optional(),
  language: z.string().max(12).default('fr'),
  idea: text(8000).optional(),
});

export const projectUpdateSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  kind: z.enum(PROJECT_KINDS).optional(),
  stage: z.enum(STAGES).optional(),
  aspectRatio: z.string().max(12).optional(),
  resolution: z.string().max(20).optional(),
  fps: z.number().int().min(1).max(120).optional(),
  language: z.string().max(12).optional(),
  rules: projectRulesSchema.optional(),
  motion: motionRulesSchema.optional(),
  coverAssetId: z.string().nullish(),
  archived: z.boolean().optional(),
});

export const conceptSchema = z.object({
  idea: text(8000).optional(),
  genre: opt(200),
  subgenre: opt(200),
  durationMin: z.number().int().min(0).max(100000).nullish(),
  country: opt(200),
  era: opt(200),
  audience: opt(400),
  tone: opt(400),
  theme: opt(1000),
  message: opt(2000),
  inspirations: opt(4000),
  logline: opt(1000),
  tagline: opt(400),
  synopsisShort: opt(4000),
  synopsisLong: opt(40000),
  pitch: opt(8000),
  themes: z.array(z.string().max(200)).max(30).optional(),
  conflicts: opt(4000),
  stakes: opt(4000),
  universe: opt(8000),
});

export const CHARACTER_PROFILE_FIELDS = {
  personality: 'Personnalité',
  backstory: 'Histoire',
  motivation: 'Motivation',
  fear: 'Peur',
  desire: 'Désir',
  goal: 'Objectif',
  conflict: 'Conflit',
  arc: 'Arc narratif',
  relations: 'Relations',
  speech: 'Langage',
  behavior: 'Comportement',
  accessories: 'Accessoires',
  evolution: 'Évolution',
} as const;

export const characterProfileSchema = z.object(
  Object.fromEntries(Object.keys(CHARACTER_PROFILE_FIELDS).map((k) => [k, text(8000).optional()])) as Record<
    keyof typeof CHARACTER_PROFILE_FIELDS,
    z.ZodOptional<z.ZodString>
  >,
);

export const characterSchema = z.object({
  name: z.string().trim().min(1).max(160),
  code: z.string().trim().max(20).optional(),
  role: opt(200),
  age: opt(60),
  gender: opt(60),
  origin: opt(200),
  heightM: z.number().min(0.1).max(10).nullish(),
  short: text(1000).optional(),
  block: text(8000).optional(),
  costume: text(4000).optional(),
  silhouette: text(1000).optional(),
  never: never.optional(),
  frozen: z.boolean().optional(),
  profile: characterProfileSchema.optional(),
  refAssetId: z.string().nullish(),
  order: z.number().int().optional(),
});

export const locationSchema = z.object({
  name: z.string().trim().min(1).max(160),
  code: z.string().trim().max(20).optional(),
  interior: z.boolean().optional(),
  short: text(1000).optional(),
  block: text(8000).optional(),
  architecture: opt(4000),
  era: opt(200),
  palette: opt(1000),
  lighting: opt(2000),
  weather: opt(1000),
  mood: opt(1000),
  textures: opt(2000),
  objects: opt(4000),
  sound: opt(2000),
  never: never.optional(),
  frozen: z.boolean().optional(),
  refAssetId: z.string().nullish(),
  order: z.number().int().optional(),
});

export const PROP_KINDS = ['PROP', 'COSTUME', 'VEHICLE', 'ANIMAL', 'SET_DRESSING', 'VFX'] as const;
export const PROP_KIND_LABELS: Record<(typeof PROP_KINDS)[number], string> = {
  PROP: 'Accessoire',
  COSTUME: 'Costume',
  VEHICLE: 'Véhicule',
  ANIMAL: 'Animal',
  SET_DRESSING: 'Décor',
  VFX: 'Effet',
};

export const propSchema = z.object({
  name: z.string().trim().min(1).max(160),
  code: z.string().trim().max(20).optional(),
  kind: z.enum(PROP_KINDS).optional(),
  short: text(1000).optional(),
  block: text(8000).optional(),
  never: never.optional(),
  refAssetId: z.string().nullish(),
});

export const styleSchema = z.object({
  name: z.string().trim().min(1).max(160),
  code: z.string().trim().max(20).optional(),
  short: text(1000).optional(),
  block: text(8000).optional(),
  never: never.optional(),
  active: z.boolean().optional(),
  refAssetId: z.string().nullish(),
});

export const lightSchema = z.object({
  name: z.string().trim().min(1).max(160),
  code: z
    .string()
    .trim()
    .max(20)
    .regex(/^[A-Z0-9_-]+$/, 'Majuscules, chiffres, - et _.')
    .optional(),
  short: text(1000).optional(),
  block: text(8000).optional(),
  never: never.optional(),
  isDefault: z.boolean().optional(),
});

export const worldSchema = z.object({ sections: z.record(z.string(), text(20000)) });

export const SETTINGS = ['INT', 'EXT', 'INT_EXT'] as const;
export const TIMES_OF_DAY = ['DAY', 'NIGHT', 'DAWN', 'DUSK', 'MORNING', 'EVENING', 'CONTINUOUS', 'LATER'] as const;
export const TIME_LABELS: Record<string, string> = {
  DAY: 'Jour',
  NIGHT: 'Nuit',
  DAWN: 'Aube',
  DUSK: 'Crépuscule',
  MORNING: 'Matin',
  EVENING: 'Soir',
  CONTINUOUS: 'Continu',
  LATER: 'Plus tard',
};

export const breakdownSchema = z.object({
  props: z.array(z.string().max(200)).optional(),
  costumes: z.array(z.string().max(200)).optional(),
  vehicles: z.array(z.string().max(200)).optional(),
  animals: z.array(z.string().max(200)).optional(),
  vfx: z.array(z.string().max(200)).optional(),
  sfx: z.array(z.string().max(200)).optional(),
  music: z.array(z.string().max(200)).optional(),
  ambience: opt(1000),
  lighting: opt(1000),
  weather: opt(200),
  notes: opt(4000),
});

export const directionSchema = z.object({
  intention: opt(2000),
  emotion: opt(400),
  rhythm: opt(400),
  style: opt(1000),
  references: opt(2000),
  camera: opt(2000),
  lighting: opt(2000),
  acting: opt(4000),
  sound: opt(2000),
});

export const sceneSchema = z.object({
  number: z.number().int().min(0).optional(),
  title: text(300).optional(),
  setting: z.enum(SETTINGS).optional(),
  timeOfDay: z.string().max(40).optional(),
  description: text(20000).optional(),
  locationId: z.string().nullish(),
  lightId: z.string().nullish(),
  actId: z.string().nullish(),
  sequenceId: z.string().nullish(),
  objective: opt(2000),
  conflict: opt(2000),
  emotion: opt(400),
  outcome: opt(2000),
  estSeconds: z.number().int().min(0).max(100000).nullish(),
  importance: z.number().int().min(1).max(3).optional(),
  status: z.enum(STAGES).optional(),
  characterIds: z.array(z.string()).max(200).optional(),
  breakdown: breakdownSchema.optional(),
  direction: directionSchema.optional(),
});

export const shotSchema = z.object({
  sceneId: z.string().optional(),
  description: text(4000).optional(),
  action: text(4000).optional(),
  dialogue: opt(4000),
  audio: opt(2000),
  size: z.string().max(20).nullish(),
  angle: z.string().max(20).nullish(),
  lens: z.string().max(40).nullish(),
  move: z.string().max(20).nullish(),
  composition: opt(1000),
  transition: z.string().max(20).nullish(),
  durationSec: z.number().min(0.1).max(600).optional(),
  aspectRatio: z.string().max(12).nullish(),
  locationId: z.string().nullish(),
  lightId: z.string().nullish(),
  isGroup: z.boolean().optional(),
  note: opt(2000),
  characterIds: z.array(z.string()).max(40).optional(),
  propIds: z.array(z.string()).max(80).optional(),
  overrides: z.record(z.string(), text(20000)).optional(),
  status: z.enum(STAGES).optional(),
});

export const reorderSchema = z.object({ ids: z.array(z.string()).min(1).max(2000) });

export const scriptSchema = z.object({
  fountain: text(2_000_000),
  doc: z.unknown().optional(),
  /** true pour créer une révision (sauvegarde manuelle), false pour l'autosave. */
  snapshot: z.boolean().optional(),
  message: opt(200),
});

export const CAPABILITIES = ['TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'EMBEDDING'] as const;
export type CapabilityName = (typeof CAPABILITIES)[number];

export const GENERATION_MODES = {
  text: 'Texte',
  'text-to-image': 'Texte → image',
  'image-to-image': 'Image → image',
  'text-to-video': 'Texte → vidéo',
  'image-to-video': 'Image → vidéo',
  'first-last-frame': 'Première + dernière image',
  'reference-to-video': 'Références → vidéo',
  'text-to-speech': 'Texte → voix',
  'sound-effect': 'Effet sonore',
  music: 'Musique',
} as const;
export type GenerationMode = keyof typeof GENERATION_MODES;

export const generationRequestSchema = z.object({
  capability: z.enum(CAPABILITIES),
  mode: z.enum(Object.keys(GENERATION_MODES) as [GenerationMode, ...GenerationMode[]]),
  /** "auto" ou l'id d'un Model en base. */
  modelId: z.string().max(60).default('auto'),
  prompt: z.string().min(1, 'Le prompt est vide.').max(40000),
  negative: z.string().max(8000).optional(),
  shotId: z.string().nullish(),
  target: z.string().max(40).nullish(),
  inputAssetIds: z.array(z.string()).max(12).default([]),
  /** Rôle de chaque entrée, dans le même ordre : reference, first_frame, last_frame, init. */
  inputRoles: z.array(z.enum(['reference', 'first_frame', 'last_frame', 'init', 'mask', 'audio'])).max(12).default([]),
  /** Entités à rattacher au résultat (moteur de cohérence). */
  links: z
    .object({
      characterIds: z.array(z.string()).optional(),
      locationId: z.string().nullish(),
      propId: z.string().nullish(),
      sceneId: z.string().nullish(),
      /** Faire du résultat la référence de cette entité. */
      setAsRefOf: z.object({ type: z.enum(['character', 'location', 'prop', 'style']), id: z.string() }).nullish(),
    })
    .default({}),
  params: z
    .object({
      aspectRatio: z.string().max(12).optional(),
      resolution: z.string().max(20).optional(),
      width: z.number().int().min(64).max(8192).optional(),
      height: z.number().int().min(64).max(8192).optional(),
      steps: z.number().int().min(1).max(200).optional(),
      cfg: z.number().min(0).max(40).optional(),
      seed: z.number().int().min(0).max(2 ** 32 - 1).optional(),
      count: z.number().int().min(1).max(8).optional(),
      durationSec: z.number().min(1).max(60).optional(),
      fps: z.number().int().min(1).max(60).optional(),
      motionStrength: z.number().min(0).max(1).optional(),
      cameraMovement: z.string().max(40).optional(),
      voiceId: z.string().max(100).optional(),
      quality: z.enum(['draft', 'standard', 'high']).optional(),
      /** Préférence du routeur AUTO. */
      prefer: z.enum(['quality', 'cost', 'speed']).optional(),
    })
    .default({}),
});
export type GenerationRequest = z.infer<typeof generationRequestSchema>;

export const providerSchema = z.object({
  name: z.string().trim().min(1).max(120),
  adapter: z.string().min(1).max(40),
  baseUrl: z.url().max(500).nullish().or(z.literal('')),
  /** Absente = inchangée ; chaîne vide = effacer. */
  apiKey: z.string().max(4000).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  isLocal: z.boolean().optional(),
  enabled: z.boolean().optional(),
  /** Visible par toute l'instance (admin) ou seulement par l'espace de travail. */
  scope: z.enum(['instance', 'workspace']).optional(),
});

export const modelSchema = z.object({
  modelId: z.string().trim().min(1).max(200),
  label: z.string().trim().min(1).max(200),
  capability: z.enum(CAPABILITIES),
  modes: z.array(z.string().max(40)).max(20),
  pricing: z
    .object({ unit: z.enum(['image', 'second', '1k_tokens', 'request', '1k_chars']), usd: z.number().min(0).max(1000) })
    .partial()
    .optional(),
  quality: z.number().int().min(1).max(5).optional(),
  speed: z.number().int().min(1).max(5).optional(),
  maxDuration: z.number().min(0).max(600).nullish(),
  aspectRatios: z.array(z.string().max(12)).max(20).optional(),
  enabled: z.boolean().optional(),
});

export const routeSchema = z.object({
  task: z.string().min(1).max(60),
  modelIds: z.array(z.string()).max(20),
});

export const ROUTING_TASKS = {
  TEXT: 'Texte (assistant, concept, réécriture)',
  IMAGE_GENERATION: 'Génération d’image',
  VIDEO_GENERATION: 'Génération vidéo',
  AUDIO_GENERATION: 'Voix et son',
  EMBEDDING: 'Embeddings',
} as const;

export const templateSchema = z.object({
  category: z.string().min(1).max(40),
  name: z.string().trim().min(1).max(160),
  body: z.string().min(1).max(20000),
});

export const TEMPLATE_CATEGORIES = ['SCREENWRITING', 'CHARACTER', 'LOCATION', 'IMAGE', 'VIDEO', 'CAMERA', 'LIGHTING', 'DIALOGUE', 'STORYBOARD', 'SOUND'] as const;

/** Les {{variables}} d'un template de prompt. */
export const templateVariables = (body: string) => [...new Set([...body.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)].map((m) => m[1]))];
export const fillTemplate = (body: string, vars: Record<string, string>) => body.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`);

export const commentSchema = z.object({
  entityType: z.string().max(40),
  entityId: z.string().max(60),
  body: z.string().trim().min(1).max(8000),
  parentId: z.string().nullish(),
});
