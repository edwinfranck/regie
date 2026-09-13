import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import YAML from 'yaml';

const DATA_DIR = 'regie';

export function loadFilm(dirArg) {
  const dir = resolve(dirArg || process.cwd());
  const base = existsSync(join(dir, DATA_DIR, 'bible.yaml')) ? join(dir, DATA_DIR) : dir;
  const read = (f) => {
    const p = join(base, f);
    if (!existsSync(p)) throw new Error(`Fichier introuvable : ${p}`);
    return YAML.parse(readFileSync(p, 'utf8'));
  };
  const bible = read('bible.yaml');
  const plans = read('plans.yaml');
  return { dir, base, bible, plans };
}

const get = (map, id, kind) => {
  const hit = (map || {})[id];
  if (!hit) throw new Error(`${kind} "${id}" absent de bible.yaml`);
  return { id, ...hit };
};

// Un plan du decoupage + la bible => tout ce qu'il faut pour ecrire un prompt.
// C'est la seule fonction qui sait assembler. Les cibles ne font que mettre en forme.
// Le LOOK actif : une variante de bible.look.variants, aplatie pour que
// les cibles n'aient jamais a savoir qu'il y en a plusieurs.
export function activeLook(bible) {
  const l = bible.look;
  if (!l.variants) return l;
  const v = l.variants[l.active];
  if (!v) throw new Error(`LOOK "${l.active}" absent de look.variants`);
  return { ...l, ...v, id: `${l.id}-${l.active}`, variant: l.active };
}

export function resolveShot(film, shot) {
  const { bible, plans } = film;
  const lightId = shot.light || plans.episode.light || 'DAY';

  const characters = (shot.characters || []).map((id) => get(bible.characters, id, 'Personnage'));
  const props      = (shot.props || []).map((id) => get(bible.props, id, 'Accessoire'));
  const location   = get(bible.locations, shot.location, 'Lieu');
  const light      = get(bible.light, lightId, 'État de lumière');

  // Les images de reference a charger dans l'outil de generation.
  const refs = [];
  for (const c of characters) if (c.ref) refs.push({ id: c.id, path: c.ref, why: `feuille ${c.name}` });
  if (characters.length > 1 && bible.assets?.lineup)
    refs.push({ id: 'LINEUP', path: bible.assets.lineup, why: 'echelle des tailles' });
  if (props.length && bible.assets?.props_sheet)
    refs.push({ id: 'ASSETS', path: bible.assets.props_sheet, why: 'forme des objets' });
  if (location.ref) refs.push({ id: location.id, path: location.ref, why: `plaque ${location.name}` });

  // Deux listes : une image fixe n'a pas a interdire le travelling,
  // et une video doit interdire les deux.
  const never = dedupe([
    ...(activeLook(bible).never || []),
    ...characters.flatMap((c) => c.never || []),
    ...props.flatMap((p) => p.never || []),
    ...(location.never || []),
    ...(light.never || []),
  ]);
  const neverVideo = dedupe([...never, ...(bible.motion?.never || [])]);

  return {
    id: String(shot.id),
    episode: plans.episode.id,
    duration: shot.duration,
    action: shot.action,
    dialogue: shot.dialogue || null,
    sound: shot.sound || location.sound || null,
    camera: shot.camera || {},
    group: !!shot.group,
    note: shot.note || null,
    look: activeLook(bible),
    rules: bible.rules || {},
    motion: bible.motion,
    format: bible.film.format,
    characters, props, location, light, refs, never, neverVideo,
  };
}

export const allShots = (film) => film.plans.shots;
export const findShot = (film, id) => film.plans.shots.find((s) => String(s.id) === String(id));
const dedupe = (a) => [...new Set(a.map((x) => x.trim().toLowerCase()))];
