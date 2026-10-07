import { CHARACTER_PROFILE_FIELDS, MOVES, SIZES, ANGLES, cameraFr, lint, toPlain, worldDigest, structureById } from '@regie/core';
import { prisma } from '@regie/db';
import { loadBible, loadScenes, loadShots } from './bible';
import { parseJsonReply, runText, streamText } from './generations';

// Les tâches d'écriture assistées. Aucune ne travaille sur le seul texte de
// l'utilisateur : chacune reçoit le contexte du projet (concept, monde,
// personnages, lieux, scène) — c'est l'AI Context Engine. Les réponses sont
// des propositions : rien n'est écrit en base sans validation dans l'interface.

// La mise en scène mêle listes et champs rédigés en éditeur riche (HTML) :
// les modèles la reçoivent en texte brut.
const plainValues = (o: unknown) => (o && typeof o === 'object' ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === 'string' ? toPlain(v) : v])) : o);

const LANG_RULE =
  'Écris en français les champs narratifs. Écris EN ANGLAIS les champs destinés aux générateurs d’images (short, block, costume, silhouette, never) : les modèles visuels les comprennent mieux.';

/** Le projet résumé pour un modèle de texte. Borné pour tenir dans le contexte. */
export async function projectDigest(projectId: string, opts: { scenes?: boolean; shots?: boolean; lint?: boolean } = {}) {
  const [bible, scenes, project] = await Promise.all([
    loadBible(projectId),
    loadScenes(projectId),
    prisma.project.findUniqueOrThrow({ where: { id: projectId }, include: { concept: true, story: { include: { beats: { orderBy: { order: 'asc' } } } } } }),
  ]);
  const c = project.concept;
  const lines: string[] = [];
  lines.push(`PROJET : « ${project.title} » — ${project.kind}, format ${project.aspectRatio}, langue ${project.language}.`);
  if (c) {
    for (const [k, v] of Object.entries({ Idée: c.idea, Logline: c.logline, Genre: [c.genre, c.subgenre].filter(Boolean).join(' / '), Ton: c.tone, Thème: c.theme, Synopsis: c.synopsisShort, Enjeux: c.stakes, Univers: c.universe }))
      if (v) lines.push(`${k} : ${toPlain(v)}`);
  }
  const world = worldDigest(bible.world, 1500);
  if (world) lines.push(`\nMONDE\n${world}`);
  const style = bible.styles.find((s) => s.active);
  if (style) lines.push(`\nSTYLE ACTIF ${style.code} ${style.name} : ${style.short}`);
  if (bible.characters.length) {
    lines.push('\nPERSONNAGES');
    const full = await prisma.character.findMany({ where: { projectId }, select: { id: true, role: true, age: true, profile: true } });
    const extra = new Map(full.map((f) => [f.id, f]));
    for (const ch of bible.characters) {
      const e = extra.get(ch.id);
      const prof = (e?.profile ?? {}) as Record<string, string>;
      lines.push(`- ${ch.code} ${ch.name}${e?.role ? ` (${e.role})` : ''}${e?.age ? `, ${e.age}` : ''} : ${ch.short || '—'}${ch.costume ? ` | costume : ${ch.costume}` : ''}${prof.goal ? ` | objectif : ${toPlain(prof.goal)}` : ''}${prof.arc ? ` | arc : ${toPlain(prof.arc)}` : ''}${ch.refAssetId ? '' : ' | SANS feuille de référence'}`);
    }
  }
  if (bible.locations.length) {
    lines.push('\nLIEUX');
    for (const l of bible.locations) lines.push(`- ${l.code} ${l.name} : ${l.short || '—'}${l.refAssetId ? '' : ' | SANS plaque'}`);
  }
  if (bible.props.length) {
    lines.push('\nOBJETS');
    for (const p of bible.props) lines.push(`- ${p.code} ${p.name} (${p.kind}) : ${p.short || '—'}`);
  }
  if (project.story?.beats.some((b) => b.description)) {
    lines.push(`\nSTRUCTURE ${structureById(project.story.structure).label}`);
    for (const b of project.story.beats) if (b.description) lines.push(`- ${b.title} : ${toPlain(b.description)}`);
  }
  if (opts.scenes !== false && scenes.length) {
    const shots = opts.shots ? await loadShots(projectId) : [];
    const shotCount = await prisma.shot.groupBy({ by: ['sceneId'], where: { projectId }, _count: true });
    const count = new Map(shotCount.map((s) => [s.sceneId, s._count]));
    const code = new Map(bible.characters.map((c) => [c.id, c.code]));
    const loc = new Map(bible.locations.map((l) => [l.id, l.code]));
    lines.push('\nSCÈNES');
    for (const s of scenes) {
      lines.push(
        `- Scène ${s.number} [id ${s.id}] ${s.setting} ${s.locationId ? loc.get(s.locationId) : '?'} ${s.timeOfDay} — ${s.title || 'sans titre'} | personnages : ${s.characterIds.map((id) => code.get(id)).join(', ') || 'aucun'} | ${count.get(s.id) ?? 0} plan(s)${s.description ? ` | ${toPlain(s.description).slice(0, 240)}` : ''}`,
      );
      if (opts.shots)
        for (const sh of shots.filter((x) => x.sceneId === s.id))
          lines.push(`    · ${sh.code} ${cameraFr({ size: sh.size, angle: sh.angle, lens: sh.lens, move: sh.move })} ${sh.durationSec}s — ${sh.action || sh.description} [${sh.characterIds.map((id) => code.get(id)).join(', ')}]`);
    }
  }
  if (opts.lint) {
    const r = lint(bible, scenes, await loadShots(projectId));
    const important = r.issues.filter((i) => i.level !== 'info').slice(0, 40);
    if (important.length) {
      lines.push(`\nCONTRÔLE (${r.counts.error} erreurs, ${r.counts.warning} avertissements)`);
      for (const i of important) lines.push(`- [${i.level}] ${i.where} : ${i.message}`);
    }
  }
  return lines.join('\n').slice(0, 30000);
}

