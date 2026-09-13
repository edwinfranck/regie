/* régie — interface. Aucun contenu en dur : tout vient du projet ouvert. */
const $ = (s) => document.querySelector(s);
const el = (t, c, x) => { const n = document.createElement(t); if (c) n.className = c; if (x != null) n.textContent = x; return n; };
const api = (u, o) => fetch(u, o).then((r) => r.json());
const post = (u, d) => api(u, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(d) });

const S = { projects: [], pid: null, film: null, view: 'plans', sel: null, tab: 'still', dirty: false };
const api_p = (path) => `/api/p/${encodeURIComponent(S.pid)}/${path}`;
const refUrl = (p) => api_p(`ref?path=${encodeURIComponent(p)}`);

const toast = (m) => { const t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('on'), 1700); };
const issuesFor = (id) => (S.film?.issues || []).filter((i) => i.where === `plan ${id}`);

/* ── dialogues maison ─────────────────────────────────────────────── */
function dialog({ title, build, okLabel = 'Valider', danger, onOk }) {
  const host = $('#modal'); host.innerHTML = ''; host.hidden = false;
  const d = el('div', 'dlg'); d.append(el('h3', null, title));
  const inner = el('div', 'in'); build(inner); d.append(inner);
  const ft = el('div', 'ft');
  const ok = el('button', `act pri${danger ? ' danger' : ''}`, okLabel);
  const no = el('button', 'act', 'Annuler');
  const close = () => { host.hidden = true; host.innerHTML = ''; };
  no.onclick = close;
  ok.onclick = async () => { const r = await onOk(inner); if (r !== false) close(); };
  ft.append(ok, no); d.append(ft); host.append(d);
  host.onclick = (e) => e.target === host && close();
  document.onkeydown = (e) => { if (e.key === 'Escape' && !host.hidden) close(); };
  const first = inner.querySelector('input,textarea,select'); if (first) first.focus();
}
const confirmDlg = (title, text, okLabel, onOk) =>
  dialog({ title, danger: true, okLabel, build: (i) => i.append(el('p', null, text)), onOk });

const field = (label, value, opts = {}) => {
  const l = el('label', 'f' + (opts.cls ? ' ' + opts.cls : '')); l.append(el('span', null, label));
  const n = opts.tag === 'textarea' ? el('textarea') : opts.tag === 'select' ? el('select') : el('input');
  if (opts.tag === 'select') for (const [v, t] of opts.options) n.append(new Option(t, v, false, String(v) === String(value)));
  else n.value = value ?? '';
  if (opts.type) n.type = opts.type;
  if (opts.rows) n.rows = opts.rows;
  if (opts.ph) n.placeholder = opts.ph;
  if (opts.on) n.onchange = () => opts.on(n.value);
  l.append(n); l.input = n; return l;
};

/* ── listes d'interdits (never) ───────────────────────────────────── */
function neverEditor(list, save) {
  const box = el('div');
  const chips = el('div', 'chips');
  const draw = () => {
    chips.innerHTML = '';
    list.forEach((v, i) => {
      const c = el('span', 'chip', v);
      const x = el('button', null, '×'); x.title = 'retirer';
      x.onclick = () => { list.splice(i, 1); draw(); save(list); };
      c.append(x); chips.append(c);
    });
    if (!list.length) chips.append(el('span', 'muted', 'aucun interdit'));
  };
  draw();
  const add = el('div', 'addrow');
  const inp = el('input'); inp.placeholder = 'ajouter un interdit puis Entrée';
  inp.onkeydown = (e) => { if (e.key === 'Enter' && inp.value.trim()) { list.push(inp.value.trim()); inp.value = ''; draw(); save(list); } };
  add.append(inp);
  box.append(chips, add); return box;
}

/* ── squelette ────────────────────────────────────────────────────── */
function shell(title, sub, actions, listNode, sideNode) {
  const main = $('#main'); main.innerHTML = '';
  const list = el('div', 'list');
  const bar = el('div', 'bar');
  bar.append(el('h1', null, title));
  if (sub) bar.append(el('span', 'sub', sub));
  bar.append(el('span', 'grow'));
  (actions || []).forEach((a) => bar.append(a));
  list.append(bar);
  const scroll = el('div', 'scroll'); scroll.append(listNode); list.append(scroll);
  main.append(list);
  const side = el('aside', 'side'); side.append(sideNode || sideHelp()); main.append(side);
  return { scroll, side };
}
const sideHelp = () => {
  const p = el('div', 'pane');
  p.append(el('h2', null, 'Contrôle'));
  const ul = el('div');
  const iss = S.film?.issues || [];
  if (!iss.length) ul.append(el('div', 'muted', 'Rien à signaler sur ce projet.'));
  for (const i of iss) {
    const r = el('div', 'f');
    r.append(el('span', null, `${i.level === 'error' ? 'erreur' : i.level === 'block' ? 'bloquant' : 'attention'} · ${i.where}`));
    r.append(el('div', null, i.msg));
    r.append(el('div', 'muted', i.fix));
    ul.append(r);
  }
  p.append(ul);
  return p;
};
const table = (cols, rows) => {
  const t = el('table'), th = el('tr');
  cols.forEach((c) => th.append(el('th', c.cls, c.t)));
  t.append(el('thead').appendChild(th).parentNode);
  const tb = el('tbody');
  rows.forEach((r) => tb.append(r));
  t.append(tb); return t;
};
const tr = (cells, { on, sel }) => {
  const r = el('tr'); if (sel) r.className = 'on';
  cells.forEach((c) => { const td = el('td', c.cls); if (c.node) td.append(c.node); else td.textContent = c.t ?? ''; r.append(td); });
  r.onclick = on; return r;
};

