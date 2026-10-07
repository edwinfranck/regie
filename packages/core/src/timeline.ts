// Le montage, en fonctions pures : le modèle d'une séquence, les opérations
// d'édition, l'assemblage depuis le découpage, les exports texte et la
// construction de la commande FFmpeg du rendu. L'interface et le worker
// partagent ce code : ce que l'on voit est ce qui sera rendu.

export const TRACK_KINDS = {
  VIDEO: { label: 'Vidéo', media: ['IMAGE', 'VIDEO'] },
  AUDIO: { label: 'Audio', media: ['AUDIO', 'VIDEO'] },
  DIALOGUE: { label: 'Dialogue', media: ['AUDIO'] },
  MUSIC: { label: 'Musique', media: ['AUDIO'] },
  SFX: { label: 'Effets', media: ['AUDIO'] },
  SUBTITLE: { label: 'Sous-titres', media: [] as string[] },
} as const;
export type TrackKind = keyof typeof TRACK_KINDS;

export const isVisual = (k: string) => k === 'VIDEO';
export const isAudible = (k: string) => k === 'AUDIO' || k === 'DIALOGUE' || k === 'MUSIC' || k === 'SFX';

export interface MediaRef {
  id: string;
  type: 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT';
  name: string;
  mimeType: string;
  durationSec?: number | null;
  width?: number | null;
  height?: number | null;
  storageKey?: string;
}

export interface Clip {
  id: string;
  assetId?: string | null;
  shotId?: string | null;
  name?: string | null;
  /** Position sur la timeline (s). */
  startSec: number;
  /** Portion du média source utilisée [inSec, outSec] (s). Pour une image : 0 → durée. */
  inSec: number;
  outSec: number;
  volume: number;
  opacity: number;
  fadeInSec: number;
  fadeOutSec: number;
  text?: string | null;
}

export interface Track {
  id: string;
  kind: TrackKind | string;
  name: string;
  order: number;
  muted: boolean;
  locked: boolean;
  volume: number;
  clips: Clip[];
}

export interface Sequence {
  id: string;
  name: string;
  fps: number;
  width: number;
  height: number;
  tracks: Track[];
}

export const clipDuration = (c: Pick<Clip, 'inSec' | 'outSec'>) => Math.max(0, c.outSec - c.inSec);
export const clipEnd = (c: Clip) => c.startSec + clipDuration(c);
export const sequenceDuration = (s: Pick<Sequence, 'tracks'>) => s.tracks.reduce((m, t) => Math.max(m, ...t.clips.map(clipEnd), 0), 0);

