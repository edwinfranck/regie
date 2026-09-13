const $ = (s) => document.querySelector(s);
const el = (t, c, txt) => { const n = document.createElement(t); if (c) n.className = c; if (txt != null) n.textContent = txt; return n; };
const api = (u, o) => fetch(u, o).then((r) => r.json());
const post = (u, data) => api(u, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });
const refUrl = (p) => `/ref?path=${encodeURIComponent(p)}`;

let FILM = null, STEP = 'board', SEL = null, TAB = 'still';

const toast = (m) => { const t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('on'), 1700); };
const issuesFor = (id) => (FILM?.issues || []).filter((i) => i.where === `plan ${id}`);
const worst = (list) => list.some((i) => i.level === 'error') ? '❌' : list.some((i) => i.level === 'block') ? '⛔' : list.length ? '⚠️' : '';
const titleOf = (s) => (s.title || (s.action || '').split(/(?<=\.)\s/)[0] || '').slice(0, 64);

/* ── barre du haut ─────────────────────────────────────────────── */
function health() {
  const n = (l) => FILM.issues.filter((i) => i.level === l).length;
  const box = $('#health'); box.innerHTML = '';
  const add = (c, t) => box.append(el('span', c, t));
  if (n('error')) add('e', `${n('error')} erreur${n('error') > 1 ? 's' : ''}`);
  if (n('block')) add('b', `${n('block')} bloquant`);
  if (n('warn')) add('w', `${n('warn')} à vérifier`);
  if (!FILM.issues.length) add('k', 'conforme');
  add('', `${FILM.shots.length} plans · ${FILM.total}s`);
}

function styleSelect() {
  const s = $('#style'); s.innerHTML = '';
  for (const v of FILM.look.variants) s.append(new Option(`${v.id} · ${v.name}`, v.id, false, v.id === FILM.look.active));
  s.onchange = async () => {
    const to = s.value;
    // La bible le dit : changer de style n'est pas une correction.
    if (!confirm(`Passer le projet en ${to} ?\n\nCe n'est pas une correction : c'est une nouvelle version du projet. Toutes les références déjà générées (feuilles, plaques, planches) seraient à refaire dans le nouveau style.`)) {
      s.value = FILM.look.active; return;
    }
    const r = await post('/api/style', { variant: to });
    if (r.error) { s.value = FILM.look.active; return toast(`✕ ${r.error}`); }
    FILM.look.active = to; toast(`style ${to} — prompts recompilés`); render();
  };
}

/* ── étape 1 : le script ───────────────────────────────────────── */
async function viewScript() {
  const d = await api('/api/script');
  const v = $('#view'); v.innerHTML = '';
  const page = el('div', 'script');
  if (!d.text) { page.append(el('div', 'par', 'Aucun Script.md dans le dossier du film.')); v.append(page); return; }
  for (const raw of d.text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const plain = line.replace(/^[*_>\s]+|[*_\s]+$/g, '');
    if (/^\*[^*]+\*$/.test(line) && /SCÈNE|SCENE|INT\.|EXT\./i.test(line)) page.append(el('div', 'sc', plain));
    else if (/^\*PÉNITENCIER/i.test(line)) page.append(el('h1', null, plain));
    else if (/^_\[.*\]_$/.test(line)) page.append(el('div', 'stage', plain));
    else if (/^>/.test(line)) {
      const t = line.replace(/^>\s*/, '');
      if (/^_\(.*\)_$/.test(t)) page.append(el('div', 'stage', t.replace(/[_()]/g, '')));
      else { const m = t.match(/^\*([A-ZÉÈ\s&.]+)\s*:\*\s*(.*)$/); if (m) { page.append(el('div', 'dn', m[1].trim())); page.append(el('div', 'dl', m[2].replace(/^"|"$/g, ''))); }
             else page.append(el('div', 'dl', t.replace(/^"|"$/g, ''))); }
    }
    else if (/^\*\d/.test(line)) page.append(el('div', 'dn', plain));
    else page.append(el('div', 'par', plain));
  }
  v.append(page);
}