/* ── projets ──────────────────────────────────────────────────────── */
async function viewProjects() {
  S.projects = (await api('/api/projects')).projects;
  const rows = S.projects.map((p) => tr([
    { t: p.title, cls: '' }, { t: p.path, cls: 'mono muted' },
    { t: `${p.counts.characters} pers · ${p.counts.locations} lieux · ${p.counts.props} objets`, cls: 'mono' },
    { t: `${p.counts.shots} plans`, cls: 'mono' },
  ], { on: () => open(p.id), sel: p.id === S.pid }));
  const node = rows.length ? table([{ t: 'Projet' }, { t: 'Dossier' }, { t: 'Bible' }, { t: 'Découpage' }], rows)
    : Object.assign(el('div', 'empty'), { innerHTML: 'Aucun projet. Crée-en un à droite, ou importe un dossier qui contient déjà un <b>regie/bible.yaml</b>.' });

  const side = el('div');
  const p1 = el('div', 'pane'); p1.append(el('h2', null, 'Nouveau projet'));
  const ftitle = field('Titre', '', { ph: 'Le nom de la série' });
  const fpath = field('Dossier', '', { ph: '/home/toi/films/ma-serie' });
  const frow = el('div', 'row');
  const fratio = field('Format', '9:16', { tag: 'select', options: [['9:16', '9:16 vertical'], ['16:9', '16:9 paysage'], ['1:1', '1:1 carré'], ['4:5', '4:5 portrait']] });
  const fres = field('Résolution', '1080x1920');
  frow.append(fratio, fres);
  const go = el('button', 'act pri', 'Créer le projet');
  go.onclick = async () => {
    const r = await post('/api/projects', { op: 'create', title: ftitle.input.value.trim(), path: fpath.input.value.trim(), ratio: fratio.input.value, resolution: fres.input.value });
    if (r.error) return toast(r.error);
    toast('projet créé'); open(r.id);
  };
  p1.append(ftitle, fpath, frow, go);

  const p2 = el('div', 'pane'); p2.append(el('h2', null, 'Importer un projet existant'));
  const ipath = field('Dossier', '', { ph: '/home/toi/films/existant' });
  const igo = el('button', 'act', 'Importer');
  igo.onclick = async () => {
    const r = await post('/api/projects', { op: 'import', path: ipath.input.value.trim() });
    if (r.error) return toast(r.error);
    toast('projet importé'); open(r.id);
  };
  p2.append(ipath, el('div', 'muted', 'Le dossier doit contenir regie/bible.yaml et regie/plans.yaml.'), igo);
  side.append(p1, p2);

  shell('Projets', `${S.projects.length} enregistré${S.projects.length > 1 ? 's' : ''}`, [], node, side);
}

/* ── script ───────────────────────────────────────────────────────── */
async function viewScript() {
  const d = await api(api_p('script'));
  const wrap = el('div', 'editor');
  const ta = el('textarea'); ta.value = d.text; ta.placeholder = 'Écris le script ici. Personnages, dialogues, didascalies — la forme est libre.';
  wrap.append(ta);
  const save = el('button', 'act pri', 'Enregistrer');
  save.onclick = async () => { await post(api_p('script'), { text: ta.value }); toast('Script.md enregistré'); };
  ta.oninput = () => { save.textContent = 'Enregistrer •'; };

  const side = el('div');
  const p = el('div', 'pane'); p.append(el('h2', null, 'Découpage'));
  if (!S.film.shots.length) p.append(el('div', 'muted', 'Aucun plan. Le script s’écrit ici ; le découpage se fabrique dans Plans.'));
  S.film.shots.forEach((s) => {
    const r = el('div', 'f');
    r.append(el('span', null, `plan ${s.id} · ${s.duration}s`));
    r.append(el('div', 'trunc', s.action || ''));
    p.append(r);
  });
  side.append(p);
  const { scroll } = shell('Script', d.file, [save], wrap, side);
  scroll.style.display = 'flex'; scroll.style.padding = '0';
}