const round = (n: number, fps = 1000) => Math.round(n * fps) / fps;
let counter = 0;
export const newId = (prefix = 'c') => `${prefix}_${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Les pistes d'une séquence neuve, dans l'ordre d'affichage (du haut vers le bas pour la vidéo). */
export function defaultTracks(): Track[] {
  const t = (kind: TrackKind, name: string, order: number): Track => ({ id: newId('t'), kind, name, order, muted: false, locked: false, volume: 1, clips: [] });
  return [t('SUBTITLE', 'Sous-titres', 0), t('VIDEO', 'V3', 1), t('VIDEO', 'V2', 2), t('VIDEO', 'V1', 3), t('DIALOGUE', 'Dialogue', 4), t('AUDIO', 'A1', 5), t('MUSIC', 'Musique', 6), t('SFX', 'Effets', 7)];
}

/** Coupe un clip au temps `at` de la timeline. Renvoie les deux moitiés, ou null si hors du clip. */
export function splitClip(c: Clip, at: number): [Clip, Clip] | null {
  if (at <= c.startSec + 0.04 || at >= clipEnd(c) - 0.04) return null;
  const cut = c.inSec + (at - c.startSec);
  return [
    { ...c, outSec: round(cut), fadeOutSec: 0 },
    { ...c, id: newId(), startSec: round(at), inSec: round(cut), fadeInSec: 0 },
  ];
}

/**
 * Rogne un bord. `edge` = 'start' déplace le point d'entrée (et la position),
 * 'end' déplace le point de sortie. `maxOut` = durée du média (vidéo/audio).
 */
export function trimClip(c: Clip, edge: 'start' | 'end', to: number, maxOut?: number | null): Clip {
  const min = 0.1;
  if (edge === 'end') {
    let out = c.inSec + (to - c.startSec);
    out = Math.max(c.inSec + min, maxOut ? Math.min(out, maxOut) : out);
    return { ...c, outSec: round(out) };
  }
  let delta = to - c.startSec;
  delta = Math.max(-c.inSec, Math.min(delta, clipDuration(c) - min));
  return { ...c, startSec: round(c.startSec + delta), inSec: round(c.inSec + delta) };
}

/** Aimante `t` sur les bords de clips et la tête de lecture, à `threshold` secondes près. */
export function snap(t: number, points: number[], threshold: number) {
  let best = t;
  let dist = threshold;
  for (const p of points) {
    const d = Math.abs(p - t);
    if (d < dist) {
      dist = d;
      best = p;
    }
  }
  return best;
}

/** Le clip d'une piste actif au temps t (le plus haut démarré en dernier en cas de chevauchement). */
export function clipAt(track: Track, t: number): Clip | null {
  let hit: Clip | null = null;
  for (const c of track.clips) if (t >= c.startSec && t < clipEnd(c) && (!hit || c.startSec >= hit.startSec)) hit = c;
  return hit;
}

/** Opacité effective d'un clip visuel à t, fondus compris. */
export function opacityAt(c: Clip, t: number) {
  const local = t - c.startSec;
  const d = clipDuration(c);
  let o = c.opacity;
  if (c.fadeInSec > 0 && local < c.fadeInSec) o *= local / c.fadeInSec;
  if (c.fadeOutSec > 0 && local > d - c.fadeOutSec) o *= Math.max(0, (d - local) / c.fadeOutSec);
  return Math.max(0, Math.min(1, o));
}

// ── Assemblage depuis le découpage ──

export interface ShotForAssembly {
  id: string;
  code: string;
  durationSec: number;
  dialogue?: string | null;
  /** Vidéo retenue pour le plan (la plus récente), sinon image de case. */
  video?: MediaRef | null;
  image?: MediaRef | null;
}

/**
 * Un premier montage : les plans dans l'ordre du découpage, un clip par plan
 * sur V1 (la vidéo du plan si elle existe, sinon son image tenue la durée du
 * plan), et les dialogues du plan en sous-titres. Les plans sans aucun média
 * laissent un trou de leur durée : on voit ce qui reste à fabriquer.
 */
export function assembleFromShots(shots: ShotForAssembly[], opts: { subtitles?: boolean } = {}) {
  const tracks = defaultTracks();
  const v1 = tracks.find((t) => t.name === 'V1')!;
  const subs = tracks.find((t) => t.kind === 'SUBTITLE')!;
  const missing: string[] = [];
  let t = 0;
  for (const s of shots) {
    const media = s.video ?? s.image ?? null;
    const dur = s.video?.durationSec ? Math.min(s.video.durationSec, Math.max(s.durationSec, 0.5)) : Math.max(s.durationSec, 0.5);
    if (media) v1.clips.push({ id: newId(), assetId: media.id, shotId: s.id, name: s.code, startSec: round(t), inSec: 0, outSec: round(dur), volume: 1, opacity: 1, fadeInSec: 0, fadeOutSec: 0 });
    else missing.push(s.code);
    if (opts.subtitles !== false && s.dialogue?.trim())
      subs.clips.push({ id: newId(), shotId: s.id, name: s.code, startSec: round(t), inSec: 0, outSec: round(dur), volume: 1, opacity: 1, fadeInSec: 0, fadeOutSec: 0, text: s.dialogue.trim() });
    t += dur;
  }
  return { tracks, missing, durationSec: round(t) };
}

// ── Exports texte ──

const srtTime = (s: number) => {
  const ms = Math.round(s * 1000);
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const sec = Math.floor((ms % 60000) / 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`;
};

export function toSrt(seq: Pick<Sequence, 'tracks'>) {
  const cues = seq.tracks
    .filter((t) => t.kind === 'SUBTITLE' && !t.muted)
    .flatMap((t) => t.clips)
    .filter((c) => c.text?.trim())
    .sort((a, b) => a.startSec - b.startSec);
  return cues.map((c, i) => `${i + 1}\n${srtTime(c.startSec)} --> ${srtTime(clipEnd(c))}\n${c.text!.trim()}\n`).join('\n');
}

const tc = (s: number, fps: number) => {
  const f = Math.round(s * fps);
  const hh = Math.floor(f / (3600 * fps));
  const mm = Math.floor((f % (3600 * fps)) / (60 * fps));
  const ss = Math.floor((f % (60 * fps)) / fps);
  const ff = f % fps;
  return [hh, mm, ss, ff].map((n) => String(n).padStart(2, '0')).join(':');
};

/**
 * EDL CMX3600 de la piste V1 (et de son audio) : l'échange le plus simple
 * avec Premiere, Resolve ou Avid, qui relient ensuite les fichiers par nom.
 */