type Ctx = { projectId: string; userId: string; modelId?: string };

async function ask<T>(ctx: Ctx, task: string, system: string, user: string, maxTokens = 8000) {
  const r = await runText({ ...ctx, task, system, messages: [{ role: 'user', content: user }], json: true, maxTokens });
  return { data: parseJsonReply<T>(r.text), model: r.model, costUsd: r.costUsd };
}

const SYSTEM = (digest: string, role: string) =>
  `Tu es ${role} dans un studio de production audiovisuelle. Tu travailles pour le projet ci-dessous et tu respectes strictement sa bible : ne contredis jamais un personnage, un lieu ou une règle du monde déjà établis.\n\n${digest}\n\n${LANG_RULE}\nRéponds uniquement par un objet JSON valide.`;

// ── Phase 1 : concept ──

export interface ConceptDraft {
  logline: string;
  tagline: string;
  synopsisShort: string;
  synopsisLong: string;
  pitch: string;
  genre: string;
  subgenre: string;
  themes: string[];
  conflicts: string;
  stakes: string;
  universe: string;
  characters: { name: string; role: string; description: string }[];
}

export async function draftConcept(ctx: Ctx, brief: Record<string, unknown>) {
  const digest = await projectDigest(ctx.projectId, { scenes: false });
  return ask<ConceptDraft>(
    ctx,
    'concept',
    SYSTEM(digest, 'un scénariste et développeur de projets'),
    `Transforme cette idée en concept cinématographique.\n\nBRIEF\n${JSON.stringify(Object.fromEntries(Object.entries(brief).map(([k, v]) => [k, typeof v === 'string' ? toPlain(v) : v])), null, 2)}\n\nForme attendue :\n{"logline": "une phrase", "tagline": "accroche courte", "synopsisShort": "5 lignes", "synopsisLong": "1 à 2 pages, découpé en paragraphes", "pitch": "le pitch oral en 30 secondes", "genre": "", "subgenre": "", "themes": ["…"], "conflicts": "conflit central et secondaires", "stakes": "ce qui est en jeu", "universe": "l'univers en un paragraphe", "characters": [{"name": "", "role": "protagoniste | antagoniste | …", "description": "2 phrases"}]}`,
  );
}

// ── Bible ──