/* ── entités de la bible ──────────────────────────────────────────── */
const KIND = {
  characters: { label: 'Personnages', one: 'personnage', prefix: 'CH' },
  locations: { label: 'Lieux', one: 'lieu', prefix: 'L' },
  props: { label: 'Objets', one: 'objet', prefix: 'P' },
};

async function viewEntities(kind) {
  const d = await api(api_p('assets'));
  const items = d[kind];
  const meta = KIND[kind];
  const rows = items.map((it) => tr([
    { cls: 'thumb', node: it.exists ? thumb(it.ref) : el('span', 'no') },
    { t: it.id, cls: 'mono' },
    { t: it.name || '—' },
    { t: it.sub || '', cls: 'muted' },
    { t: it.never.length ? `${it.never.length} interdits` : '—', cls: 'mono muted' },
  ], { on: () => { S.sel = it.id; renderView(); }, sel: S.sel === it.id }));

  const add = el('button', 'act pri', `Nouveau ${meta.one}`);
  add.onclick = () => newEntity(kind, items);

  const node = rows.length ? table([{ t: '' }, { t: 'ID' }, { t: 'Nom' }, { t: 'Rôle' }, { t: 'Interdits' }], rows)
    : Object.assign(el('div', 'empty'), { innerHTML: `Aucun ${meta.one}. Le bouton <b>Nouveau ${meta.one}</b> en crée un ; tout ce que tu écris ici part dans chaque prompt qui l'utilise.` });

  const sel = items.find((i) => i.id === S.sel);
  shell(meta.label, `${items.length} · ${items.filter((i) => i.exists).length} avec référence`, [add], node,
    sel ? entityPane(kind, sel) : plateSide(d));
}

const thumb = (ref) => { const i = new Image(); i.src = refUrl(ref); i.loading = 'lazy'; return i; };

function newEntity(kind, items) {
  const meta = KIND[kind];
  const n = items.length + 1;
  dialog({
    title: `Nouveau ${meta.one}`, okLabel: 'Créer',
    build: (b) => {
      b.id_f = field('Identifiant', `${meta.prefix}${n}`, { ph: 'CH1' }); b.append(b.id_f);
      b.name_f = field('Nom', ''); b.append(b.name_f);
      b.append(el('div', 'muted', 'L’identifiant est ce que le découpage utilisera. Il ne devrait plus changer ensuite.'));
    },
    onOk: async (b) => {
      const id = b.id_f.input.value.trim(); if (!id) return false;
      const patch = { name: b.name_f.input.value.trim(), block: '', short: '', never: [] };
      if (kind === 'characters') Object.assign(patch, { role: '', height_m: null, costume: '', silhouette: '', ref: null, frozen: false });
      if (kind === 'locations') Object.assign(patch, { ref: null, sound: '' });
      const r = await post(api_p('entity'), { kind, id, op: 'create', patch });
      if (r.error) { toast(r.error); return false; }
      S.sel = id; await reload(); toast(`${id} créé`);
    },
  });
}

function entityPane(kind, it) {
  const side = el('div');
  const save = (patch) => post(api_p('entity'), { kind, id: it.id, patch }).then(() => { toast('bible enregistrée'); reloadSoft(); });

  const head = el('div', 'pane');
  const hrow = el('div', 'bar'); hrow.style.padding = '0 0 10px'; hrow.style.border = '0'; hrow.style.minHeight = '0';
  hrow.append(el('h1', null, `${it.id} · ${it.name || 'sans nom'}`), el('span', 'grow'));
  const del = el('button', 'act danger', 'Supprimer');
  del.onclick = () => confirmDlg(`Supprimer ${it.id} ?`,
    `${it.name || it.id} sera retiré de la bible. Les plans qui l'utilisent deviendront invalides — le contrôle te les signalera.`,
    'Supprimer', async () => { await post(api_p('entity'), { kind, id: it.id, op: 'delete' }); S.sel = null; await reload(); toast(`${it.id} supprimé`); });
  hrow.append(del);
  head.append(hrow);

  head.append(field('Nom', it.name, { on: (v) => save({ name: v }) }));
  if (kind === 'characters') {
    const r = el('div', 'row');
    r.append(field('Rôle', it.sub, { on: (v) => save({ role: v }) }));
    r.append(field('Taille (m)', it.height_m, { cls: 's', type: 'number', on: (v) => save({ height_m: v === '' ? null : Number(v) }) }));
    head.append(r);
    head.append(field('Costume', it.costume, { tag: 'textarea', rows: 3, on: (v) => save({ costume: v }) }));
    head.append(field('Marqueur de silhouette', it.silhouette, { tag: 'textarea', rows: 2, on: (v) => save({ silhouette: v }) }));
  }
  if (kind === 'locations') head.append(field('Ambiance sonore', it.sound, { on: (v) => save({ sound: v }) }));
  head.append(field('Description gelée — collée telle quelle dans les prompts image', it.block, { tag: 'textarea', rows: 8, on: (v) => save({ block: v }) }));
  head.append(field('Forme courte — une ligne, pour les prompts vidéo', it.short, { tag: 'textarea', rows: 3, on: (v) => save({ short: v }) }));
  side.append(head);

  const nev = el('div', 'pane'); nev.append(el('h2', null, `Jamais (${it.never.length})`));
  nev.append(neverEditor([...it.never], (l) => save({ never: l })));
  side.append(nev);

  if (kind !== 'props') side.append(refPane(it));
  side.append(promptPane('Prompt de la référence', [{ id: 'ref', label: 'Référence', kind: 'image', ...it.prompt,
    notes: ['Cette image se génère une fois, puis se charge dans tous les plans où l’élément apparaît.'] }]));
  return side;
}

