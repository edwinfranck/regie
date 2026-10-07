import type { Bible, SceneInput, ShotInput } from './bible';
import { ANGLES, MOVES, SIZES } from './camera';
import { ContextError, resolveShot } from './context';

// Le linter de bible et le vérificateur de continuité. Il attrape avant
// génération ce qu'on ne voit d'habitude qu'après avoir brûlé des crédits :
// mouvement interdit, plan surchargé, référence manquante, duo interdit,
// lumière qui contredit l'heure de la scène.
//
// Tout ce qui est ici est déterministe. Les incohérences qui demandent de
// lire le texte (une blessure qui disparaît, un costume décrit autrement)
// relèvent de l'analyse IA, lancée depuis l'assistant.

export type IssueLevel = 'error' | 'warning' | 'info';

export interface Issue {
  level: IssueLevel;
  /** Bloquant : aucune génération du plan ne devrait partir tant que ce n'est pas réglé. */
  blocking?: boolean;
  code: string;
  where: string;
  entity?: { type: 'character' | 'location' | 'prop' | 'scene' | 'shot' | 'project'; id: string };
  message: string;
  fix?: string;
}

export interface LintResult {
  issues: Issue[];
  totalSeconds: number;
  counts: Record<IssueLevel, number>;
  blocking: number;
}

