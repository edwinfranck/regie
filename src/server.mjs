import { createServer } from 'node:http';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve, extname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { loadFilm, resolveShot, allShots, findShot, activeLook } from './film.mjs';
import { validate } from './validate.mjs';
import { cameraFr, SIZES, ANGLES, MOVES } from './camera.mjs';
import { TARGETS, videoTargets } from './targets/index.mjs';
import { charSheetPrompt, locationPlatePrompt, propsSheetPrompt, lineupPrompt } from './assets.mjs';
import * as store from './store.mjs';

const PUBLIC = resolve(fileURLToPath(new URL('../public', import.meta.url)));
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml',
  '.jpeg': 'image/jpeg', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif' };

const json = (res, data, code = 200) => { res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(data)); };
const body = (req) => new Promise((ok, no) => { let b = ''; req.on('data', (c) => { b += c; if (b.length > 2e7) no(new Error('corps trop volumineux')); }); req.on('end', () => { try { ok(b ? JSON.parse(b) : {}); } catch (e) { no(e); } }); });

const P = (pid) => { const p = store.projectById(pid); if (!p) throw new Error('projet inconnu'); return p; };
const files = (pid) => { const p = P(pid); return { p, bible: join(p.path, 'regie', 'bible.yaml'), plans: join(p.path, 'regie', 'plans.yaml') }; };