function refPane(it) {
  const p = el('div', 'pane'); p.append(el('h2', null, 'Image de référence'));
  if (it.exists) { const i = thumb(it.ref); i.className = 'hero'; p.append(i, el('div', 'muted mono', it.ref)); }
  else p.append(el('div', 'muted', 'Aucune référence. Tant qu’elle manque, le contrôle bloque les plans qui utilisent cet élément.'));
  const up = el('input'); up.type = 'file'; up.accept = 'image/*'; up.style.marginTop = '9px';
  up.onchange = async () => {
    const f = up.files[0]; if (!f) return;
    const data = await new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(f); });
    const r = await post(api_p('upload'), { name: f.name, data, assign: it.field ? { kind: 'plate', field: it.field } : { kind: it.kind, id: it.id } });
    if (r.error) return toast(r.error);
    toast('référence importée'); reload();
  };
  p.append(up);
  return p;
}

const plateSide = (d) => {
  const side = el('div');
  const p = el('div', 'pane'); p.append(el('h2', null, 'Planches communes'));
  d.plates.forEach((pl) => {
    const row = el('div', 'f');
    row.append(el('span', null, `${pl.id} · ${pl.name}`));
    row.append(el('div', 'muted', pl.exists ? pl.ref : 'à générer'));
    const b = el('button', 'act', 'Ouvrir'); b.onclick = () => { S.sel = null; openPlate(pl); };
    row.append(b); p.append(row);
  });
  side.append(p, sideHelp());
  return side;
};
function openPlate(pl) {
  const main = $('#main'); const side = main.querySelector('.side');
  side.innerHTML = '';
  const h = el('div', 'pane'); h.append(el('h2', null, pl.name));
  side.append(h, refPane(pl), promptPane('Prompt de la planche', [{ id: 'plate', label: 'Planche', kind: 'image', ...pl.prompt, notes: [] }]));
}

/* ── plans ────────────────────────────────────────────────────────── */
function viewShots() {
  const rows = S.film.shots.map((s) => {
    const bad = issuesFor(s.id);
    return tr([
      { t: String(s.id), cls: 'num' },
      { t: `${s.duration}s`, cls: 'num' },
      { t: s.location || '—', cls: 'mono' },
      { node: (() => { const d = el('div'); (s.characters || []).forEach((c) => d.append(el('span', 'tag', c.id))); if (!s.characters?.length) d.append(el('span', 'muted', '—')); return d; })() },
      { t: s.cameraCode || '—', cls: 'mono muted nowrap' },
      { node: el('span', 'trunc', s.action || '') },
      { node: bad.length ? el('span', `flag ${bad[0].level}`, bad.length) : el('span', 'muted', '') },
    ], { on: () => { S.sel = String(s.id); renderView(); }, sel: S.sel === String(s.id) });
  });
  const add = el('button', 'act pri', 'Nouveau plan');
  add.onclick = async () => {
    const r = await post(api_p('shot'), { op: 'create', patch: {} });
    if (r.error) return toast(r.error);
    await reload(); S.sel = String(S.film.shots[S.film.shots.length - 1].id); renderView(); toast('plan créé');
  };
  const node = rows.length ? table([{ t: '#' }, { t: 'Durée' }, { t: 'Lieu' }, { t: 'Casting' }, { t: 'Caméra' }, { t: 'Action' }, { t: '' }], rows)
    : Object.assign(el('div', 'empty'), { innerHTML: 'Aucun plan. <b>Nouveau plan</b> en ajoute un ; chaque plan pioche ses personnages, son lieu et ses objets dans la bible.' });
  shell('Plans', `${S.film.shots.length} · ${S.film.total}s`, [add], node, S.sel ? null : sideHelp());
  if (S.sel) shotPane(S.sel);
}