/* ── étape 2 : les actifs ──────────────────────────────────────── */
async function viewAssets() {
  const d = await api('/api/assets');
  const v = $('#view'); v.innerHTML = '';
  for (const g of d.groups) {
    const sec = el('section', 'scene');
    const head = el('div', 'scene-head');
    head.append(el('h2', null, g.title), el('span', 'count', `${g.items.filter((i) => i.exists).length}/${g.items.length} référencés`));
    sec.append(head);
    const grid = el('div', 'grid');
    for (const it of g.items) {
      const card = el('div', 'card'); card.dataset.k = `asset:${it.id}`;
      const th = el('div', 'thumb' + (it.exists ? '' : ' missing'));
      if (it.exists) { const im = new Image(); im.src = refUrl(it.ref); im.loading = 'lazy'; th.append(im); }
      else th.append(el('div', 'none', it.kind === 'prop' ? 'sur la planche d’objets' : 'référence à générer'));
      const cap = el('div', 'cap');
      cap.append(el('div', 't', `${it.id} · ${it.name}`), el('div', 'sub', it.sub || ''));
      card.append(th, cap);
      card.onclick = () => openAsset(it);
      grid.append(card);
    }
    sec.append(grid); v.append(sec);
  }
  if (SEL?.startsWith('asset:')) mark(SEL);
}

function openAsset(it) {
  SEL = `asset:${it.id}`; mark(SEL);
  const d = drawer();
  head(d, `${it.id} · ${it.name}`, [it.sub, it.frozen ? '· gelé' : ''].filter(Boolean).join(' '));
  if (it.exists) { const im = new Image(); im.src = refUrl(it.ref); im.className = 'hero'; d.append(im); d.append(el('div', 'fix', it.ref)); }
  for (const [label, value] of it.fields) {
    if (!value) continue;
    const s = el('div', 'sec'); s.append(el('h3', null, label), el('div', 'body', String(value).trim())); d.append(s);
  }
  if (it.never.length) {
    const s = el('div', 'sec'); s.append(el('h3', null, `Jamais (${it.never.length})`));
    const c = el('div', 'chips'); it.never.forEach((n) => c.append(el('span', null, n))); s.append(c); d.append(s);
  }
  const s = el('div', 'sec'); s.append(el('h3', null, 'Prompt de la référence'));
  s.append(promptBox({ id: 'ref', label: 'Référence', kind: 'image', text: it.prompt.text, negative: it.prompt.negative,
    notes: ['Cette image est chargée par tous les plans où l’élément apparaît : elle se génère en premier, et une seule fois.'] }));
  d.append(s);
}

/* ── étape 3 : le storyboard ───────────────────────────────────── */
function viewBoard() {
  const v = $('#view'); v.innerHTML = '';
  const byId = Object.fromEntries(FILM.shots.map((s) => [String(s.id), s]));
  const placed = new Set();
  FILM.scenes.forEach((sc, i) => {
    const sec = el('section', 'scene');
    const head = el('div', 'scene-head');
    head.append(el('span', 'no', `Scène ${String(i + 1).padStart(2, '0')}`), el('h2', null, sc.title || sc.id),
      el('span', 'count', `${sc.shots.length} case${sc.shots.length > 1 ? 's' : ''}`), el('div', 'grow'));
    const b = el('button', 'ghost', 'Prompt de planche'); b.onclick = () => openSheet(sc.id); head.append(b);
    sec.append(head);
    const grid = el('div', 'grid');
    sc.shots.forEach((id) => { placed.add(String(id)); if (byId[id]) grid.append(frameCard(byId[id])); });
    sec.append(grid); v.append(sec);
  });
  const rest = FILM.shots.filter((s) => !placed.has(String(s.id)));
  if (rest.length) {
    const sec = el('section', 'scene');
    sec.append(el('div', 'scene-head').appendChild(el('h2', null, 'Hors planche')).parentNode);
    const grid = el('div', 'grid'); rest.forEach((s) => grid.append(frameCard(s))); sec.append(grid); v.append(sec);
  }
  if (SEL?.startsWith('shot:')) mark(SEL);
}

function frameCard(s) {
  const card = el('div', 'frame'); card.dataset.k = `shot:${s.id}`;
  const th = el('div', 'thumb' + (s.image ? ' real' : ''));
  const plate = s.image || (FILM.plates || {})[s.location?.split(' ')[0]];
  if (plate) { const im = new Image(); im.src = refUrl(plate); im.loading = 'lazy'; th.append(im); }
  else th.append(el('div', 'none', 'pas d’image'));
  if (s.characters?.length) { const w = el('div', 'who'); s.characters.forEach((c) => w.append(el('b', null, c.id))); th.append(w); }
  const bad = worst(issuesFor(s.id)); if (bad) th.append(el('div', 'badge', bad));
  th.append(el('div', 'cam', s.cameraFr || ''));
  const cap = el('div', 'cap');
  cap.append(el('span', 'n', String(s.id).padStart(2, '0')), el('span', 't', titleOf(s)), el('span', 'd', `${s.duration}s`));
  card.append(th, cap);
  card.onclick = () => openShot(s.id);
  return card;
}

