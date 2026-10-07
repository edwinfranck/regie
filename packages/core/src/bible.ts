// La bible d'un projet, telle que le compilateur la voit. Volontairement
// indépendante de Prisma : le compilateur, le linter et les tests travaillent
// sur des objets simples, que l'application charge depuis la base.

export interface Entity {
  id: string;
  code: string;
  name: string;
  short: string;
  block: string;
  never: string[];
  refAssetId?: string | null;
  /** Clé de stockage de l'image de référence, résolue au chargement. */
  refKey?: string | null;
}

export interface CharacterEntity extends Entity {
  costume: string;
  silhouette: string;
  heightM?: number | null;
  frozen: boolean;
}

export interface LocationEntity extends Entity {
  interior: boolean;
  sound?: string | null;
  frozen: boolean;
}

export interface PropEntity extends Entity {
  kind: string;
}

export interface StyleEntity extends Entity {
  active: boolean;
}

export interface LightEntity extends Entity {
  isDefault: boolean;
}

export interface ProjectRules {
  maxCharactersPerShot?: number;
  /** Paires de codes de personnages trop ressemblants pour partager un plan. */
  neverTogether?: string[][];
  /** Blocs de texte injectés dans tous les prompts image (échelle, latéralité…). */
  blocks?: Record<string, string>;
  /** Clé de stockage des planches communes, une fois générées. */
  lineupKey?: string | null;
  propsSheetKey?: string | null;
  targetSeconds?: number | null;
}

export interface MotionRules {
  clipSeconds?: [number, number];
  allowedMoves?: string[];
  short?: string;
  block?: string;
  never?: string[];
}

export interface Bible {
  project: {
    id: string;
    title: string;
    aspectRatio: string;
    resolution: string;
    fps: number;
    language: string;
    rules: ProjectRules;
    motion: MotionRules;
  };
  concept?: { logline?: string | null; synopsisShort?: string | null; tone?: string | null; genre?: string | null } | null;
  world?: Record<string, string> | null;
  styles: StyleEntity[];
  lights: LightEntity[];
  characters: CharacterEntity[];
  locations: LocationEntity[];
  props: PropEntity[];
}

export interface SceneInput {
  id: string;
  number: number;
  title: string;
  setting: string;
  timeOfDay: string;
  description: string;
  locationId?: string | null;
  lightId?: string | null;
  characterIds: string[];
  emotion?: string | null;
  direction?: Record<string, unknown> | null;
}

export interface ShotInput {
  id: string;
  code: string;
  sceneId: string;
  order: number;
  description: string;
  action: string;
  dialogue?: string | null;
  audio?: string | null;
  size?: string | null;
  angle?: string | null;
  lens?: string | null;
  move?: string | null;
  composition?: string | null;
  transition?: string | null;
  durationSec: number;
  aspectRatio?: string | null;
  locationId?: string | null;
  lightId?: string | null;
  isGroup: boolean;
  note?: string | null;
  characterIds: string[];
  propIds: string[];
  overrides?: Record<string, string> | null;
}

/** Le style actif. Un projet sans style déclaré compile quand même, sans bloc de rendu. */
export function activeStyle(bible: Bible): StyleEntity {
  return (
    bible.styles.find((s) => s.active) ??
    bible.styles[0] ?? { id: '', code: 'LOOK', name: 'Sans style', short: '', block: '', never: [], active: true }
  );
}

export function defaultLight(bible: Bible): LightEntity | undefined {
  return bible.lights.find((l) => l.isDefault) ?? bible.lights[0];
}

export const byId = <T extends { id: string }>(rows: T[]) => new Map(rows.map((r) => [r.id, r]));