async function shotPane(id) {
  const s = await api(api_p(`shots/${id}`));
  const side = $('#main').querySelector('.side'); side.innerHTML = '';
  if (s.error) { side.append(el('div', 'pane', s.error)); return; }
  const save = async (patch) => {
    const r = await post(api_p('shot'), { id, patch });
    if (r.error) return toast(r.error);
    S.film.issues = r.issues; S.film.shots = r.shots; health(); viewShots(); toast('plan enregistré');
  };

  const head = el('div', 'pane');
  const hrow = el('div', 'bar'); hrow.style.cssText = 'padding:0 0 10px;border:0;min-height:0';
  hrow.append(el('h1', null, `Plan ${id}`), el('span', 'grow'));
  const del = el('button', 'act danger', 'Supprimer');
  del.onclick = () => confirmDlg(`Supprimer le plan ${id} ?`, 'Le plan disparaît du découpage. Les planches qui le référencent seront à corriger.',
    'Supprimer', async () => { await post(api_p('shot'), { id, op: 'delete' }); S.sel = null; await reload(); toast('plan supprimé'); });
  hrow.append(del); head.append(hrow);

  const r1 = el('div', 'row');
  r1.append(field('Durée (s)', s.duration, { cls: 's', type: 'number', on: (v) => save({ duration: Number(v) }) }));
  r1.append(field('Lieu', s.location || '', { tag: 'select', options: [['', '—'], ...Object.keys(S.film.plates).concat(S.locIds || []).filter((v, i, a) => a.indexOf(v) === i).map((k) => [k, k])], on: (v) => save({ location: v || null }) }));
  head.append(r1);
  head.append(field('Action', s.action || '', { tag: 'textarea', rows: 3, on: (v) => save({ action: v }) }));
  head.append(pickList('Casting', S.charIds, (s.characters || []).map((c) => c.id), (l) => save({ characters: l })));
  head.append(pickList('Objets', S.propIds, s.props?.map((p) => p.id) || [], (l) => save({ props: l })));
  side.append(head);

  const cam = el('div', 'pane'); cam.append(el('h2', null, 'Caméra'));
  const { SIZES, ANGLES, MOVES, allowed } = S.film.vocab;
  const opt = (table_, gate) => [['', '—'], ...Object.entries(table_).map(([k, v]) => [k, `${k} · ${v.fr}${gate && !gate.includes(k) ? ' (interdit)' : ''}`])];
  const cr = el('div', 'row');
  cr.append(field('Taille', s.camera.size || '', { tag: 'select', options: opt(SIZES), on: (v) => save({ camera: { size: v || null } }) }));
  cr.append(field('Angle', s.camera.angle || '', { tag: 'select', options: opt(ANGLES), on: (v) => save({ camera: { angle: v || null } }) }));
  cam.append(cr);
  const cr2 = el('div', 'row');
  const mv = field('Mouvement', s.camera.move || '', { tag: 'select', options: opt(MOVES, allowed), on: (v) => save({ camera: { move: v || null } }) });
  [...mv.input.options].forEach((o) => { if (o.value && !allowed.includes(o.value)) o.disabled = true; });
  cr2.append(mv, field('Optique', s.camera.lens || '', { cls: 's', on: (v) => save({ camera: { lens: v || null } }) }));
  cam.append(cr2);
  side.append(cam);

  const bad = issuesFor(id);
  if (bad.length) {
    const p = el('div', 'pane'); p.append(el('h2', null, 'Contrôle'));
    bad.forEach((i) => { const f = el('div', 'f'); f.append(el('span', null, i.level), el('div', null, i.msg), el('div', 'muted', i.fix)); p.append(f); });
    side.append(p);
  }
  if (s.refs?.length) {
    const p = el('div', 'pane'); p.append(el('h2', null, `Références à charger (${s.refs.length})`));
    const g = el('div', 'chips');
    s.refs.forEach((r) => { const c = el('span', 'chip'); const i = thumb(r.path); i.style.cssText = 'width:52px;height:52px;object-fit:cover'; c.append(i, el('span', null, r.why)); g.append(c); });
    p.append(g); side.append(p);
  }
  side.append(promptPane('Prompts compilés', s.targets));
}

function pickList(label, all, chosen, save) {
  const l = el('label', 'f'); l.append(el('span', null, label));
  const box = el('div', 'chips');
  const draw = () => {
    box.innerHTML = '';
    (all || []).forEach((id) => {
      const on = chosen.includes(id);
      const b = el('button', 'chip', id);
      b.style.cssText = on ? 'background:var(--sel);color:var(--selink);border-color:var(--sel)' : 'cursor:pointer';
      b.onclick = () => { const i = chosen.indexOf(id); i > -1 ? chosen.splice(i, 1) : chosen.push(id); draw(); save(chosen); };
      box.append(b);
    });
    if (!all?.length) box.append(el('span', 'muted', 'rien dans la bible'));
  };
  draw(); l.append(box); return l;
}