async function openShot(id) {
  const s = await api(`/api/shot/${id}`);
  SEL = `shot:${id}`; mark(SEL); history.replaceState(null, '', `#plan-${id}`);
  const d = drawer();
  head(d, `Plan ${id}`, `${s.duration}s · ${s.location} · ${s.characters.map((c) => c.id + ' ' + c.name).join(', ') || 'aucun personnage'}`);
  d.append(el('div', 'body', s.action));
  if (s.dialogue) d.append(el('div', 'dial', `${s.dialogue.speaker} : « ${s.dialogue.line} »`));
  if (s.note) { const x = el('div', 'sec'); x.append(el('h3', null, 'Stratégie de repli'), el('div', 'body', s.note)); d.append(x); }

  const bad = issuesFor(id);
  if (bad.length) {
    const x = el('div', 'sec'); x.append(el('h3', null, 'À régler'));
    const ul = el('ul', 'issues');
    for (const i of bad) {
      const li = el('li');
      li.append(el('span', `lvl ${i.level}`, i.level === 'error' ? 'erreur' : i.level === 'block' ? 'bloquant' : 'attention'));
      const box = el('div'); box.append(el('div', null, i.msg), el('div', 'fix', i.fix)); li.append(box); ul.append(li);
    }
    x.append(ul); d.append(x);
  }

  const cam = el('div', 'sec'); cam.append(el('h3', null, 'Caméra')); cam.append(cameraRow(s)); d.append(cam);
  if (s.refs.length) { const r = el('div', 'sec'); r.append(el('h3', null, `Références à charger (${s.refs.length})`), refsRow(s.refs)); d.append(r); }
  const p = el('div', 'sec'); p.append(el('h3', null, 'Prompts compilés'), tabbed(s.targets)); d.append(p);
}

async function openSheet(id) {
  const s = await api(`/api/sheet/${id}`);
  SEL = `sheet:${id}`; mark(SEL); history.replaceState(null, '', `#planche-${id}`);
  const d = drawer();
  head(d, `Planche ${s.sheet.id}`, `${s.sheet.title || ''} — plans ${s.sheet.shots.join(', ')}`);
  const c = el('div', 'sec'); c.append(el('h3', null, 'Cases'));
  s.panels.forEach((pn, i) => c.append(el('div', 'body', `${i + 1}. (plan ${pn.id}) ${pn.cameraFr} — ${pn.action}`)));
  d.append(c);
  if (s.refs.length) { const r = el('div', 'sec'); r.append(el('h3', null, 'Références à charger'), refsRow(s.refs)); d.append(r); }
  TAB = 'sheet';
  const p = el('div', 'sec'); p.append(el('h3', null, 'Prompt de la planche'), tabbed(s.targets)); d.append(p);
}

/* ── briques communes ──────────────────────────────────────────── */
function drawer() { const d = $('#drawer'); d.innerHTML = ''; d.hidden = false; document.body.classList.add('open'); d.scrollTop = 0; return d; }
function closeDrawer() { $('#drawer').hidden = true; document.body.classList.remove('open'); SEL = null; mark(null); }
function head(d, title, sub) {
  const h = el('div', 'dh'); const t = el('h1', null, title);
  if (sub) t.append(el('small', null, sub));
  const x = el('button', 'x', '✕'); x.onclick = closeDrawer;
  h.append(t, x); d.append(h);
}
const mark = (k) => document.querySelectorAll('[data-k]').forEach((n) => n.classList.toggle('on', n.dataset.k === k));

function cameraRow(shot) {
  const row = el('div', 'cam');
  const { SIZES, ANGLES, MOVES, allowed } = FILM.vocab;
  const sel = (field, table, value, gate) => {
    const lab = el('label', null, field); const s = el('select');
    s.append(new Option('—', ''));
    for (const [k, v] of Object.entries(table)) {
      const o = new Option(`${k} · ${v.fr}`, k, false, k === value);
      if (gate && !gate.includes(k)) { o.disabled = true; o.text += ' (interdit)'; }
      s.append(o);
    }
    s.onchange = () => save(shot.id, field, s.value);
    lab.append(s); return lab;
  };
  row.append(sel('size', SIZES, shot.camera.size), sel('angle', ANGLES, shot.camera.angle), sel('move', MOVES, shot.camera.move, allowed));
  const mk = (name, val, type) => { const l = el('label', 'small', name); const i = el('input'); if (type) i.type = type; i.value = val ?? ''; i.onchange = () => save(shot.id, name === 'durée' ? 'duration' : 'lens', i.value); l.append(i); return l; };
  row.append(mk('lens', shot.camera.lens), mk('durée', shot.duration, 'number'));
  return row;
}