export function lint(bible: Bible, scenes: SceneInput[], shots: ShotInput[]): LintResult {
  const issues: Issue[] = [];
  const add = (i: Issue) => issues.push(i);
  const rules = bible.project.rules ?? {};
  const motion = bible.project.motion ?? {};
  const scenesById = new Map(scenes.map((s) => [s.id, s]));
  const codeOf = new Map(bible.characters.map((c) => [c.id, c.code]));

  // ── La bible ──
  for (const c of bible.characters) {
    const entity = { type: 'character' as const, id: c.id };
    if (c.frozen && !c.refAssetId)
      add({ level: 'error', code: 'frozen-without-ref', where: c.code, entity, message: `${c.name} est gelé mais n'a pas d'image de référence.`, fix: 'Générer ou importer sa feuille, ou le dégeler.' });
    if (!c.block.trim())
      add({ level: 'warning', code: 'no-block', where: c.code, entity, message: `${c.name} n'a pas de description gelée.`, fix: 'Sans bloc, chaque génération réinvente son visage.' });
    if (!c.never.length)
      add({ level: 'info', code: 'no-never', where: c.code, entity, message: `${c.name} n'a aucun interdit.`, fix: 'Un bloc sans NEVER laisse le modèle inventer.' });
  }
  for (const l of bible.locations)
    if (!l.refAssetId)
      add({ level: 'warning', code: 'location-no-plate', where: l.code, entity: { type: 'location', id: l.id }, message: `${l.name} n'a pas de plaque de décor.`, fix: 'Générer la plaque avant tout plan situé là.' });
  if (!bible.styles.length)
    add({ level: 'warning', code: 'no-style', where: 'projet', entity: { type: 'project', id: bible.project.id }, message: 'Aucun style de rendu déclaré.', fix: 'Sans style, chaque plan choisit le sien.' });

  const usedCharacters = new Set<string>();

  // ── Les scènes ──
  const numbers = new Map<number, number>();
  for (const s of scenes) numbers.set(s.number, (numbers.get(s.number) ?? 0) + 1);
  for (const s of scenes) {
    const where = `scène ${s.number}`;
    const entity = { type: 'scene' as const, id: s.id };
    if ((numbers.get(s.number) ?? 0) > 1)
      add({ level: 'error', code: 'scene-number-dup', where, entity, message: `numéro ${s.number} utilisé par plusieurs scènes.`, fix: 'Renuméroter.' });
    if (!s.locationId) add({ level: 'info', code: 'scene-no-location', where, entity, message: 'aucun lieu.', fix: 'Choisir un lieu de la bible.' });
    const light = bible.lights.find((l) => l.id === s.lightId);
    if (light && contradicts(s.timeOfDay, light.code))
      add({ level: 'warning', code: 'light-vs-time', where, entity, message: `scène de ${s.timeOfDay.toLowerCase()} éclairée en ${light.code}.`, fix: 'Aligner l’état de lumière sur l’heure de la scène.' });
    if (!shots.some((sh) => sh.sceneId === s.id))
      add({ level: 'info', code: 'scene-no-shots', where, entity, message: 'aucun plan.', fix: 'Découper la scène.' });
    s.characterIds.forEach((id) => usedCharacters.add(id));
  }

  // ── Les plans ──
  let total = 0;
  for (const shot of shots) {
    const scene = scenesById.get(shot.sceneId) ?? null;
    const where = `plan ${shot.code}`;
    const entity = { type: 'shot' as const, id: shot.id };
    let spec;
    try {
      spec = resolveShot(bible, shot, scene);
    } catch (e) {
      add({ level: 'error', code: 'unresolved', where, entity, message: e instanceof ContextError ? e.message : String(e), fix: 'Identifiant absent de la bible.' });
      continue;
    }
    total += spec.duration || 0;
    shot.characterIds.forEach((id) => usedCharacters.add(id));

    const cam = spec.camera;
    if (!cam.size) add({ level: 'warning', code: 'no-size', where, entity, message: 'aucune taille de plan.', fix: `Choisir parmi ${Object.keys(SIZES).join(', ')}.` });
    if (cam.size && !(cam.size in SIZES)) add({ level: 'error', code: 'bad-size', where, entity, message: `taille « ${cam.size} » inconnue.` });
    if (cam.angle && !(cam.angle in ANGLES)) add({ level: 'error', code: 'bad-angle', where, entity, message: `angle « ${cam.angle} » inconnu.` });
    if (cam.move && !(cam.move in MOVES)) add({ level: 'error', code: 'bad-move', where, entity, message: `mouvement « ${cam.move} » inconnu.` });

    if (motion.allowedMoves?.length && cam.move && !motion.allowedMoves.includes(cam.move))
      add({ level: 'error', code: 'move-forbidden', where, entity, message: `mouvement ${cam.move} interdit par les règles de mouvement.`, fix: `Autorisés : ${motion.allowedMoves.join(', ')}.` });

    const [min, max] = motion.clipSeconds ?? [];
    if (min && spec.duration < min) add({ level: 'warning', code: 'too-short', where, entity, message: `${spec.duration}s sous le minimum de ${min}s.`, fix: 'Rallonger ou fusionner.' });
    if (max && spec.duration > max)
      add({ level: 'error', code: 'too-long', where, entity, message: `${spec.duration}s au-dessus du maximum de ${max}s.`, fix: 'Couper le plan en deux : un plan long est là où le style dérive.' });

    const maxCh = rules.maxCharactersPerShot;
    if (maxCh && spec.characters.length > maxCh && !spec.group)
      add({ level: 'error', code: 'too-many-characters', where, entity, message: `${spec.characters.length} personnages pour un maximum de ${maxCh}.`, fix: 'Marquer « plan de groupe » avec une stratégie de repli, ou redécouper.' });
    if (spec.group && !spec.note) add({ level: 'warning', code: 'group-no-note', where, entity, message: 'plan de groupe sans stratégie de repli écrite.', fix: 'Renseigner la note.' });

    // Les duos à risque de confusion : interdits en plan normal, tolérés en plan
    // de groupe où les visages sont réduits et où seule la silhouette identifie.
    const codes = spec.characters.map((c) => c.code);
    for (const pair of rules.neverTogether ?? []) {
      if (!pair.length || !pair.every((p) => codes.includes(p))) continue;
      if (spec.group)
        add({ level: 'warning', code: 'pair-in-group', where, entity, message: `${pair.join(' et ')} partagent ce plan de groupe.`, fix: 'Vérifier que les marqueurs de silhouette les séparent.' });
      else add({ level: 'error', code: 'pair-forbidden', where, entity, message: `${pair.join(' et ')} ne doivent jamais partager un plan.`, fix: 'Risque de confusion déclaré dans les règles.' });
    }

    // Continuité avec la scène.
    if (scene) {
      if (shot.locationId && scene.locationId && shot.locationId !== scene.locationId)
        add({ level: 'warning', code: 'shot-location-vs-scene', where, entity, message: `lieu différent de celui de la scène ${scene.number}.`, fix: 'Voulu (insert, raccord) ? Sinon aligner.' });
      const strangers = shot.characterIds.filter((id) => !scene.characterIds.includes(id));
      if (scene.characterIds.length && strangers.length)
        add({ level: 'info', code: 'shot-cast-vs-scene', where, entity, message: `${strangers.map((id) => codeOf.get(id) ?? id).join(', ')} absent(s) de la distribution de la scène.`, fix: 'Ajouter à la scène ou retirer du plan.' });
      if (spec.light && contradicts(scene.timeOfDay, spec.light.code))
        add({ level: 'warning', code: 'shot-light-vs-time', where, entity, message: `lumière ${spec.light.code} dans une scène de ${scene.timeOfDay.toLowerCase()}.` });
    }

    // Références : bloquant. Aucun plan ne devrait partir sans elles.
    for (const c of spec.characters)
      if (!c.refAssetId) add({ level: 'error', blocking: true, code: 'character-no-ref', where, entity, message: `${c.code} ${c.name} n'a pas de feuille de référence.`, fix: 'Aucun plan ne se génère sans elle.' });
    if (spec.location && spec.location.id && !spec.location.refAssetId)
      add({ level: 'error', blocking: true, code: 'location-no-ref', where, entity, message: `${spec.location.code} n'a pas de plaque.`, fix: 'Générer la plaque du décor.' });
    if (spec.props.length && !rules.propsSheetKey && spec.props.some((p) => !p.refAssetId))
      add({ level: 'warning', code: 'props-no-sheet', where, entity, message: 'accessoires utilisés sans planche d’objets.', fix: 'Générer la planche d’objets.' });
  }

  for (const c of bible.characters)
    if (!usedCharacters.has(c.id))
      add({ level: 'info', code: 'character-unused', where: c.code, entity: { type: 'character', id: c.id }, message: `${c.name} n'apparaît dans aucune scène.` });

  const target = rules.targetSeconds;
  if (target && Math.abs(total - target) > Math.max(5, target * 0.05))
    add({ level: 'warning', code: 'duration-vs-target', where: 'projet', entity: { type: 'project', id: bible.project.id }, message: `durée cumulée ${Math.round(total)}s pour une cible de ${target}s.`, fix: 'Ajuster le découpage.' });

  const counts = { error: 0, warning: 0, info: 0 } as Record<IssueLevel, number>;
  for (const i of issues) counts[i.level]++;
  return { issues, totalSeconds: total, counts, blocking: issues.filter((i) => i.blocking).length };
}

const NIGHTLY = /NIGHT|NUIT|DUSK|CREPUSCULE|MOON/i;
const DAYLY = /DAY|JOUR|NOON|MIDI|MORNING|MATIN/i;
/** Une scène de nuit éclairée DAY, ou l'inverse. Les états ambigus ne contredisent rien. */
export function contradicts(timeOfDay: string, lightCode: string) {
  const night = NIGHTLY.test(timeOfDay);
  const day = DAYLY.test(timeOfDay) && !night;
  if (night) return DAYLY.test(lightCode) && !NIGHTLY.test(lightCode);
  if (day) return NIGHTLY.test(lightCode);
  return false;
}