/* ── planches ─────────────────────────────────────────────────────── */
function viewSheets() {
  const rows = (S.film.sheets || []).map((sh) => tr([
    { t: sh.id, cls: 'mono' }, { t: sh.title || '—' },
    { t: (sh.shots || []).join(', '), cls: 'mono muted' },
    { t: `${(sh.shots || []).length} cases`, cls: 'mono' },
  ], { on: () => { S.sel = sh.id; renderView(); }, sel: S.sel === sh.id }));
  const add = el('button', 'act pri', 'Nouvelle planche');
  add.onclick = () => dialog({
    title: 'Nouvelle planche', okLabel: 'Créer',
    build: (b) => { b.f1 = field('Identifiant', `SB${(S.film.sheets || []).length + 1}`); b.f2 = field('Titre', ''); b.append(b.f1, b.f2); },
    onOk: async (b) => {
      const r = await post(api_p('sheet'), { op: 'create', patch: { id: b.f1.input.value.trim(), title: b.f2.input.value.trim(), shots: [] } });
      if (r.error) { toast(r.error); return false; }
      S.sel = b.f1.input.value.trim(); await reload(); toast('planche créée');
    },
  });
  const node = rows.length ? table([{ t: 'ID' }, { t: 'Titre' }, { t: 'Plans' }, { t: '' }], rows)
    : Object.assign(el('div', 'empty'), { innerHTML: 'Aucune planche. Une planche regroupe plusieurs plans en <b>une seule image multi-cases</b> : le modèle dessine les cases dans la même passe, donc le personnage reste le même de case en case.' });
  shell('Planches', `${(S.film.sheets || []).length}`, [add], node, null);
  if (S.sel) sheetPane(S.sel);
}

async function sheetPane(id) {
  const d = await api(api_p(`sheets/${id}`));
  const side = $('#main').querySelector('.side'); side.innerHTML = '';
  if (d.error) { side.append(el('div', 'pane', d.error)); return; }
  const save = (patch) => post(api_p('sheet'), { id, patch }).then(() => { toast('planche enregistrée'); reloadSoft(); });
  const head = el('div', 'pane');
  const hrow = el('div', 'bar'); hrow.style.cssText = 'padding:0 0 10px;border:0;min-height:0';
  hrow.append(el('h1', null, `Planche ${id}`), el('span', 'grow'));
  const del = el('button', 'act danger', 'Supprimer');
  del.onclick = () => confirmDlg(`Supprimer la planche ${id} ?`, 'Les plans qu’elle regroupe ne sont pas touchés.', 'Supprimer',
    async () => { await post(api_p('sheet'), { id, op: 'delete' }); S.sel = null; await reload(); toast('planche supprimée'); });
  hrow.append(del); head.append(hrow);
  head.append(field('Titre', d.sheet.title || '', { on: (v) => save({ title: v }) }));
  head.append(pickList('Plans de la planche', S.film.shots.map((s) => String(s.id)), (d.sheet.shots || []).map(String), (l) => save({ shots: l.map(Number) })));
  side.append(head);
  if (d.panels?.length) {
    const p = el('div', 'pane'); p.append(el('h2', null, 'Cases'));
    d.panels.forEach((pn, i) => { const f = el('div', 'f'); f.append(el('span', null, `case ${i + 1} · plan ${pn.id}`), el('div', 'muted mono', pn.cameraFr), el('div', null, pn.action)); p.append(f); });
    side.append(p);
  }
  if (d.targets?.[0]?.text) side.append(promptPane('Prompt de la planche', d.targets));
}