export async function draftCharacter(ctx: Ctx, input: { name: string; notes?: string }) {
  const digest = await projectDigest(ctx.projectId, { scenes: false });
  const profileKeys = Object.keys(CHARACTER_PROFILE_FIELDS).join(', ');
  return ask<Record<string, any>>(
    ctx,
    'character',
    SYSTEM(digest, 'un directeur de casting et concepteur de personnages'),
    `Développe la fiche du personnage « ${input.name} ».${input.notes ? `\nNotes de l'auteur : ${toPlain(input.notes)}` : ''}\n\nLe champ "block" est la description physique GELÉE qui sera injectée dans chaque prompt d'image : visage, âge apparent, morphologie, cheveux, traits distinctifs, avec des mots concrets et visuels (pas de psychologie). "short" en est la version d'une phrase qui commence par le nom. "silhouette" est le marqueur qui l'identifie de loin. "never" liste ce que le modèle ne doit jamais lui donner.\n\nForme attendue :\n{"role": "", "age": "", "gender": "", "origin": "", "heightM": 1.75, "short": "", "block": "", "costume": "", "silhouette": "", "never": ["…"], "profile": {${profileKeys
      .split(', ')
      .map((k) => `"${k}": ""`)
      .join(', ')}}}`,
  );
}

export async function draftLocation(ctx: Ctx, input: { name: string; notes?: string }) {
  const digest = await projectDigest(ctx.projectId, { scenes: false });
  return ask<Record<string, any>>(
    ctx,
    'location',
    SYSTEM(digest, 'un chef décorateur'),
    `Développe la fiche du lieu « ${input.name} ».${input.notes ? `\nNotes : ${input.notes}` : ''}\n\n"block" est la description visuelle GELÉE du décor vide, injectée dans chaque prompt : architecture, matériaux, couleurs, mobilier, profondeur. "short" en une phrase.\n\nForme attendue :\n{"interior": true, "short": "", "block": "", "architecture": "", "era": "", "palette": "", "lighting": "", "weather": "", "mood": "", "textures": "", "objects": "", "sound": "", "never": ["…"]}`,
  );
}

export async function draftBeats(ctx: Ctx, structureId: string) {
  const digest = await projectDigest(ctx.projectId, { scenes: true });
  const s = structureById(structureId);
  return ask<{ beats: { key: string; description: string }[] }>(
    ctx,
    'story',
    SYSTEM(digest, 'un script doctor'),
    `Propose le contenu de chaque temps fort de la structure « ${s.label} » pour ce projet.\nTemps forts : ${s.beats.map((b) => `${b.key} (${b.title})`).join(', ')}.\n\nForme attendue : {"beats": [{"key": "…", "description": "3 à 5 phrases"}]}`,
  );
}

// ── Scénario ──

export const SCRIPT_ACTIONS = {
  continue: 'Continue la scène à partir de là, dans le même ton, sur une demi-page.',
  rewrite: 'Réécris ce passage en gardant le sens, avec une écriture plus précise et visuelle.',
  shorten: 'Raccourcis ce passage d’environ moitié sans perdre d’information dramatique.',
  expand: 'Développe ce passage : plus de détails visuels, de sous-texte, de rythme.',
  dialogue: 'Améliore les dialogues : plus naturels, plus de sous-texte, chaque personnage avec sa voix propre.',
  tension: 'Réécris ce passage pour y créer ou renforcer la tension.',
  humor: 'Réécris ce passage en y introduisant de l’humour, sans casser le ton du projet.',
  tone: 'Réécris ce passage dans le ton demandé.',
} as const;
export type ScriptAction = keyof typeof SCRIPT_ACTIONS;

export async function scriptAssist(ctx: Ctx, input: { action: ScriptAction; selection: string; before?: string; after?: string; tone?: string }) {
  const digest = await projectDigest(ctx.projectId, { scenes: false });
  return ask<{ fountain: string; note?: string }>(
    ctx,
    'script',
    SYSTEM(digest, 'un scénariste professionnel'),
    `${SCRIPT_ACTIONS[input.action]}${input.tone ? ` Ton demandé : ${input.tone}.` : ''}\nRespecte le format scénario (Fountain) : en-têtes INT./EXT., action au présent, NOMS en majuscules avant les répliques, didascalies entre parenthèses.\n\nCONTEXTE AVANT\n${(input.before ?? '').slice(-3000)}\n\nPASSAGE\n${input.selection || '(fin du texte : continuer)'}\n\nCONTEXTE APRÈS\n${(input.after ?? '').slice(0, 1500)}\n\nForme attendue : {"fountain": "le texte de remplacement, en Fountain", "note": "une phrase sur ce que tu as changé"}`,
  );
}

export async function scriptCoherence(ctx: Ctx, fountain: string) {
  const digest = await projectDigest(ctx.projectId, { scenes: false });
  return ask<{ issues: { level: 'error' | 'warning' | 'info'; where: string; message: string; fix?: string }[] }>(
    ctx,
    'coherence',
    SYSTEM(digest, 'un script doctor chargé de la cohérence'),
    `Relis ce scénario et détecte les incohérences : avec la bible (personnages, lieux, règles du monde), chronologie, personnages qui savent ce qu'ils ne devraient pas savoir, objets qui apparaissent ou disparaissent, blessures, costumes, heure et météo.\n\nSCÉNARIO\n${fountain.slice(0, 60000)}\n\nForme attendue : {"issues": [{"level": "error|warning|info", "where": "scène N ou réplique", "message": "", "fix": ""}]}`,
    6000,
  );
}

