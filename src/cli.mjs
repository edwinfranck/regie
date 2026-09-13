#!/usr/bin/env node
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { loadFilm, resolveShot, allShots, findShot } from './film.mjs';
import { validate, BADGE } from './validate.mjs';
import { cameraFr } from './camera.mjs';
import { TARGETS, get as getTarget, videoTargets } from './targets/index.mjs';

const argv = process.argv.slice(2);
const cmd = argv[0];
const flag = (n, d) => { const i = argv.indexOf(`--${n}`); return i === -1 ? d : argv[i + 1]; };
const has = (n) => argv.includes(`--${n}`);
const dir = flag('film', process.env.REGIE_FILM || process.cwd());

const B = (s) => `\x1b[1m${s}\x1b[0m`;
const D = (s) => `\x1b[2m${s}\x1b[0m`;
const rule = (t = '') => console.log(D('─'.repeat(4) + (t ? ` ${t} ` : '') + '─'.repeat(Math.max(0, 66 - t.length))));

const render = (out, title) => {
  rule(title);
  console.log(out.text);
  if (out.negative?.length) { console.log(`\n${B('NEVER:')} ${out.negative.join(', ')}.`); }
  if (out.refs?.length) { console.log(`\n${B('REFERENCES A CHARGER')}`); out.refs.forEach((r) => console.log(`  • ${r}`)); }
  if (out.notes?.length) { console.log(''); out.notes.forEach((n) => console.log(D(`  ℹ ${n}`))); }
  console.log('');
};

try {
  if (!cmd || cmd === 'help' || has('help')) {
    console.log(`
${B('regie')} — une bible, un decoupage, N moteurs.

  regie check                   verifie la bible et le decoupage
  regie list                    la feuille de plans
  regie shot <id> [--target t]  la fiche de plan et ses prompts
  regie sheet <id>              une planche storyboard multi-cases
  regie build [--out dossier]   ecrit tous les prompts sur disque
  regie serve [--port 4173]     ouvre l'outil dans le navigateur

  --film <dossier>   dossier du film (defaut : dossier courant, ou $REGIE_FILM)
  --target <id>      ${Object.keys(TARGETS).join(', ')}
`);
    process.exit(0);
  }

  const film = loadFilm(dir);

  if (cmd === 'serve') {
    const { serve } = await import('./server.mjs');
    serve(dir, Number(flag('port', 4173)));
  }

  if (cmd === 'check') {
    const { issues, total } = validate(film);
    const n = (l) => issues.filter((i) => i.level === l).length;
    rule(`${film.bible.film.title} — ${film.plans.episode.id}`);
    for (const i of issues) console.log(`${BADGE[i.level]} ${B(i.where)}  ${i.msg}\n   ${D('→ ' + i.fix)}`);
    console.log(`\n${issues.length ? '' : '✅ rien a signaler. '}${allShots(film).length} plans · ${total}s cumulees`);
    console.log(`${n('error')} erreur(s) · ${n('block')} bloquant(s) generation · ${n('warn')} avertissement(s)`);
    process.exit(n('error') ? 1 : 0);
  }

  if (cmd === 'list') {
    rule(`${film.bible.film.title} — ${film.plans.episode.id} — ${film.plans.episode.title || ''}`);
    for (const s of allShots(film)) {
      const spec = resolveShot(film, s);
      const who = spec.characters.map((c) => c.id).join('+') || '—';
      console.log(`${B(String(s.id).padStart(2))} ${String(spec.duration + 's').padEnd(3)} ${spec.location.id} ${who.padEnd(9)} ${D(cameraFr(spec.camera).padEnd(46))} ${(spec.action || '').slice(0, 40)}`);
    }
    process.exit(0);
  }

  if (cmd === 'shot') {
    const shot = findShot(film, argv[1]);
    if (!shot) throw new Error(`Plan "${argv[1]}" absent de plans.yaml`);
    const spec = resolveShot(film, shot);
    rule(`PLAN ${spec.episode}-${spec.id}`);
    console.log(`${B('Duree')}    ${spec.duration}s`);
    console.log(`${B('Lieu')}     ${spec.location.id} ${spec.location.name}`);
    console.log(`${B('Casting')}  ${spec.characters.map((c) => `${c.id} ${c.name}`).join(', ') || '—'}`);
    console.log(`${B('Camera')}   ${cameraFr(spec.camera)}`);
    console.log(`${B('Action')}   ${spec.action}`);
    if (spec.dialogue) console.log(`${B('Voix')}     ${spec.dialogue.speaker} : « ${spec.dialogue.line} »`);
    if (spec.sound) console.log(`${B('Son')}      ${spec.sound}`);
    console.log('');
    const targets = flag('target') ? [getTarget(flag('target'))] : [TARGETS.still, ...videoTargets()];
    for (const t of targets) render(t.render(spec), t.label.toUpperCase());
    process.exit(0);
  }

  if (cmd === 'sheet') {
    const sheet = (film.plans.sheets || []).find((s) => String(s.id) === String(argv[1]));
    if (!sheet) throw new Error(`Planche "${argv[1]}" absente. Disponibles : ${(film.plans.sheets || []).map((s) => s.id).join(', ')}`);
    const specs = sheet.shots.map((id) => resolveShot(film, findShot(film, id)));
    render(TARGETS.sheet.render(specs, sheet), `PLANCHE ${sheet.id} — ${sheet.title || ''}`);
    process.exit(0);
  }

  if (cmd === 'build') {
    const out = flag('out', join(film.base, 'out'));
    mkdirSync(out, { recursive: true });
    let n = 0;
    for (const shot of allShots(film)) {
      const spec = resolveShot(film, shot);
      const parts = [`# PLAN ${spec.episode}-${spec.id}`, `${spec.duration}s · ${spec.location.id} · ${cameraFr(spec.camera)}`, `${spec.action}`];
      for (const t of [TARGETS.still, ...videoTargets()]) {
        const o = t.render(spec);
        parts.push(`\n## ${t.label}\n\n\`\`\`\n${o.text}${o.negative?.length ? `\n\nNEVER: ${o.negative.join(', ')}.` : ''}\n\`\`\``);
        if (o.refs?.length) parts.push(`References : ${o.refs.join(' · ')}`);
      }
      writeFileSync(join(out, `plan-${String(spec.id).padStart(2, '0')}.md`), parts.join('\n') + '\n');
      n++;
    }
    for (const sheet of film.plans.sheets || []) {
      const specs = sheet.shots.map((id) => resolveShot(film, findShot(film, id)));
      const o = TARGETS.sheet.render(specs, sheet);
      writeFileSync(join(out, `planche-${sheet.id}.md`), `# PLANCHE ${sheet.id} — ${sheet.title || ''}\n\n\`\`\`\n${o.text}\n\nNEVER: ${o.negative.join(', ')}.\n\`\`\`\n\nReferences : ${o.refs.join(' · ')}\n`);
      n++;
    }
    console.log(`✅ ${n} fichiers ecrits dans ${out}`);
    process.exit(0);
  }

  if (cmd !== 'serve') throw new Error(`Commande inconnue : "${cmd}". Voir regie help.`);
} catch (e) {
  console.error(`❌ ${e.message}`);
  process.exit(1);
}