/* ── réglages ─────────────────────────────────────────────────────── */
function viewSettings() {
  const f = S.film;
  const saveMeta = (target, patch, id) => post(api_p('meta'), { target, patch, id }).then(() => { toast('enregistré'); reloadSoft(); });
  const body = el('div');

  const p0 = el('div', 'pane'); p0.append(el('h2', null, 'Projet'));
  p0.append(field('Titre', f.title, { on: (v) => saveMeta('film', { title: v }) }));
  const rr = el('div', 'row');
  rr.append(field('Format', f.format?.ratio || '', { on: (v) => saveMeta('film', { format: { ...f.format, ratio: v } }) }));
  rr.append(field('Résolution', f.format?.resolution || '', { on: (v) => saveMeta('film', { format: { ...f.format, resolution: v } }) }));
  p0.append(rr);
  const re = el('div', 'row');
  re.append(field('Épisode', f.episode?.id || '', { on: (v) => saveMeta('episode', { id: v }) }));
  re.append(field('Titre de l’épisode', f.episode?.title || '', { on: (v) => saveMeta('episode', { title: v }) }));
  p0.append(re);
  body.append(p0);

  const p1 = el('div', 'pane'); p1.append(el('h2', null, 'Styles'));
  f.look.variants.forEach((v) => {
    const w = el('div', 'f');
    const head = el('div', 'phead');
    head.append(el('span', 'k', `${v.id} · ${v.name || ''}${v.id === f.look.active ? ' — actif' : ''}`));
    if (v.id !== f.look.active) {
      const b = el('button', 'act', 'Activer');
      b.onclick = () => confirmDlg(`Passer en ${v.id} ?`,
        'Changer de style n’est pas une correction : c’est une nouvelle version du projet. Les références déjà générées seraient à refaire dans ce style.',
        'Changer de style', async () => { await saveMeta('look', { active: v.id }); });
      head.append(b);
    }
    w.append(head);
    w.append(field('Nom', v.name || '', { on: (x) => saveMeta('variant', { name: x }, v.id) }));
    w.append(field('Forme courte', v.short || '', { tag: 'textarea', rows: 3, on: (x) => saveMeta('variant', { short: x }, v.id) }));
    w.append(field('Bloc complet', v.block || '', { tag: 'textarea', rows: 7, on: (x) => saveMeta('variant', { block: x }, v.id) }));
    p1.append(w);
  });
  const addStyle = el('button', 'act', 'Ajouter un style');
  addStyle.onclick = () => dialog({ title: 'Nouveau style', okLabel: 'Créer',
    build: (b) => { b.f1 = field('Identifiant', `S${f.look.variants.length + 1}`); b.f2 = field('Nom', ''); b.append(b.f1, b.f2); },
    onOk: async (b) => { await saveMeta('variant', { name: b.f2.input.value, short: '', block: '', frozen: false, ref: null }, b.f1.input.value.trim()); } });
  p1.append(addStyle);
  const nev = el('div', 'f'); nev.append(el('span', null, 'Interdits de style — appliqués à tous les prompts'));
  nev.append(neverEditor([...(f.look.never || [])], (l) => saveMeta('look', { never: l })));
  p1.append(nev);
  body.append(p1);

  const p2 = el('div', 'pane'); p2.append(el('h2', null, 'Contraintes de production'));
  const m = f.motion || {};
  const mr = el('div', 'row');
  mr.append(field('Clip min (s)', (m.clip_seconds || [])[0] ?? '', { cls: 's', type: 'number', on: (v) => saveMeta('motion', { clip_seconds: [Number(v), (m.clip_seconds || [])[1] ?? null] }) }));
  mr.append(field('Clip max (s)', (m.clip_seconds || [])[1] ?? '', { cls: 's', type: 'number', on: (v) => saveMeta('motion', { clip_seconds: [(m.clip_seconds || [])[0] ?? null, Number(v)] }) }));
  mr.append(field('Personnages max par plan', f.rules?.max_characters_per_shot ?? '', { type: 'number', on: (v) => saveMeta('rules', { max_characters_per_shot: Number(v) }) }));
  p2.append(mr);
  const mv = el('div', 'f'); mv.append(el('span', null, 'Mouvements de caméra autorisés'));
  const box = el('div', 'chips');
  Object.keys(S.film.vocab.MOVES).forEach((k) => {
    const on = (m.allowed_moves || []).includes(k);
    const b = el('button', 'chip', k); b.style.cssText = on ? 'background:var(--sel);color:var(--selink);border-color:var(--sel)' : 'cursor:pointer';
    b.onclick = () => { const l = [...(m.allowed_moves || [])]; const i = l.indexOf(k); i > -1 ? l.splice(i, 1) : l.push(k); saveMeta('motion', { allowed_moves: l }); };
    box.append(b);
  });
  mv.append(box); p2.append(mv);
  p2.append(field('Contraintes de mouvement — collées dans chaque prompt vidéo', m.short || '', { tag: 'textarea', rows: 3, on: (v) => saveMeta('motion', { short: v }) }));
  body.append(p2);

  const p3 = el('div', 'pane'); p3.append(el('h2', null, 'Dossier'));
  p3.append(el('div', 'mono muted', S.film.project.path));
  const forget = el('button', 'act danger', 'Retirer de la liste');
  forget.onclick = () => confirmDlg('Retirer ce projet ?', 'Le dossier et les fichiers ne sont pas touchés : le projet disparaît seulement de la liste de régie.',
    'Retirer', async () => { await post('/api/projects', { op: 'forget', id: S.pid }); S.pid = null; boot(); });
  p3.append(forget);
  body.append(p3);

  shell('Réglages', S.film.project.name, [], body, sideHelp());
}