// ── Dépouillement, mise en scène, découpage ──

export async function breakdownScene(ctx: Ctx, input: { heading: string; text: string }) {
  const digest = await projectDigest(ctx.projectId, { scenes: false });
  return ask<{
    characters: string[];
    locationCode: string | null;
    breakdown: { props: string[]; costumes: string[]; vehicles: string[]; animals: string[]; vfx: string[]; sfx: string[]; music: string[]; ambience: string; lighting: string; weather: string; notes: string };
    summary: string;
    emotion: string;
    estSeconds: number;
  }>(
    ctx,
    'breakdown',
    SYSTEM(digest, 'un premier assistant réalisateur qui fait le dépouillement'),
    `Fais le dépouillement de cette scène. Pour "characters", renvoie les CODES de la bible (CH1…) des personnages présents ; un personnage absent de la bible se note par son nom en majuscules.\n\n${input.heading}\n${toPlain(input.text).slice(0, 20000)}\n\nForme attendue : {"characters": ["CH1"], "locationCode": "L1 ou null", "breakdown": {"props": [], "costumes": [], "vehicles": [], "animals": [], "vfx": [], "sfx": [], "music": [], "ambience": "", "lighting": "", "weather": "", "notes": ""}, "summary": "2 phrases", "emotion": "", "estSeconds": 60}`,
  );
}

export interface ShotDraft {
  description: string;
  action: string;
  size: string;
  angle: string;
  lens: string;
  move: string;
  durationSec: number;
  dialogue: string | null;
  characters: string[];
  composition: string;
  transition: string | null;
  note: string | null;
}

export async function draftShots(ctx: Ctx, sceneId: string, input: { count?: number; intention?: string }) {
  const scene = await prisma.scene.findUniqueOrThrow({ where: { id: sceneId }, include: { location: true } });
  const digest = await projectDigest(ctx.projectId, { scenes: true, shots: true });
  const project = await prisma.project.findUniqueOrThrow({ where: { id: ctx.projectId }, select: { motion: true } });
  const motion = (project.motion ?? {}) as { allowedMoves?: string[]; clipSeconds?: [number, number] };
  const moves = motion.allowedMoves?.length ? motion.allowedMoves : Object.keys(MOVES);
  const [min, max] = motion.clipSeconds ?? [2, 10];
  return ask<{ shots: ShotDraft[]; rationale: string }>(
    ctx,
    'shots',
    SYSTEM(digest, 'un réalisateur qui prépare son découpage technique'),
    `Découpe la scène ${scene.number} (${scene.title || 'sans titre'}) en ${input.count ? `${input.count} plans` : 'autant de plans que nécessaire'}.${input.intention ? `\nIntention : ${input.intention}` : ''}\nDirection existante : ${JSON.stringify(plainValues(scene.direction))}\nDescription : ${toPlain(scene.description)}\n\nContraintes techniques (le linter les vérifiera) :\n- size parmi ${Object.keys(SIZES).join(', ')}\n- angle parmi ${Object.keys(ANGLES).join(', ')}\n- move parmi ${moves.join(', ')}\n- durationSec entre ${min} et ${max}\n- characters : les CODES de la bible présents dans le plan\n- "action" décrit en anglais, au présent, UNE action visible et filmable ; "description" la résume en français.\n\nForme attendue : {"shots": [{"description": "", "action": "", "size": "MS", "angle": "EYE", "lens": "35mm", "move": "STATIC", "durationSec": 4, "dialogue": null, "characters": ["CH1"], "composition": "", "transition": "CUT", "note": null}], "rationale": "pourquoi ce découpage, 3 phrases"}`,
  );
}

export async function directScene(ctx: Ctx, sceneId: string, input: Record<string, string>) {
  const scene = await prisma.scene.findUniqueOrThrow({ where: { id: sceneId } });
  const digest = await projectDigest(ctx.projectId, { scenes: true, shots: true });
  return ask<{ direction: Record<string, string>; shots: ShotDraft[] }>(
    ctx,
    'direction',
    SYSTEM(digest, 'un réalisateur expérimenté'),
    `Propose la mise en scène de la scène ${scene.number} (${scene.title}).\nDemande de l'auteur : ${JSON.stringify(plainValues(input))}\nDescription : ${toPlain(scene.description)}\n\n"direction" : intention, emotion, rhythm, style, references, camera, lighting, acting (direction d'acteurs), sound. "shots" : le découpage proposé, avec size parmi ${Object.keys(SIZES).join('/')}, angle parmi ${Object.keys(ANGLES).join('/')}, move parmi ${Object.keys(MOVES).join('/')}.\n\nForme attendue : {"direction": {"intention": "", "emotion": "", "rhythm": "", "style": "", "references": "", "camera": "", "lighting": "", "acting": "", "sound": ""}, "shots": [{"description": "", "action": "", "size": "", "angle": "", "lens": "", "move": "", "durationSec": 4, "dialogue": null, "characters": [], "composition": "", "transition": "CUT", "note": null}]}`,
  );
}