export function toEdl(seq: Sequence, media: Map<string, MediaRef>) {
  const v1 = [...seq.tracks].filter((t) => t.kind === 'VIDEO').sort((a, b) => b.order - a.order)[0];
  const lines = [`TITLE: ${seq.name.toUpperCase()}`, 'FCM: NON-DROP FRAME', ''];
  (v1?.clips ?? [])
    .slice()
    .sort((a, b) => a.startSec - b.startSec)
    .forEach((c, i) => {
      const m = c.assetId ? media.get(c.assetId) : null;
      const reel = (m?.name ?? 'BL').replace(/[^A-Za-z0-9_]/g, '_').slice(0, 8).toUpperCase() || 'AX';
      lines.push(`${String(i + 1).padStart(3, '0')}  ${reel.padEnd(8)} V     C        ${tc(c.inSec, seq.fps)} ${tc(c.outSec, seq.fps)} ${tc(c.startSec, seq.fps)} ${tc(clipEnd(c), seq.fps)}`);
      if (m) lines.push(`* FROM CLIP NAME: ${m.name}`);
      lines.push('');
    });
  return lines.join('\n');
}

// ── Rendu FFmpeg ──

export interface RenderPlan {
  args: string[];
  durationSec: number;
  /** Fichiers d'entrée à matérialiser : index d'entrée → asset. */
  inputs: { assetId: string; kind: 'image' | 'video' | 'audio' }[];
}

export interface RenderOptions {
  format: 'mp4' | 'mov';
  output: string;
  /** Chemin local de chaque asset (déjà téléchargé). */
  pathOf: (assetId: string) => string;
  /** L'asset a-t-il une piste son (vidéos) ? */
  hasAudio: (assetId: string) => boolean;
  /** Fichier SRT à incruster (sous-titres), si présent. */
  srtPath?: string | null;
  quality?: 'draft' | 'standard' | 'high';
}

const f3 = (n: number) => n.toFixed(3);

/**
 * La commande FFmpeg d'une séquence : un fond noir de la durée totale, les
 * clips visuels superposés dans l'ordre des pistes (V1 en dessous), chaque
 * son retardé à sa position puis mixé, les sous-titres incrustés.
 */
