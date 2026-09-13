import { createServer } from 'node:http';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { loadFilm, resolveShot, allShots, findShot } from './film.mjs';
import { validate } from './validate.mjs';
import { cameraFr, SIZES, ANGLES, MOVES } from './camera.mjs';
import { TARGETS, videoTargets } from './targets/index.mjs';

const PUBLIC = resolve(fileURLToPath(new URL('../public', import.meta.url)));
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
  '.jpeg': 'image/jpeg', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };

const json = (res, data, code = 200) => {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
};

// Le film est relu a chaque requete : tu peux editer les YAML dans ton editeur
// et rafraichir la page, sans redemarrer le serveur.
export function serve(filmDir, port = 4173) {
  const load = () => loadFilm(filmDir);

  const summarise = (film, shot) => {
    try {
      const s = resolveShot(film, shot);
      return { id: s.id, duration: s.duration, location: `${s.location.id} ${s.location.name}`,
        characters: s.characters.map((c) => ({ id: c.id, name: c.name })),
        camera: s.camera, cameraFr: cameraFr(s.camera), action: s.action, group: s.group,
        dialogue: s.dialogue, ok: true };
    } catch (e) { return { id: String(shot.id), error: e.message, ok: false }; }
  };

  const renderTargets = (spec) => [TARGETS.still, ...videoTargets()].map((t) => {
    const o = t.render(spec);
    return { id: t.id, label: t.label, kind: t.kind, text: o.text, negative: o.negative || [], refs: o.refs || [], notes: o.notes || [] };
  });

  const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const p = url.pathname;
    try {
      if (p === '/api/film') {
        const film = load();
        const { issues, total } = validate(film);
        return json(res, {
          title: film.bible.film.title, episode: film.plans.episode, dir: film.dir, total,
          shots: allShots(film).map((s) => summarise(film, s)),
          sheets: film.plans.sheets || [], issues,
          vocab: { SIZES, ANGLES, MOVES, allowed: film.bible.motion?.allowed_moves || Object.keys(MOVES) },
        });
      }

      if (p.startsWith('/api/shot/')) {
        const film = load();
        const shot = findShot(film, decodeURIComponent(p.slice(10)));
        if (!shot) return json(res, { error: 'plan introuvable' }, 404);
        const spec = resolveShot(film, shot);
        return json(res, {
          ...summarise(film, shot), sound: spec.sound, note: spec.note,
          props: spec.props.map((x) => ({ id: x.id, name: x.name })),
          light: spec.light.id, refs: spec.refs, targets: renderTargets(spec),
        });
      }

      if (p.startsWith('/api/sheet/')) {
        const film = load();
        const sheet = (film.plans.sheets || []).find((s) => String(s.id) === decodeURIComponent(p.slice(11)));
        if (!sheet) return json(res, { error: 'planche introuvable' }, 404);
        const specs = sheet.shots.map((id) => resolveShot(film, findShot(film, id)));
        const o = TARGETS.sheet.render(specs, sheet);
        return json(res, { sheet, refs: specs[0].refs,
          targets: [{ id: 'sheet', label: TARGETS.sheet.label, kind: 'image', text: o.text, negative: o.negative, refs: o.refs, notes: o.notes }],
          panels: specs.map((s) => ({ id: s.id, cameraFr: cameraFr(s.camera), action: s.action })) });
      }

      // Ecriture : seule la couche camera et la duree sont modifiables depuis l'UI.
      // La bible, elle, reste gelee — on ne la change pas d'un clic.
      if (p === '/api/camera' && req.method === 'POST') {
        let body = '';
        req.on('data', (c) => (body += c));
        return req.on('end', () => {
          try {
            const { id, field, value } = JSON.parse(body);
            const film = load();
            const file = join(film.base, 'plans.yaml');
            const doc = YAML.parseDocument(readFileSync(file, 'utf8'));
            const idx = doc.get('shots').items.findIndex((i) => String(i.get('id')) === String(id));
            if (idx === -1) return json(res, { error: 'plan introuvable' }, 404);
            const path = field === 'duration' ? ['shots', idx, 'duration'] : ['shots', idx, 'camera', field];
            doc.setIn(path, field === 'duration' ? Number(value) : value);
            // lineWidth 0 + pas de padding : la sauvegarde ne reformate pas le fichier,
            // elle ne change que la valeur touchee. Les commentaires sont preserves.
            writeFileSync(file, doc.toString({ lineWidth: 0, flowCollectionPadding: false }));
            const fresh = load();
            const { issues } = validate(fresh);
            json(res, { ok: true, issues, shot: summarise(fresh, findShot(fresh, id)) });
          } catch (e) { json(res, { error: e.message }, 400); }
        });
      }

      // Images de reference, servies depuis le dossier du film uniquement.
      if (p === '/ref') {
        const film = load();
        const target = resolve(film.dir, url.searchParams.get('path') || '');
        if (!target.startsWith(film.dir + '/') || !existsSync(target)) return json(res, { error: 'refus' }, 403);
        res.writeHead(200, { 'content-type': MIME[extname(target).toLowerCase()] || 'application/octet-stream' });
        return res.end(readFileSync(target));
      }

      const file = p === '/' ? 'index.html' : p.replace(/^\//, '');
      const asset = resolve(PUBLIC, file);
      if (asset.startsWith(PUBLIC) && existsSync(asset)) {
        res.writeHead(200, { 'content-type': MIME[extname(asset)] || 'text/plain' });
        return res.end(readFileSync(asset));
      }
      json(res, { error: 'not found' }, 404);
    } catch (e) { json(res, { error: e.message }, 500); }
  });

  server.listen(port, () => {
    console.log(`\n  \x1b[1mrégie\x1b[0m  http://localhost:${port}`);
    console.log(`  film : ${resolve(filmDir)}\n  ctrl-c pour arrêter\n`);
  });
}