export async function continuityAI(ctx: Ctx) {
  const digest = await projectDigest(ctx.projectId, { scenes: true, shots: true, lint: true });
  const script = await prisma.script.findUnique({ where: { projectId: ctx.projectId }, select: { fountain: true } });
  return ask<{ issues: { level: 'error' | 'warning' | 'info'; where: string; message: string; fix?: string }[] }>(
    ctx,
    'continuity',
    SYSTEM(digest, 'une scripte chargée de la continuité'),
    `Analyse la continuité du projet : vêtements, âge, coiffure, objets, lieux, météo, heure, blessures, chronologie, entre scènes et entre plans. Ne répète pas les problèmes déjà listés dans CONTRÔLE.\n\n${script?.fountain ? `SCÉNARIO\n${script.fountain.slice(0, 40000)}` : ''}\n\nForme attendue : {"issues": [{"level": "error|warning|info", "where": "scène N / plan NA", "message": "", "fix": ""}]}`,
    6000,
  );
}

// ── Prompt libre enrichi ──

export async function enrichPrompt(ctx: Ctx, input: { text: string; kind: 'image' | 'video' | 'audio' }) {
  const digest = await projectDigest(ctx.projectId, { scenes: false });
  return ask<{ subject: string; action: string; environment: string; lighting: string; camera: string; lens: string; composition: string; mood: string; style: string; continuity: string; prompt: string }>(
    ctx,
    'prompt',
    SYSTEM(digest, 'un directeur de la photographie qui écrit des prompts de génération'),
    `Transforme cette demande en prompt ${input.kind === 'video' ? 'vidéo' : input.kind === 'audio' ? 'audio (voix, ambiance ou effet sonore : décris le son, le timbre, l’espace, le rythme ; laisse vides les champs caméra)' : 'image'} complet, en anglais, en reprenant MOT POUR MOT les descriptions gelées de la bible pour les personnages et les lieux cités.\n\nDEMANDE\n${input.text}\n\nForme attendue : {"subject": "", "action": "", "environment": "", "lighting": "", "camera": "", "lens": "", "composition": "", "mood": "", "style": "", "continuity": "ce qui doit rester identique", "prompt": "le prompt final assemblé"}`,
  );
}

// ── Assistant de production ──

export const ASSISTANT_SYSTEM = (digest: string) => `Tu es l'assistant de production de régie, un studio de cinéma numérique. Tu connais le projet ci-dessous en détail et tu réponds de façon concrète et brève, en français.

${digest}

Tu peux proposer des actions que l'utilisateur appliquera d'un clic. Pour cela, termine ta réponse par un bloc :
\`\`\`regie-actions
[{"type": "create_shots", "sceneId": "<id de scène>", "shots": [{"description": "", "action": "", "size": "MS", "angle": "EYE", "lens": "35mm", "move": "STATIC", "durationSec": 4, "characters": ["CH1"], "dialogue": null}]},
 {"type": "open", "href": "/projects/<projectId>/…", "label": ""}]
\`\`\`
Types disponibles : create_shots (ajoute des plans à une scène), open (lien vers une page du projet : concept, story, characters, locations, world, script, scenes, storyboard, assets, images, videos, production, continuity).
N'invente jamais un identifiant : utilise ceux listés. Si une information manque dans le projet, dis-le plutôt que de la supposer. Tu ne génères jamais d'image ni de vidéo toi-même : tu prépares les prompts et l'utilisateur lance la génération.`;

export async function* assistantStream(ctx: Ctx, history: { role: 'user' | 'assistant'; content: string }[], signal?: AbortSignal) {
  const digest = await projectDigest(ctx.projectId, { scenes: true, shots: true, lint: true });
  yield* streamText({ ...ctx, task: 'assistant', system: ASSISTANT_SYSTEM(digest).replaceAll('<projectId>', ctx.projectId), messages: history.slice(-20), maxTokens: 8000 }, signal);
}