async function save(id, field, value) {
  const r = await post('/api/camera', { id, field, value });
  if (r.error) return toast(`✕ ${r.error}`);
  FILM.issues = r.issues;
  const i = FILM.shots.findIndex((s) => String(s.id) === String(id));
  if (i > -1) FILM.shots[i] = r.shot;
  health(); if (STEP === 'board') viewBoard();
  toast('plans.yaml mis à jour'); openShot(id);
}

function refsRow(refs) {
  const wrap = el('div', 'refs');
  for (const r of refs) {
    const box = el('div', 'ref');
    if (typeof r === 'string') { box.append(el('div', 'miss', r.split('  ')[0])); wrap.append(box); continue; }
    const im = new Image(); im.src = refUrl(r.path); im.loading = 'lazy';
    im.onerror = () => im.replaceWith(el('div', 'miss', 'absente'));
    box.append(im, el('div', 'why', r.why)); wrap.append(box);
  }
  return wrap;
}

function promptBox(t) {
  const box = el('div');
  const bar = el('div', 'bar'); bar.append(el('span', 'kind', t.kind === 'image' ? 'image' : 'vidéo'));
  const pre = el('pre'); pre.append(document.createTextNode(t.text));
  if (t.negative?.length) { pre.append(document.createTextNode('\n\n')); pre.append(el('span', 'neg', `NEVER: ${t.negative.join(', ')}.`)); }
  const btn = el('button', 'copy', 'Copier le prompt');
  btn.onclick = async () => { await navigator.clipboard.writeText(pre.textContent); toast('prompt copié'); btn.textContent = 'Copié ✓'; setTimeout(() => (btn.textContent = 'Copier le prompt'), 1400); };
  bar.append(btn); box.append(bar, pre);
  if (t.notes?.length) { const n = el('div', 'notes'); t.notes.forEach((x) => n.append(el('div', null, x))); box.append(n); }
  return box;
}

function tabbed(targets) {
  const wrap = el('div');
  const tabs = el('div', 'tabs'); const body = el('div');
  const draw = () => {
    const t = targets.find((x) => x.id === TAB) || targets[0]; TAB = t.id;
    [...tabs.children].forEach((b) => b.classList.toggle('on', b.dataset.id === TAB));
    body.innerHTML = ''; body.append(promptBox(t));
  };
  for (const t of targets) { const b = el('button', null, t.label.split(' (')[0]); b.dataset.id = t.id; b.onclick = () => { TAB = t.id; draw(); }; tabs.append(b); }
  wrap.append(tabs, body); draw(); return wrap;
}

/* ── navigation ────────────────────────────────────────────────── */
function render() {
  document.querySelectorAll('.steps button').forEach((b) => b.classList.toggle('on', b.dataset.step === STEP));
  if (STEP === 'script') viewScript();
  else if (STEP === 'assets') viewAssets();
  else viewBoard();
}

(async function boot() {
  FILM = await api('/api/film');
  FILM.plates = FILM.plates || {};
  $('#film-title').textContent = `${FILM.title} · ${FILM.episode.id} ${FILM.episode.title || ''}`;
  document.title = `régie — ${FILM.title}`;
  health(); styleSelect();
  document.querySelectorAll('.steps button').forEach((b) => (b.onclick = () => { STEP = b.dataset.step; closeDrawer(); history.replaceState(null, '', `#${STEP}`); render(); }));
  document.addEventListener('keydown', (e) => e.key === 'Escape' && closeDrawer());
  render();
  const h = decodeURIComponent(location.hash.slice(1));
  if (h === 'script' || h === 'assets' || h === 'board') { STEP = h; render(); }
  else if (h.startsWith('plan-')) openShot(h.slice(5));
  else if (h.startsWith('planche-')) openSheet(h.slice(8));
  else if (h.startsWith('asset-')) { STEP = 'assets'; render(); }
})();
