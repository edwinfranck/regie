import YAML from 'yaml';

// Import d'un projet régie v0.1 (regie/bible.yaml + regie/plans.yaml) vers le
// modèle du studio. La v0.1 n'avait pas de scènes : les plans consécutifs dans
// un même lieu forment une scène.

type Y = Record<string, any>;

export interface ImportedEntity {
  code: string;
  name: string;
  short: string;
  block: string;
  never: string[];
  /** Chemin de l'image de référence, relatif au dossier du projet. */
  refPath?: string | null;
}

export interface ImportPayload {
  title: string;
  aspectRatio: string;
  resolution: string;
  rules: { maxCharactersPerShot?: number; neverTogether?: string[][]; blocks?: Record<string, string>; targetSeconds?: number | null };
  motion: { clipSeconds?: [number, number]; allowedMoves?: string[]; short?: string; block?: string; never?: string[] };
  assets: { lineupPath?: string | null; propsSheetPath?: string | null };
  styles: (ImportedEntity & { active: boolean })[];
  lights: (ImportedEntity & { isDefault: boolean })[];
  characters: (ImportedEntity & { costume: string; silhouette: string; heightM: number | null; frozen: boolean })[];
  locations: (ImportedEntity & { sound: string | null })[];
  props: ImportedEntity[];
  scenes: { number: number; locationCode: string | null; lightCode: string | null; characterCodes: string[] }[];
  shots: {
    sceneNumber: number;
    order: number;
    legacyId: string;
    action: string;
    dialogue: string | null;
    audio: string | null;
    size: string | null;
    angle: string | null;
    lens: string | null;
    move: string | null;
    durationSec: number;
    locationCode: string | null;
    lightCode: string | null;
    isGroup: boolean;
    note: string | null;
    characterCodes: string[];
    propCodes: string[];
  }[];
  sheets: { title: string; shotLegacyIds: string[] }[];
  script?: string;
}

const MOVE_MAP: Record<string, string> = { PUSH_IN_SLOW: 'PUSH_IN', PULL_OUT_SLOW: 'PULL_OUT', TRACK: 'TRACKING' };
const s = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const list = (v: unknown) => (Array.isArray(v) ? v.map(String) : []);

export function importV1(bibleYaml: string, plansYaml: string, script?: string): ImportPayload {
  const bible: Y = YAML.parse(bibleYaml) ?? {};
  const plans: Y = YAML.parse(plansYaml) ?? {};
  const look: Y = bible.look ?? {};

  const styles = look.variants
    ? Object.entries<Y>(look.variants).map(([code, v]) => ({
        code,
        name: s(v.name) || code,
        short: s(v.short),
        block: s(v.block),
        never: [...list(look.never), ...list(v.never)],
        refPath: v.ref ?? null,
        active: code === look.active,
      }))
    : look.short || look.block
      ? [{ code: s(look.id) || 'LOOK', name: 'Style', short: s(look.short), block: s(look.block), never: list(look.never), refPath: look.ref ?? null, active: true }]
      : [];

  const defaultLight = s(plans.episode?.light) || 'DAY';
  const lights = Object.entries<Y>(bible.light ?? {}).map(([code, l]) => ({
    code,
    name: code,
    short: s(l.short),
    block: s(l.block),
    never: list(l.never),
    isDefault: code === defaultLight,
  }));

  const characters = Object.entries<Y>(bible.characters ?? {}).map(([code, c]) => ({
    code,
    name: s(c.name) || code,
    short: s(c.short),
    block: s(c.block),
    costume: s(c.costume),
    silhouette: s(c.silhouette),
    never: list(c.never),
    heightM: typeof c.height_m === 'number' ? c.height_m : null,
    frozen: !!c.frozen,
    refPath: c.ref ?? null,
  }));

  const locations = Object.entries<Y>(bible.locations ?? {}).map(([code, l]) => ({
    code,
    name: s(l.name) || code,
    short: s(l.short),
    block: s(l.block),
    never: list(l.never),
    sound: s(l.sound) || null,
    refPath: l.ref ?? null,
  }));

  const props = Object.entries<Y>(bible.props ?? {}).map(([code, p]) => ({
    code,
    name: s(p.name) || code,
    short: s(p.short),
    block: s(p.block),
    never: list(p.never),
    refPath: p.ref ?? null,
  }));

  // Les scènes : une nouvelle à chaque changement de lieu.
  const scenes: ImportPayload['scenes'] = [];
  const shots: ImportPayload['shots'] = [];
  for (const raw of (plans.shots ?? []) as Y[]) {
    const loc = s(raw.location) || null;
    let scene = scenes[scenes.length - 1];
    if (!scene || scene.locationCode !== loc) {
      scene = { number: scenes.length + 1, locationCode: loc, lightCode: s(raw.light) || defaultLight, characterCodes: [] };
      scenes.push(scene);
    }
    const cast = list(raw.characters);
    for (const c of cast) if (!scene.characterCodes.includes(c)) scene.characterCodes.push(c);
    const cam: Y = raw.camera ?? {};
    const angle = s(cam.angle) || null;
    shots.push({
      sceneNumber: scene.number,
      order: shots.filter((x) => x.sceneNumber === scene.number).length,
      legacyId: String(raw.id),
      action: s(raw.action),
      dialogue: s(raw.dialogue) || null,
      audio: s(raw.sound) || null,
      // OTS était un angle en v0.1, c'est une taille de plan ici.
      size: angle === 'OTS' ? 'OTS' : s(cam.size) || null,
      angle: angle === 'OTS' ? null : angle,
      lens: s(cam.lens) || null,
      move: cam.move ? (MOVE_MAP[cam.move] ?? cam.move) : null,
      durationSec: Number(raw.duration) || 3,
      locationCode: loc,
      lightCode: s(raw.light) || null,
      isGroup: !!raw.group,
      note: s(raw.note) || null,
      characterCodes: cast,
      propCodes: list(raw.props),
    });
  }

  const motion: Y = bible.motion ?? {};
  const rules: Y = bible.rules ?? {};
  return {
    title: s(bible.film?.title) || 'Projet importé',
    aspectRatio: s(bible.film?.format?.ratio) || '16:9',
    resolution: s(bible.film?.format?.resolution) || '1920x1080',
    rules: {
      maxCharactersPerShot: rules.max_characters_per_shot,
      neverTogether: rules.never_together,
      blocks: rules.blocks,
      targetSeconds: plans.episode?.target_seconds ?? null,
    },
    motion: {
      clipSeconds: motion.clip_seconds,
      allowedMoves: list(motion.allowed_moves).map((m) => MOVE_MAP[m] ?? m),
      short: s(motion.short),
      block: s(motion.block),
      never: list(motion.never),
    },
    assets: { lineupPath: bible.assets?.lineup ?? null, propsSheetPath: bible.assets?.props_sheet ?? null },
    styles,
    lights,
    characters,
    locations,
    props,
    scenes,
    shots,
    sheets: ((plans.sheets ?? []) as Y[]).map((sh) => ({ title: String(sh.id), shotLegacyIds: list(sh.shots) })),
    script,
  };
}
