import { resolveShot, allShots } from './film.mjs';
import { SIZES, ANGLES, MOVES } from './camera.mjs';

// Le linter de bible. Il attrape avant generation ce qu'on ne voit
// d'habitude qu'apres avoir brule des credits : mouvement interdit,
// plan surcharge, reference d'image manquante, duo interdit.
export function validate(film) {
  const issues = [];
  const add = (level, where, msg, fix) => issues.push({ level, where, msg, fix });
  const { bible, plans } = film;
  const rules = bible.rules || {};

  for (const id of Object.keys(bible.characters || {})) {
    const c = bible.characters[id];
    if (c.frozen && !c.ref) add('error', id, `${id} est declare gele mais n'a pas de ref image.`, 'Ajouter ref: ou retirer frozen:.');
    if (!c.never?.length) add('warn', id, `${id} n'a aucune ligne NEVER.`, 'Un bloc sans NEVER laisse le modele inventer.');
  }
  for (const [id, l] of Object.entries(bible.locations || {}))
    if (!l.ref) add('block', id, `${id} ${l.name} n'a pas de plaque de decor.`, 'Generer la plaque avant tout plan situe la.');

  let total = 0;
  for (const shot of allShots(film)) {
    const where = `plan ${shot.id}`;
    let spec;
    try { spec = resolveShot(film, shot); }
    catch (e) { add('error', where, e.message, 'Identifiant absent de bible.yaml.'); continue; }
    total += spec.duration || 0;

    const cam = spec.camera;
    if (!cam.size) add('error', where, 'aucune taille de plan.', `Ajouter camera.size (${Object.keys(SIZES).join('/')}).`);
    if (cam.size && !SIZES[cam.size])   add('error', where, `taille "${cam.size}" inconnue.`, `Valeurs : ${Object.keys(SIZES).join(', ')}`);
    if (cam.angle && !ANGLES[cam.angle]) add('error', where, `angle "${cam.angle}" inconnu.`, `Valeurs : ${Object.keys(ANGLES).join(', ')}`);
    if (cam.move && !MOVES[cam.move])   add('error', where, `mouvement "${cam.move}" inconnu.`, `Valeurs : ${Object.keys(MOVES).join(', ')}`);

    const allowed = bible.motion?.allowed_moves;
    if (allowed && cam.move && !allowed.includes(cam.move))
      add('error', where, `mouvement ${cam.move} interdit par le bloc MOTION.`, `Autorises : ${allowed.join(', ')}.`);

    const [min, max] = bible.motion?.clip_seconds || [];
    if (min && spec.duration < min) add('warn', where, `${spec.duration}s sous le minimum de ${min}s.`, 'Rallonger ou fusionner.');
    if (max && spec.duration > max) add('error', where, `${spec.duration}s au-dessus du maximum de ${max}s.`, 'Couper le plan en deux : un plan long est la ou le style derive.');

    const maxCh = rules.max_characters_per_shot;
    if (maxCh && spec.characters.length > maxCh && !spec.group)
      add('error', where, `${spec.characters.length} personnages pour un maximum de ${maxCh}.`, 'Poser group: true et une strategie de repli, ou redecouper.');
    if (spec.group && !spec.note)
      add('warn', where, 'plan de groupe sans strategie de repli ecrite.', 'Renseigner note:.');

    // Les duos a risque de confusion : interdits en plan normal, tolores en plan
    // de groupe, ou les visages sont reduits et ou seule la silhouette identifie.
    for (const pair of rules.never_together || []) {
      const ids = spec.characters.map((c) => c.id);
      if (!pair.every((p) => ids.includes(p))) continue;
      if (spec.group) add('warn', where, `${pair.join(' et ')} partagent ce plan de groupe.`, 'Tolere seulement parce que les visages sont reduits : verifier que les marqueurs de silhouette les separent.');
      else add('error', where, `${pair.join(' et ')} ne doivent jamais partager un plan.`, 'Risque de confusion identifie dans la bible.');
    }

    for (const c of spec.characters) if (!c.ref) add('block', where, `${c.id} ${c.name} n'a pas de feuille.`, 'Aucun plan ne se genere sans elle.');
    if (!spec.location.ref) add('block', where, `${spec.location.id} n'a pas de plaque.`, 'Generer la plaque du decor.');
    if (spec.props.length && !bible.assets?.props_sheet) add('block', where, 'accessoires utilises sans planche d’objets.', 'Generer ASSETS_planche.');
  }

  const target = plans.episode.target_seconds;
  if (target && Math.abs(total - target) > 5)
    add('warn', 'episode', `duree cumulee ${total}s pour une cible de ${target}s.`, 'Ajuster le decoupage.');

  return { issues, total };
}

export const BADGE = { error: '❌', warn: '⚠️ ', block: '⛔' };