export function serve(port = 4173) {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const path = url.pathname;
    const seg = path.split('/').filter(Boolean);
    try {
      /* ── projets ─────────────────────────────────────────── */
      if (path === '/api/projects' && req.method === 'GET') return json(res, { projects: store.listProjects() });
      if (path === '/api/projects' && req.method === 'POST') {
        const b = await body(req);
        if (b.op === 'create') return json(res, { id: store.createProject(b) });
        if (b.op === 'import') return json(res, { id: store.registerProject(b.path, b.title) });
        if (b.op === 'forget') { store.forgetProject(b.id); return json(res, { ok: true }); }
        return json(res, { error: 'op inconnue' }, 400);
      }

      /* ── tout le reste est porte par un projet ────────────── */
      if (seg[0] === 'api' && seg[1] === 'p') {
        const pid = decodeURIComponent(seg[2]);
        const what = seg[3];
        const film = () => loadFilm(P(pid).path);

        if (what === 'film') {
          const f = film();
          const { issues, total } = validate(f);
          return json(res, {
            project: P(pid), title: f.bible.film.title, format: f.bible.film.format, episode: f.plans.episode,
            issues, total, shots: allShots(f).map((s) => summary(f, s)),
            sheets: f.plans.sheets || [], scenes: f.plans.sheets || [],
            plates: Object.fromEntries(Object.entries(f.bible.locations || {}).map(([id, l]) => [id, l.ref]).filter(([, r]) => r)),
            look: { active: f.bible.look.active, variants: Object.entries(f.bible.look.variants || {}).map(([id, v]) => ({ id, ...v })) },
            rules: f.bible.rules || {}, motion: f.bible.motion || {}, light: f.bible.light || {},
            vocab: { SIZES, ANGLES, MOVES, allowed: f.bible.motion?.allowed_moves || Object.keys(MOVES) },
          });
        }

        if (what === 'script') {
          const p = P(pid); const file = join(p.path, 'Script.md');
          if (req.method === 'POST') { const b = await body(req); writeFileSync(file, b.text ?? ''); return json(res, { ok: true }); }
          return json(res, { text: existsSync(file) ? readFileSync(file, 'utf8') : '', file: 'Script.md' });
        }

        if (what === 'assets') {
          const f = film(); const b = f.bible;
          const has = (r) => !!r && existsSync(resolve(f.dir, r));
          const mk = (kind, id, x, extra) => ({ id, kind, ref: x.ref || null, exists: has(x.ref), ...extra });
          return json(res, {
            look: activeLook(b),
            characters: Object.entries(b.characters || {}).map(([id, c]) => mk('characters', id, c, {
              name: c.name || '', sub: c.role || '', height_m: c.height_m ?? '', frozen: !!c.frozen,
              block: c.block || '', short: c.short || '', costume: c.costume || '', silhouette: c.silhouette || '',
              never: c.never || [], prompt: charSheetPrompt(b, { ...c, id }) })),
            locations: Object.entries(b.locations || {}).map(([id, l]) => mk('locations', id, l, {
              name: l.name || '', sub: 'lieu', block: l.block || '', short: l.short || '', sound: l.sound || '',
              never: l.never || [], prompt: locationPlatePrompt(b, l) })),
            props: Object.entries(b.props || {}).map(([id, x]) => mk('props', id, x, {
              name: x.name || '', sub: 'accessoire', block: x.block || '', short: x.short || '', never: x.never || [],
              prompt: propsSheetPrompt(b) })),
            plates: [
              { id: 'LINEUP', kind: 'plate', name: 'Planche d’alignement', sub: 'tout le casting à la même échelle', ref: b.assets?.lineup || null, exists: has(b.assets?.lineup), field: 'lineup', prompt: lineupPrompt(b), never: [] },
              { id: 'ASSETS', kind: 'plate', name: 'Planche d’objets', sub: 'les accessoires à la même échelle', ref: b.assets?.props_sheet || null, exists: has(b.assets?.props_sheet), field: 'props_sheet', prompt: propsSheetPrompt(b), never: [] },
            ],
          });
        }

        // Création / modification / suppression d'une entité de la bible.
        if (what === 'entity' && req.method === 'POST') {
          const { kind, id, patch = {}, op } = await body(req);
          if (!['characters', 'locations', 'props'].includes(kind)) return json(res, { error: 'type inconnu' }, 400);
          const { bible } = files(pid);
          store.edit(bible, (doc) => {
            if (op === 'delete') return doc.deleteIn([kind, id]);
            if (op === 'create') {
              if (doc.getIn([kind, id])) throw new Error(`${id} existe déjà`);
              doc.setIn([kind, id], store.val(doc, patch, { flowKeys: ['never'] }));
              store.block(doc.get(kind));
              return;
            }
            if (op === 'rename') {
              const cur = doc.getIn([kind, id])?.toJSON?.() ?? doc.getIn([kind, id]);
              if (!cur) throw new Error('introuvable');
              if (doc.getIn([kind, patch.to])) throw new Error(`${patch.to} existe déjà`);
              doc.deleteIn([kind, id]); doc.setIn([kind, patch.to], cur); return;
            }
            store.applyPatch(doc, [kind, id], patch);
          });
          return json(res, { ok: true });
        }

        // Le découpage : créer, modifier, supprimer, réordonner un plan.
        if (what === 'shot' && req.method === 'POST') {
          const { id, patch = {}, op, to } = await body(req);
          const { plans } = files(pid);
          store.edit(plans, (doc) => {
            const list = doc.get('shots');
            const idx = list ? list.items.findIndex((i) => String(i.get('id')) === String(id)) : -1;
            if (op === 'create') {
              const ids = (list?.items || []).map((i) => Number(i.get('id')) || 0);
              const next = patch.id ?? (ids.length ? Math.max(...ids) + 1 : 1);
              if (!list) doc.set('shots', []);
              doc.addIn(['shots'], store.val(doc, { id: next, duration: 3, location: patch.location ?? null,
                characters: [], props: [], camera: { size: 'MS', angle: 'EYE', lens: '35mm', move: 'STATIC' },
                action: patch.action ?? '' }, { flowKeys: ['camera'] }));
              store.block(doc.get('shots'));
              return next;
            }
            if (idx === -1) throw new Error('plan introuvable');
            if (op === 'delete') return doc.deleteIn(['shots', idx]);
            if (op === 'move') { const it = list.items.splice(idx, 1)[0]; list.items.splice(Math.max(0, Math.min(list.items.length, to)), 0, it); return; }
            for (const [k, v] of Object.entries(patch)) {
              if (k === 'camera') { for (const [ck, cv] of Object.entries(v)) cv === null || cv === '' ? doc.deleteIn(['shots', idx, 'camera', ck]) : doc.setIn(['shots', idx, 'camera', ck], cv); }
              else if (v === null) doc.deleteIn(['shots', idx, k]);
              else doc.setIn(['shots', idx, k], store.val(doc, v));
            }
          });
          const f = film(); const { issues } = validate(f);
          return json(res, { ok: true, issues, shots: allShots(f).map((s) => summary(f, s)) });
        }

        if (what === 'sheet' && req.method === 'POST') {
          const { id, patch = {}, op } = await body(req);
          const { plans } = files(pid);
          store.edit(plans, (doc) => {
            const list = doc.get('sheets');
            const idx = list ? list.items.findIndex((i) => String(i.get('id')) === String(id)) : -1;
            if (op === 'create') {
              if (!list) doc.set('sheets', []);
              doc.addIn(['sheets'], store.val(doc, { id: patch.id, title: patch.title || '', shots: patch.shots || [] }, { flow: true }));
              store.block(doc.get('sheets'));
              return;
            }
            if (idx === -1) throw new Error('planche introuvable');
            if (op === 'delete') return doc.deleteIn(['sheets', idx]);
            for (const [k, v] of Object.entries(patch)) doc.setIn(['sheets', idx, k], store.val(doc, v));
          });
          return json(res, { ok: true });
        }

        // Réglages du projet : titre, format, épisode, règles, mouvement, styles.
        if (what === 'meta' && req.method === 'POST') {
          const { target, patch = {}, op, id } = await body(req);
          const { bible, plans } = files(pid);
          const file = target === 'episode' ? plans : bible;
          const base = { film: ['film'], episode: ['episode'], rules: ['rules'], motion: ['motion'], look: ['look'],
            variant: ['look', 'variants', id], light: ['light', id], assets: ['assets'], sound: ['sound'] }[target];
          if (!base) return json(res, { error: 'cible inconnue' }, 400);
          store.edit(file, (doc) => {
            if (op === 'delete') return doc.deleteIn(base);
            if (op === 'create') { doc.setIn(base, store.val(doc, patch)); return; }
            store.applyPatch(doc, base, patch);
          });
          return json(res, { ok: true });
        }

        // Import d'une image de référence dans le projet.
        if (what === 'upload' && req.method === 'POST') {
          const { name, data, assign } = await body(req);
          const p = P(pid);
          const safe = basename(String(name || 'image')).replace(/[^A-Za-z0-9._-]/g, '_');
          mkdirSync(join(p.path, 'refs'), { recursive: true });
          const rel = join('refs', safe);
          writeFileSync(join(p.path, rel), Buffer.from(String(data).split(',').pop(), 'base64'));
          if (assign?.kind === 'plate') store.edit(files(pid).bible, (doc) => doc.setIn(['assets', assign.field], rel));
          else if (assign?.kind) store.edit(files(pid).bible, (doc) => doc.setIn([assign.kind, assign.id, 'ref'], rel));
          return json(res, { ok: true, path: rel });
        }

        if (what === 'shots' && seg[4]) {
          const f = film(); const shot = findShot(f, decodeURIComponent(seg[4]));
          if (!shot) return json(res, { error: 'plan introuvable' }, 404);
          const spec = resolveShot(f, shot);
          return json(res, { ...summary(f, shot), sound: spec.sound, note: spec.note, light: spec.light.id,
            props: spec.props.map((x) => ({ id: x.id, name: x.name })), refs: spec.refs,
            targets: [TARGETS.still, ...videoTargets()].map((t) => ({ id: t.id, label: t.label, kind: t.kind, ...t.render(spec) })) });
        }

        if (what === 'sheets' && seg[4]) {
          const f = film(); const sh = (f.plans.sheets || []).find((s) => String(s.id) === decodeURIComponent(seg[4]));
          if (!sh) return json(res, { error: 'planche introuvable' }, 404);
          const specs = sh.shots.map((id) => resolveShot(f, findShot(f, id))).filter(Boolean);
          const o = TARGETS.sheet.render(specs, sh);
          return json(res, { sheet: sh, refs: specs[0]?.refs || [],
            panels: specs.map((s) => ({ id: s.id, cameraFr: cameraFr(s.camera), action: s.action })),
            targets: [{ id: 'sheet', label: TARGETS.sheet.label, kind: 'image', ...o }] });
        }

        if (what === 'ref') {
          const p = P(pid);
          const target = resolve(p.path, url.searchParams.get('path') || '');
          if (!target.startsWith(p.path + '/') || !existsSync(target)) return json(res, { error: 'refus' }, 403);
          res.writeHead(200, { 'content-type': MIME[extname(target).toLowerCase()] || 'application/octet-stream' });
          return res.end(readFileSync(target));
        }
        return json(res, { error: 'route inconnue' }, 404);
      }

      const file = path === '/' ? 'index.html' : path.replace(/^\//, '');
      const asset = resolve(PUBLIC, file);
      if (asset.startsWith(PUBLIC) && existsSync(asset)) {
        res.writeHead(200, { 'content-type': MIME[extname(asset)] || 'text/plain' });
        return res.end(readFileSync(asset));
      }
      json(res, { error: 'not found' }, 404);
    } catch (e) { json(res, { error: e.message }, 400); }
  });

  server.listen(port, () => console.log(`\n  \x1b[1mrégie\x1b[0m  http://localhost:${port}\n  ctrl-c pour arrêter\n`));
}

function summary(film, shot) {
  try {
    const s = resolveShot(film, shot);
    return { id: s.id, duration: s.duration, location: s.location.id, locationName: s.location.name,
      characters: s.characters.map((c) => ({ id: c.id, name: c.name })), props: s.props.map((p) => p.id),
      camera: s.camera, cameraFr: cameraFr(s.camera), action: s.action, dialogue: s.dialogue, group: s.group,
      cameraCode: [s.camera.size, s.camera.angle, s.camera.lens, s.camera.move].filter(Boolean).join(' '),
      title: shot.title || null, image: shot.image || null, ok: true };
  } catch (e) {
    return { id: String(shot.id), duration: shot.duration, location: shot.location, characters: [], props: [],
      camera: shot.camera || {}, cameraFr: '', action: shot.action, error: e.message, ok: false };
  }
}
