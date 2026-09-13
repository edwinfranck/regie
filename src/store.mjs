import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';
import { homedir } from 'node:os';
import YAML from 'yaml';

// Le registre des projets. L'outil n'appartient a aucun film : il en ouvre
// plusieurs, et sait en creer un vide.
const CONF = join(process.env.XDG_CONFIG_HOME || join(homedir(), '.config'), 'regie');
const REG = join(CONF, 'projects.json');

export const slug = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'projet';

export function listProjects() {
  if (!existsSync(REG)) return [];
  const rows = JSON.parse(readFileSync(REG, 'utf8'));
  return rows.filter((p) => existsSync(join(p.path, 'regie', 'bible.yaml'))).map((p) => {
    const b = YAML.parse(readFileSync(join(p.path, 'regie', 'bible.yaml'), 'utf8'));
    const pl = YAML.parse(readFileSync(join(p.path, 'regie', 'plans.yaml'), 'utf8'));
    return { ...p, title: b.film?.title || p.name, format: b.film?.format,
      counts: { characters: Object.keys(b.characters || {}).length, locations: Object.keys(b.locations || {}).length,
        props: Object.keys(b.props || {}).length, shots: (pl.shots || []).length, sheets: (pl.sheets || []).length } };
  });
}

const writeReg = (rows) => { mkdirSync(CONF, { recursive: true }); writeFileSync(REG, JSON.stringify(rows, null, 2)); };
const rawReg = () => (existsSync(REG) ? JSON.parse(readFileSync(REG, 'utf8')) : []);
export const projectById = (id) => rawReg().find((p) => p.id === id);

export function registerProject(path, name) {
  const dir = resolve(path);
  if (!existsSync(join(dir, 'regie', 'bible.yaml'))) throw new Error(`Aucun regie/bible.yaml dans ${dir}`);
  const rows = rawReg();
  const id = uniqueId(rows, slug(name || basename(dir)));
  rows.push({ id, name: name || basename(dir), path: dir, added: new Date().toISOString() });
  writeReg(rows);
  return id;
}

export function forgetProject(id) { writeReg(rawReg().filter((p) => p.id !== id)); }

const uniqueId = (rows, base) => { let id = base, n = 2; while (rows.some((r) => r.id === id)) id = `${base}-${n++}`; return id; };

// Un projet neuf : la structure et rien d'autre. Aucun contenu d'exemple —
// c'est a l'auteur d'ecrire le sien.
export function createProject({ path, title, ratio = '9:16', resolution = '1080x1920' }) {
  const dir = resolve(path);
  if (existsSync(join(dir, 'regie', 'bible.yaml'))) throw new Error('Un projet régie existe déjà dans ce dossier.');
  mkdirSync(join(dir, 'regie'), { recursive: true });
  mkdirSync(join(dir, 'refs'), { recursive: true });

  writeFileSync(join(dir, 'regie', 'bible.yaml'), bibleTemplate({ title, ratio, resolution }));
  writeFileSync(join(dir, 'regie', 'plans.yaml'), plansTemplate());
  if (!existsSync(join(dir, 'Script.md'))) writeFileSync(join(dir, 'Script.md'), '');
  return registerProject(dir, title);
}

/* Le squelette d'un projet neuf. Ecrit en texte et pas serialise depuis un
   objet : c'est ce qui garde le fichier lisible et annote, donc editable a la
   main autant que depuis l'interface. */
const bibleTemplate = ({ title, ratio, resolution }) => `# ${title} — bible.
# Source de verite unique du projet. Tout element absent d'ici sera reinvente
# differemment a chaque generation.

film:
  id: ${slug(title)}
  title: ${JSON.stringify(title)}
  format: { ratio: "${ratio}", resolution: "${resolution}" }

# Les images communes a tout le projet, une fois generees.
assets:
  lineup: null
  props_sheet: null

# Le style de rendu. Plusieurs variantes possibles, une seule active.
look:
  id: LOOK
  active: S1
  never: []
  variants:
    S1:
      name: Style 1
      frozen: false
      ref: null
      short: ""
      block: ""

# Les regles que le controle fait respecter au decoupage.
rules:
  max_characters_per_shot: 2
  never_together: []
  blocks: {}

# Ce qu'un plan anime a le droit de faire.
motion:
  clip_seconds: [2, 4]
  allowed_moves: [STATIC, PUSH_IN_SLOW]
  short: ""
  block: ""
  never: []

# Les etats de lumiere. Un plan en declare un.
light:
  DAY:
    id: LIGHT-DAY
    short: ""
    block: ""
    never: []

characters: {}
locations: {}
props: {}
sound: {}
`;

const plansTemplate = () => `# Decoupage — les plans, leur camera, et les planches.
# Les identifiants CH / L / P renvoient a bible.yaml.

episode:
  id: EP1
  title: ""
  light: DAY
  target_seconds: null

shots: []

# Une planche regroupe plusieurs plans en une seule image multi-cases.
sheets: []
`;


/* ── écriture YAML : on passe toujours par le document, jamais par un dump ──
   pour que les commentaires et la mise en forme de l'auteur survivent. */
export function edit(file, fn) {
  const doc = YAML.parseDocument(readFileSync(file, 'utf8'));
  const out = fn(doc);
  writeFileSync(file, doc.toString({ lineWidth: 0, flowCollectionPadding: false }));
  return out;
}

export const isEmpty = (v) => v === '' || v === null || v === undefined ||
  (Array.isArray(v) && !v.length) || (typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length);

// Applique un patch plat sur un noeud : une cle a null supprime, sinon ecrase.
export function applyPatch(doc, path, patch) {
  for (const [k, v] of Object.entries(patch)) {
    const full = [...path, k];
    if (v === null) doc.deleteIn(full); else doc.setIn(full, val(doc, v));
  }
}

/* Mise en forme des noeuds crees depuis l'interface.
   setIn range l'objet JS tel quel : sans passer par createNode, aucun style
   ne s'applique et le fichier finit en une seule ligne. */
const allScalars = (n) => n.items.every((x) => x && x.items === undefined && x.key === undefined);

function style(n, { flow = false, flowKeys = [] } = {}) {
  if (!n || !n.items) return n;
  n.flow = flow;
  for (const it of n.items) {
    if (it && it.key !== undefined) {
      const k = String(it.key.value ?? '');
      if (it.value?.items) style(it.value, { flow: flowKeys.includes(k) || allScalars(it.value), flowKeys });
    } else if (it?.items) style(it, { flow: false, flowKeys });
  }
  return n;
}

// Convertit une valeur en noeud mis en forme. Les scalaires passent tels quels.
export function val(doc, v, opts = {}) {
  if (v === null || typeof v !== 'object') return v;
  const n = doc.createNode(v);
  return style(n, { flow: Array.isArray(v) ? allScalars(n) : (opts.flow ?? false), flowKeys: opts.flowKeys || [] });
}
export const block = (node) => { if (node?.items) node.flow = false; return node; };
