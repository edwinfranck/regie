const $ = (s) => document.querySelector(s);
const el = (t, c, txt) => { const n = document.createElement(t); if (c) n.className = c; if (txt != null) n.textContent = txt; return n; };
const api = (u, opt) => fetch(u, opt).then((r) => r.json());

let FILM = null, CURRENT = null, TAB = 'still';

const toast = (msg) => {
  const t = $('#toast'); t.textContent = msg; t.classList.add('on');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('on'), 1600);
};

const issuesFor = (id) => (FILM?.issues || []).filter((i) => i.where === `plan ${id}`);

function health() {
  const n = (l) => FILM.issues.filter((i) => i.level === l).length;
  const box = $('#health'); box.innerHTML = '';
  const add = (cls, txt) => box.append(el('span', cls, txt));
  if (n('error')) add('e', `${n('error')} erreur${n('error') > 1 ? 's' : ''}`);
  if (n('block')) add('b', `${n('block')} bloquant${n('block') > 1 ? 's' : ''}`);
  if (n('warn')) add('w', `${n('warn')} avertissement${n('warn') > 1 ? 's' : ''}`);
  if (!FILM.issues.length) add('k', 'bible conforme');
  add('', `${FILM.shots.length} plans · ${FILM.total}s`);
}

function sidebar() {
  const shots = $('#shot-list'); shots.innerHTML = '';
  for (const s of FILM.shots) {
    const li = el('li');
    li.append(el('span', 'n', String(s.id)));
    li.append(el('span', 't', s.action || s.error || ''));
    const bad = issuesFor(s.id);
    if (bad.length) li.append(el('span', 'flag', bad.some((i) => i.level === 'error') ? '❌' : bad.some((i) => i.level === 'block') ? '⛔' : '⚠️'));
    li.append(el('span', 'd', `${s.duration}s`));
    li.onclick = () => openShot(s.id);
    li.dataset.k = `shot:${s.id}`;
    shots.append(li);
  }
  const sheets = $('#sheet-list'); sheets.innerHTML = '';
  for (const sh of FILM.sheets) {
    const li = el('li');
    li.append(el('span', 'n', sh.id.replace('SB', '')));
    li.append(el('span', 't', sh.title || sh.id));
    li.append(el('span', 'd', `${sh.shots.length} cases`));
    li.onclick = () => openSheet(sh.id);
    li.dataset.k = `sheet:${sh.id}`;
    sheets.append(li);
  }
}

const mark = (key) => document.querySelectorAll('nav li').forEach((li) => li.classList.toggle('on', li.dataset.k === key));

function cameraCard(shot) {
  const card = el('div', 'card'); card.append(el('h2', null, 'Caméra'));
  const row = el('div', 'cam');
  const { SIZES, ANGLES, MOVES, allowed } = FILM.vocab;
  const sel = (field, table, value, gate) => {
    const lab = el('label', null, field);
    const s = el('select');
    s.append(new Option('—', ''));
    for (const [k, v] of Object.entries(table)) {
      const o = new Option(`${k} · ${v.fr}`, k, false, k === value);
      if (gate && !gate.includes(k)) { o.disabled = true; o.text += '  (interdit par MOTION)'; }
      s.append(o);
    }
    s.onchange = () => save(shot.id, field, s.value);
    lab.append(s); return lab;
  };
  row.append(sel('size', SIZES, shot.camera.size));
  row.append(sel('angle', ANGLES, shot.camera.angle));
  row.append(sel('move', MOVES, shot.camera.move, allowed));
  const lens = el('label', 'small', 'lens'); const li = el('input'); li.value = shot.camera.lens || '';
  li.onchange = () => save(shot.id, 'lens', li.value); lens.append(li); row.append(lens);
  const dur = el('label', 'small', 'durée (s)'); const di = el('input'); di.type = 'number'; di.value = shot.duration;
  di.onchange = () => save(shot.id, 'duration', di.value); dur.append(di); row.append(dur);
  card.append(row);
  return card;
}

async function save(id, field, value) {
  const r = await api('/api/camera', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, field, value }) });
  if (r.error) return toast(`✕ ${r.error}`);
  FILM.issues = r.issues;
  const i = FILM.shots.findIndex((s) => String(s.id) === String(id));
  if (i > -1) FILM.shots[i] = r.shot;
  health(); sidebar(); mark(`shot:${id}`);
  toast('plans.yaml mis à jour');
  openShot(id, true);
}

function refsCard(refs) {
  const card = el('div', 'card'); card.append(el('h2', null, `Références à charger (${refs.length})`));
  const wrap = el('div', 'refs');
  for (const r of refs) {
    const box = el('div', 'ref');
    const img = new Image(); img.src = `/ref?path=${encodeURIComponent(r.path)}`; img.loading = 'lazy';
    img.onerror = () => { const m = el('div', 'miss', 'image absente'); img.replaceWith(m); };
    box.append(img); box.append(el('div', 'why', `${r.id} — ${r.why}`));
    wrap.append(box);
  }
  card.append(wrap); return card;
}