export function buildRenderPlan(seq: Sequence, media: Map<string, MediaRef>, opt: RenderOptions): RenderPlan {
  const total = Math.max(sequenceDuration(seq), 0.5);
  const { width: W, height: H, fps } = seq;
  const args: string[] = ['-y', '-hide_banner', '-loglevel', 'error', '-progress', 'pipe:1', '-nostats'];
  const inputs: RenderPlan['inputs'] = [];
  const filters: string[] = [];
  const audioLabels: string[] = [];

  filters.push(`color=c=black:s=${W}x${H}:r=${fps}:d=${f3(total)}[base0]`);
  let base = 'base0';

  // Pistes vidéo : ordre décroissant = V1 (plus grand order) en premier, donc en dessous.
  const videoTracks = seq.tracks.filter((t) => isVisual(t.kind) && !t.muted).sort((a, b) => b.order - a.order);
  let n = 0;
  for (const track of videoTracks) {
    for (const c of [...track.clips].sort((a, b) => a.startSec - b.startSec)) {
      const m = c.assetId ? media.get(c.assetId) : null;
      if (!m || (m.type !== 'IMAGE' && m.type !== 'VIDEO')) continue;
      const dur = clipDuration(c);
      if (dur <= 0) continue;
      const idx = inputs.length;
      if (m.type === 'IMAGE') {
        args.push('-loop', '1', '-framerate', String(fps), '-t', f3(dur), '-i', opt.pathOf(m.id));
        inputs.push({ assetId: m.id, kind: 'image' });
      } else {
        args.push('-ss', f3(c.inSec), '-t', f3(dur), '-i', opt.pathOf(m.id));
        inputs.push({ assetId: m.id, kind: 'video' });
      }
      const chain = [
        `scale=${W}:${H}:force_original_aspect_ratio=decrease`,
        'format=yuva420p',
        `pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=black@0`,
        'setsar=1',
        `fps=${fps}`,
        ...(c.opacity < 1 ? [`colorchannelmixer=aa=${c.opacity.toFixed(3)}`] : []),
        ...(c.fadeInSec > 0 ? [`fade=t=in:st=0:d=${f3(c.fadeInSec)}:alpha=1`] : []),
        ...(c.fadeOutSec > 0 ? [`fade=t=out:st=${f3(Math.max(0, dur - c.fadeOutSec))}:d=${f3(c.fadeOutSec)}:alpha=1`] : []),
        `setpts=PTS-STARTPTS+${f3(c.startSec)}/TB`,
      ].join(',');
      filters.push(`[${idx}:v]${chain}[v${n}]`);
      const next = `base${n + 1}`;
      filters.push(`[${base}][v${n}]overlay=eof_action=pass:enable='between(t,${f3(c.startSec)},${f3(c.startSec + dur)})'[${next}]`);
      base = next;
      n++;

      // Le son des vidéos posées sur une piste vidéo suit le clip.
      if (m.type === 'VIDEO' && opt.hasAudio(m.id) && c.volume > 0) audioLabels.push(audioChain(filters, idx, c, track.volume));
    }
  }

  // Pistes son.
  for (const track of seq.tracks.filter((t) => isAudible(t.kind) && !t.muted)) {
    for (const c of track.clips) {
      const m = c.assetId ? media.get(c.assetId) : null;
      if (!m || (m.type !== 'AUDIO' && m.type !== 'VIDEO') || c.volume <= 0) continue;
      if (m.type === 'VIDEO' && !opt.hasAudio(m.id)) continue;
      const dur = clipDuration(c);
      if (dur <= 0) continue;
      const idx = inputs.length;
      args.push('-ss', f3(c.inSec), '-t', f3(dur), '-i', opt.pathOf(m.id));
      inputs.push({ assetId: m.id, kind: m.type === 'VIDEO' ? 'video' : 'audio' });
      audioLabels.push(audioChain(filters, idx, c, track.volume));
    }
  }

  let vout = base;
  if (opt.srtPath) {
    const esc = opt.srtPath.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'");
    filters.push(`[${base}]subtitles='${esc}':force_style='FontName=DejaVu Sans,FontSize=20,Outline=1,Shadow=0,MarginV=28'[vsub]`);
    vout = 'vsub';
  }
  filters.push(`[${vout}]format=yuv420p[vout]`);

  if (audioLabels.length) filters.push(`${audioLabels.map((l) => `[${l}]`).join('')}amix=inputs=${audioLabels.length}:normalize=0:dropout_transition=0,atrim=0:${f3(total)}[aout]`);
  else filters.push(`anullsrc=r=48000:cl=stereo,atrim=0:${f3(total)}[aout]`);

  const crf = opt.quality === 'draft' ? '28' : opt.quality === 'high' ? '17' : '21';
  args.push('-filter_complex', filters.join(';'), '-map', '[vout]', '-map', '[aout]', '-t', f3(total));
  args.push('-c:v', 'libx264', '-preset', opt.quality === 'draft' ? 'ultrafast' : 'veryfast', '-crf', crf, '-pix_fmt', 'yuv420p', '-r', String(fps));
  args.push('-c:a', 'aac', '-b:a', '192k', '-ar', '48000');
  if (opt.format === 'mp4') args.push('-movflags', '+faststart');
  args.push(opt.output);
  return { args, durationSec: total, inputs };
}

let aCounter = 0;
function audioChain(filters: string[], idx: number, c: Clip, trackVolume: number) {
  const dur = clipDuration(c);
  const label = `a${idx}_${aCounter++}`;
  const delay = Math.round(c.startSec * 1000);
  const parts = [
    'aresample=48000',
    'aformat=channel_layouts=stereo',
    `volume=${(c.volume * trackVolume).toFixed(3)}`,
    ...(c.fadeInSec > 0 ? [`afade=t=in:st=0:d=${f3(c.fadeInSec)}`] : []),
    ...(c.fadeOutSec > 0 ? [`afade=t=out:st=${f3(Math.max(0, dur - c.fadeOutSec))}:d=${f3(c.fadeOutSec)}`] : []),
    `adelay=${delay}|${delay}`,
  ];
  filters.push(`[${idx}:a]${parts.join(',')}[${label}]`);
  return label;
}

export function dimsFor(aspectRatio: string, resolution?: string | null) {
  const m = resolution?.match(/^(\d+)x(\d+)$/);
  if (m) return { width: +m[1] - (+m[1] % 2), height: +m[2] - (+m[2] % 2) };
  const [w, h] = aspectRatio.split(':').map(Number);
  if (!w || !h) return { width: 1920, height: 1080 };
  const width = w >= h ? 1920 : Math.round((1920 * w) / h / 2) * 2;
  const height = w >= h ? Math.round((1920 * h) / w / 2) * 2 : 1920;
  return { width, height };
}