/* ── prompts ──────────────────────────────────────────────────────── */
function promptPane(title, targets) {
  const p = el('div', 'pane'); p.append(el('h2', null, title));
  const tabs = el('div', 'tabs'); const host = el('div');
  const draw = () => {
    const t = targets.find((x) => x.id === S.tab) || targets[0];
    [...tabs.children].forEach((b) => b.classList.toggle('on', b.dataset.id === t.id));
    host.innerHTML = '';
    const head = el('div', 'phead');
    head.append(el('span', 'k', t.kind === 'image' ? 'image' : 'vidéo'));
    const pre = el('pre'); pre.append(document.createTextNode(t.text || ''));
    if (t.negative?.length) { pre.append(document.createTextNode('\n\n')); pre.append(el('span', 'neg', `NEVER: ${t.negative.join(', ')}.`)); }
    const cp = el('button', 'act', 'Copier');
    cp.onclick = async () => { await navigator.clipboard.writeText(pre.textContent); toast('prompt copié'); };
    head.append(cp); host.append(head, pre);
    if (t.notes?.length) { const n = el('div', 'notes'); t.notes.forEach((x) => n.append(el('div', null, x))); host.append(n); }
  };
  targets.forEach((t) => { const b = el('button', null, t.label.split(' (')[0]); b.dataset.id = t.id; b.onclick = () => { S.tab = t.id; draw(); }; tabs.append(b); });
  if (targets.length > 1) p.append(tabs);
  p.append(host); draw(); return p;
}

/* ── châssis ──────────────────────────────────────────────────────── */
const VIEWS = [
  ['script', 'Script', viewScript], ['characters', 'Personnages', () => viewEntities('characters')],
  ['locations', 'Lieux', () => viewEntities('locations')], ['props', 'Objets', () => viewEntities('props')],
  ['plans', 'Plans', viewShots], ['sheets', 'Planches', viewSheets], ['settings', 'Réglages', viewSettings],
];

function rail() {
  const r = $('#rail'); r.innerHTML = '';
  if (!S.pid) {
    r.append(el('div', 'grp', 'régie'));
    const b = el('button', 'on', 'Projets'); b.append(el('b', null, String(S.projects.length)));
    r.append(b, el('div', 'pad'));
    const help = el('div', 'grp', 'un projet = un dossier');
    r.append(help);
    return;
  }
  const counts = { characters: S.charIds?.length, locations: S.locIds?.length, props: S.propIds?.length,
    plans: S.film.shots.length, sheets: (S.film.sheets || []).length };
  r.append(el('div', 'grp', 'Écriture'));
  VIEWS.forEach(([id, label], i) => {
    if (i === 1) r.append(el('div', 'grp', 'Bible'));
    if (i === 4) r.append(el('div', 'grp', 'Découpage'));
    if (i === 6) r.append(el('div', 'grp', 'Projet'));
    const b = el('button', S.view === id ? 'on' : '', label);
    if (counts[id] != null) b.append(el('b', null, String(counts[id])));
    b.onclick = () => { S.view = id; S.sel = null; renderView(); };
    r.append(b);
  });
  r.append(el('div', 'pad'));
  const back = el('button', '', 'Tous les projets');
  back.onclick = () => { S.pid = null; S.view = 'projects'; boot(); };
  r.append(back);
}

function health() {
  const box = $('#health'); box.innerHTML = '';
  if (!S.film) return;
  const n = (l) => S.film.issues.filter((i) => i.level === l).length;
  const add = (c, t) => box.append(el('span', c, t));
  if (n('error')) add('e', `${n('error')} erreur${n('error') > 1 ? 's' : ''}`);
  if (n('block')) add('e', `${n('block')} bloquant`);
  if (n('warn')) add('w', `${n('warn')} à vérifier`);
  if (!S.film.issues.length) add('k', 'conforme');
  add('', `${S.film.shots.length} plans · ${S.film.total}s`);
}

const renderView = () => {
  rail();
  history.replaceState(null, '', S.pid ? `#/p/${S.pid}/${S.view}` : '#/projets');
  (VIEWS.find((v) => v[0] === S.view)?.[2] || viewProjects)();
};

async function reload() { await loadFilm(); renderView(); }
async function reloadSoft() { await loadFilm(); health(); }
async function loadFilm() {
  S.film = await api(api_p('film'));
  const a = await api(api_p('assets'));
  S.charIds = a.characters.map((c) => c.id); S.locIds = a.locations.map((l) => l.id); S.propIds = a.props.map((p) => p.id);
  health();
}

async function open(pid) {
  S.pid = pid; S.sel = null; S.view = 'plans';
  localStorage.setItem('regie:pid', pid);
  await loadFilm();
  $('#projbtn').hidden = false;
  $('#projbtn').textContent = `${S.film.title} · ${S.film.episode?.id || ''}`;
  $('#projbtn').onclick = () => { S.pid = null; boot(); };
  renderView();
}

async function boot() {
  S.projects = (await api('/api/projects')).projects;
  const h = location.hash.replace(/^#\/?/, '').split('/');
  if (h[0] === 'p' && h[1] && S.projects.some((p) => p.id === h[1])) { const v = h[2]; await open(h[1]); if (v && VIEWS.some((x) => x[0] === v)) { S.view = v; renderView(); } return; }
  const last = localStorage.getItem('regie:pid');
  if (S.pid) return renderView();
  $('#projbtn').hidden = true; $('#health').innerHTML = '';
  if (last && S.projects.some((p) => p.id === last)) return open(last);
  S.view = 'projects'; rail(); viewProjects();
}
boot();
