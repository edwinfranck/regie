import {
  type Bible,
  type CharacterEntity,
  type LightEntity,
  type LocationEntity,
  type PropEntity,
  type SceneInput,
  type ShotInput,
  type StyleEntity,
  activeStyle,
  byId,
  defaultLight,
} from './bible';
import type { Camera } from './camera';

export interface RefImage {
  /** Code de l'entité (CH1, L2…) ou LINEUP / ASSETS. */
  id: string;
  kind: 'character' | 'location' | 'prop' | 'style' | 'lineup' | 'props_sheet';
  assetId?: string | null;
  key?: string | null;
  why: string;
}

/**
 * Tout ce qu'il faut pour écrire le prompt d'un plan, résolu une fois pour
 * toutes. C'est le produit du Context Builder : Project → World → Characters →
 * Location → Scene → Shot → References. Les cibles ne font que le mettre en forme.
 */
export interface ShotSpec {
  id: string;
  code: string;
  sceneNumber: number | null;
  duration: number;
  description: string;
  action: string;
  dialogue: string | null;
  sound: string | null;
  camera: Camera;
  composition: string | null;
  transition: string | null;
  group: boolean;
  note: string | null;
  emotion: string | null;
  style: StyleEntity;
  rules: Bible['project']['rules'];
  motion: Bible['project']['motion'];
  format: { ratio: string; resolution: string };
  characters: CharacterEntity[];
  props: PropEntity[];
  location: LocationEntity | null;
  light: LightEntity | null;
  refs: RefImage[];
  /** Négatifs d'une image fixe. */
  never: string[];
  /** Négatifs d'une vidéo : ceux de l'image plus ceux du bloc MOTION. */
  neverVideo: string[];
  overrides: Record<string, string>;
}

export class ContextError extends Error {
  constructor(
    message: string,
    public where: string,
  ) {
    super(message);
  }
}

const EMPTY_LOCATION: LocationEntity = {
  id: '',
  code: '—',
  name: 'Lieu non défini',
  short: '',
  block: '',
  never: [],
  interior: true,
  frozen: false,
};

export function dedupe(list: string[]) {
  return [...new Set(list.map((x) => x.trim().toLowerCase()).filter(Boolean))];
}

/**
 * La seule fonction qui sait assembler. Un plan hérite de sa scène ce qu'il ne
 * précise pas (lieu, lumière), et la scène du projet (lumière par défaut).
 */
export function resolveShot(bible: Bible, shot: ShotInput, scene?: SceneInput | null): ShotSpec {
  const chars = byId(bible.characters);
  const locs = byId(bible.locations);
  const props = byId(bible.props);
  const lights = byId(bible.lights);
  const where = `plan ${shot.code}`;

  const characters = shot.characterIds.map((id) => {
    const c = chars.get(id);
    if (!c) throw new ContextError(`personnage ${id} absent de la bible`, where);
    return c;
  });
  const shotProps = shot.propIds.map((id) => {
    const p = props.get(id);
    if (!p) throw new ContextError(`accessoire ${id} absent de la bible`, where);
    return p;
  });

  const locationId = shot.locationId ?? scene?.locationId ?? null;
  const location = locationId ? (locs.get(locationId) ?? null) : null;
  const lightId = shot.lightId ?? scene?.lightId ?? null;
  const light = (lightId ? lights.get(lightId) : undefined) ?? defaultLight(bible) ?? null;
  const style = activeStyle(bible);
  const rules = bible.project.rules ?? {};
  const motion = bible.project.motion ?? {};

  // Les images de référence à charger dans l'outil de génération, dans l'ordre
  // où un moteur à références multiples les pondère.
  const refs: RefImage[] = [];
  for (const c of characters)
    refs.push({ id: c.code, kind: 'character', assetId: c.refAssetId, key: c.refKey, why: `feuille ${c.name}` });
  if (characters.length > 1 && rules.lineupKey)
    refs.push({ id: 'LINEUP', kind: 'lineup', key: rules.lineupKey, why: 'échelle des tailles' });
  if (shotProps.length && rules.propsSheetKey)
    refs.push({ id: 'ASSETS', kind: 'props_sheet', key: rules.propsSheetKey, why: 'forme des objets' });
  for (const p of shotProps)
    if (p.refAssetId) refs.push({ id: p.code, kind: 'prop', assetId: p.refAssetId, key: p.refKey, why: p.name });
  if (location)
    refs.push({ id: location.code, kind: 'location', assetId: location.refAssetId, key: location.refKey, why: `plaque ${location.name}` });
  if (style.refAssetId)
    refs.push({ id: style.code, kind: 'style', assetId: style.refAssetId, key: style.refKey, why: `style ${style.name}` });

  // Deux listes : une image fixe n'a pas à interdire le travelling,
  // une vidéo doit interdire les deux.
  const never = dedupe([
    ...style.never,
    ...characters.flatMap((c) => c.never),
    ...shotProps.flatMap((p) => p.never),
    ...(location?.never ?? []),
    ...(light?.never ?? []),
  ]);
  const neverVideo = dedupe([...never, ...(motion.never ?? [])]);

  return {
    id: shot.id,
    code: shot.code,
    sceneNumber: scene?.number ?? null,
    duration: shot.durationSec,
    description: shot.description,
    action: shot.action || shot.description,
    dialogue: shot.dialogue ?? null,
    sound: shot.audio ?? location?.sound ?? null,
    camera: { size: shot.size, angle: shot.angle, lens: shot.lens, move: shot.move },
    composition: shot.composition ?? null,
    transition: shot.transition ?? null,
    group: shot.isGroup,
    note: shot.note ?? null,
    emotion: scene?.emotion ?? null,
    style,
    rules,
    motion,
    format: { ratio: shot.aspectRatio || bible.project.aspectRatio, resolution: bible.project.resolution },
    characters,
    props: shotProps,
    location: location ?? (locationId ? null : EMPTY_LOCATION),
    light,
    refs,
    never,
    neverVideo,
    overrides: shot.overrides ?? {},
  };
}

/**
 * Contexte d'une demande libre ("Marie marche dans la rue sous la pluie.") :
 * on repère dans le texte les personnages, lieux et objets de la bible par leur
 * nom ou leur code, pour injecter leurs blocs gelés sans que l'auteur ait à les
 * recopier.
 */
export function detectEntities(bible: Bible, text: string) {
  const norm = (s: string) =>
    s
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase();
  const hay = ` ${norm(text)} `;
  const hit = (e: { code: string; name: string }) => {
    const words = [e.code, e.name, e.name.split(/\s+/)[0]].filter((w) => w && w.length > 1).map(norm);
    return words.some((w) => new RegExp(`[^a-z0-9]${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^a-z0-9]`).test(hay));
  };
  return {
    characters: bible.characters.filter(hit),
    locations: bible.locations.filter(hit),
    props: bible.props.filter(hit),
  };
}