function promptsCard(targets) {
  const card = el('div', 'card'); card.append(el('h2', null, 'Prompts compilés'));
  const tabs = el('div', 'tabs');
  const body = el('div');
  const draw = () => {
    const t = targets.find((x) => x.id === TAB) || targets[0];
    TAB = t.id;
    [...tabs.children].forEach((b) => b.classList.toggle('on', b.dataset.id === TAB));
    body.innerHTML = '';
    const box = el('div', 'prompt');
    const pre = el('pre'); pre.append(document.createTextNode(t.text));
    if (t.negative?.length) { pre.append(document.createTextNode('\n\n')); pre.append(el('span', 'neg', `NEVER: ${t.negative.join(', ')}.`)); }
    const btn = el('button', 'copy', 'Copier le prompt');
    btn.onclick = async () => {
      await navigator.clipboard.writeText(pre.textContent);
      toast(`${t.label} copié`); btn.textContent = 'Copié ✓'; setTimeout(() => (btn.textContent = 'Copier'), 1400);
    };
    const bar = el('div', 'bar'); bar.append(el('span', 'kind', t.kind === 'image' ? 'image' : 'vidéo'), btn);
    box.append(bar, pre); body.append(box);
    if (t.notes?.length) { const n = el('div', 'notes'); t.notes.forEach((x) => n.append(el('div', null, x))); body.append(n); }
  };
  for (const t of targets) {
    const b = el('button', null, t.label.split(' (')[0]); b.dataset.id = t.id;
    b.onclick = () => { TAB = t.id; draw(); };
    tabs.append(b);
  }
  card.append(tabs, body); draw(); return card;
}

function issuesCard(list) {
  if (!list.length) return null;
  const card = el('div', 'card'); card.append(el('h2', null, 'À régler sur ce plan'));
  const ul = el('ul', 'issues');
  for (const i of list) {
    const li = el('li');
    li.append(el('span', `lvl ${i.level}`, i.level === 'error' ? 'erreur' : i.level === 'block' ? 'bloquant' : 'attention'));
    const d = el('div'); d.append(el('div', null, i.msg)); d.append(el('div', 'fix', i.fix)); li.append(d);
    ul.append(li);
  }
  card.append(ul); return card;
}

async function openShot(id, silent) {
  const d = await api(`/api/shot/${id}`);
  CURRENT = `shot:${id}`; mark(CURRENT); history.replaceState(null, '', `#plan-${id}`);
  const p = $('#panel'); p.innerHTML = '';
  if (d.error) { p.append(el('div', 'empty', d.error)); return; }
  const h = el('h1', null, `Plan ${id}`);
  h.append(el('small', null, `${d.duration}s · ${d.location} · ${d.characters.map((c) => `${c.id} ${c.name}`).join(', ') || 'aucun personnage'}${d.props.length ? ' · ' + d.props.map((x) => x.id).join(' ') : ''}`));
  p.append(h);
  p.append(el('div', 'action', d.action));
  if (d.dialogue) p.append(el('div', 'dial', `${d.dialogue.speaker} : « ${d.dialogue.line} »`));
  if (d.note) p.append(el('div', 'action', d.note));
  const iss = issuesCard(issuesFor(id)); if (iss) p.append(iss);
  p.append(cameraCard(d));
  if (d.refs.length) p.append(refsCard(d.refs));
  p.append(promptsCard(d.targets));
  if (!silent) p.scrollTop = 0;
}

async function openSheet(id) {
  const d = await api(`/api/sheet/${id}`);
  CURRENT = `sheet:${id}`; mark(CURRENT); history.replaceState(null, '', `#planche-${id}`);
  const p = $('#panel'); p.innerHTML = '';
  if (d.error) { p.append(el('div', 'empty', d.error)); return; }
  const h = el('h1', null, `Planche ${d.sheet.id}`);
  h.append(el('small', null, `${d.sheet.title || ''} — plans ${d.sheet.shots.join(', ')}`));
  p.append(h);
  const card = el('div', 'card'); card.append(el('h2', null, 'Cases'));
  d.panels.forEach((pn, i) => card.append(el('div', 'action', `${i + 1}. (plan ${pn.id}) ${pn.cameraFr} — ${pn.action}`)));
  p.append(card);
  if (d.refs.length) p.append(refsCard(d.refs));
  TAB = 'sheet';
  p.append(promptsCard(d.targets));
}

(async function boot() {
  FILM = await api('/api/film');
  $('#film-title').textContent = `${FILM.title} · ${FILM.episode.id} ${FILM.episode.title || ''}`;
  document.title = `régie — ${FILM.title}`;
  health(); sidebar();
  // Une URL par plan : le rafraichissement et les favoris retombent au bon endroit.
  const h = decodeURIComponent(location.hash.slice(1));
  if (h.startsWith('planche-')) openSheet(h.slice(8));
  else if (h.startsWith('plan-')) openShot(h.slice(5));
  else if (FILM.shots.length) openShot(FILM.shots[0].id);
})();
