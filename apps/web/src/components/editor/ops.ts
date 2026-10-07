import { type Clip, clipDuration, clipEnd, dimsFor, isAudible, isVisual, type MediaRef, newId, splitClip, type Track, TRACK_KINDS, type TrackKind, trimClip } from '@regie/core';
import type { Doc } from './store';
import { round3 } from './time';

// Opérations d'édition sur le document, toutes immuables. Elles s'appuient
// sur les fonctions pures de @regie/core (splitClip, trimClip…) : ce que
// l'éditeur produit est exactement ce que le rendu FFmpeg lira.

/** Une piste accepte-t-elle ce clip ? Sous-titres : texte seul ; sinon selon le type du média. */
export function accepts(track: Track, clip: Pick<Clip, 'assetId' | 'text'>, media?: MediaRef | null) {
  if (track.kind === 'SUBTITLE') return !clip.assetId;
  if (!clip.assetId || !media) return false;
  return (TRACK_KINDS[track.kind as TrackKind]?.media as readonly string[] | undefined)?.includes(media.type) ?? false;
}

export const acceptsType = (track: Track, type: string) => track.kind !== 'SUBTITLE' && ((TRACK_KINDS[track.kind as TrackKind]?.media as readonly string[] | undefined)?.includes(type) ?? false);

/** Les images n'ont pas de durée propre : [in, out] vaut toujours [0, durée]. */
const normalize = (c: Clip, media?: MediaRef | null): Clip => (!c.assetId || media?.type === 'IMAGE' ? { ...c, inSec: 0, outSec: round3(clipDuration(c)) } : c);

const mapTracks = (d: Doc, fn: (t: Track) => Track): Doc => {
  let changed = false;
  const tracks = d.tracks.map((t) => {
    const n = fn(t);
    if (n !== t) changed = true;
    return n;
  });
  return changed ? { ...d, tracks } : d;
};

const sortClips = (clips: Clip[]) => [...clips].sort((a, b) => a.startSec - b.startSec);

export function addClip(d: Doc, trackId: string, clip: Clip): Doc {
  return mapTracks(d, (t) => (t.id === trackId ? { ...t, clips: sortClips([...t.clips, clip]) } : t));
}

export function updateClip(d: Doc, id: string, fn: (c: Clip) => Clip): Doc {
  return mapTracks(d, (t) => {
    const i = t.clips.findIndex((c) => c.id === id);
    if (i < 0) return t;
    const next = fn(t.clips[i]);
    if (next === t.clips[i]) return t;
    const clips = t.clips.slice();
    clips[i] = next;
    return { ...t, clips: sortClips(clips) };
  });
}

/** Déplace des clips de `dt` secondes ; un clip seul peut changer de piste. */
export function moveClips(d: Doc, ids: string[], dt: number, toTrackId?: string | null): Doc {
  const set = new Set(ids);
  if (toTrackId && ids.length === 1) {
    let moving: Clip | null = null;
    for (const t of d.tracks) moving ??= t.clips.find((c) => c.id === ids[0]) ?? null;
    if (!moving) return d;
    const moved = { ...moving, startSec: round3(Math.max(0, moving.startSec + dt)) };
    return mapTracks(d, (t) => {
      const has = t.clips.some((c) => c.id === moved.id);
      if (t.id === toTrackId) return { ...t, clips: sortClips([...t.clips.filter((c) => c.id !== moved.id), moved]) };
      return has ? { ...t, clips: t.clips.filter((c) => c.id !== moved.id) } : t;
    });
  }
  return mapTracks(d, (t) => (t.clips.some((c) => set.has(c.id)) ? { ...t, clips: sortClips(t.clips.map((c) => (set.has(c.id) ? { ...c, startSec: round3(Math.max(0, c.startSec + dt)) } : c))) } : t));
}

export function trim(d: Doc, id: string, edge: 'start' | 'end', to: number, media?: MediaRef | null, maxOut?: number | null): Doc {
  return updateClip(d, id, (c) => {
    const isStill = !c.assetId || media?.type === 'IMAGE';
    // Une image ou un sous-titre s'allonge des deux côtés : on lui prête une
    // réserve d'entrée le temps du calcul, puis on renormalise.
    const base = isStill ? { ...c, inSec: c.inSec + 3600, outSec: c.outSec + 3600 } : c;
    const next = trimClip(base, edge, Math.max(0, to), isStill ? null : maxOut);
    return normalize({ ...next, fadeInSec: Math.min(next.fadeInSec, clipDuration(next)), fadeOutSec: Math.min(next.fadeOutSec, clipDuration(next)) }, media);
  });
}

export function removeClips(d: Doc, ids: string[]): Doc {
  const set = new Set(ids);
  return mapTracks(d, (t) => (t.locked || !t.clips.some((c) => set.has(c.id)) ? t : { ...t, clips: t.clips.filter((c) => !set.has(c.id)) }));
}

/**
 * Coupe à `at` les clips choisis, ou à défaut tous les clips sous la tête de
 * lecture des pistes non verrouillées. Renvoie aussi les ids des moitiés droites.
 */
export function splitAt(d: Doc, at: number, ids: string[]): { doc: Doc; created: string[] } {
  const set = new Set(ids);
  const created: string[] = [];
  const doc = mapTracks(d, (t) => {
    if (t.locked) return t;
    let changed = false;
    const clips = t.clips.flatMap((c) => {
      if (set.size && !set.has(c.id)) return [c];
      const parts = splitClip(c, at);
      if (!parts) return [c];
      changed = true;
      created.push(parts[1].id);
      return parts;
    });
    return changed ? { ...t, clips } : t;
  });
  return { doc, created };
}

/** Duplique les clips juste après la fin de la sélection, sur leurs pistes. */
export function duplicateClips(d: Doc, ids: string[]): { doc: Doc; created: string[] } {
  const set = new Set(ids);
  const chosen = d.tracks.filter((t) => !t.locked).flatMap((t) => t.clips.filter((c) => set.has(c.id)));
  if (!chosen.length) return { doc: d, created: [] };
  const from = Math.min(...chosen.map((c) => c.startSec));
  const to = Math.max(...chosen.map(clipEnd));
  const offset = to - from;
  const created: string[] = [];
  const doc = mapTracks(d, (t) => {
    if (t.locked) return t;
    const copies = t.clips.filter((c) => set.has(c.id)).map((c) => {
      const id = newId();
      created.push(id);
      return { ...c, id, startSec: round3(c.startSec + offset) };
    });
    return copies.length ? { ...t, clips: sortClips([...t.clips, ...copies]) } : t;
  });
  return { doc, created };
}

export function updateTrack(d: Doc, id: string, patch: Partial<Track>): Doc {
  return mapTracks(d, (t) => (t.id === id ? { ...t, ...patch } : t));
}

const reorder = (tracks: Track[]) => tracks.map((t, order) => (t.order === order ? t : { ...t, order }));

/** Ajoute une piste à sa place : vidéo au-dessus des vidéos, son sous les sons, sous-titres en haut. */
export function addTrack(d: Doc, kind: TrackKind): { doc: Doc; id: string } {
  const tracks = d.tracks.slice();
  const count = (k: (x: string) => boolean) => tracks.filter((t) => k(t.kind)).length;
  const id = newId('t');
  let index: number;
  let name: string;
  if (kind === 'VIDEO') {
    const first = tracks.findIndex((t) => isVisual(t.kind));
    index = first < 0 ? tracks.findIndex((t) => t.kind !== 'SUBTITLE') : first;
    if (index < 0) index = tracks.length;
    name = nextName(tracks, 'V', count(isVisual) + 1);
  } else if (kind === 'SUBTITLE') {
    index = 0;
    name = count((k) => k === 'SUBTITLE') ? `Sous-titres ${count((k) => k === 'SUBTITLE') + 1}` : 'Sous-titres';
  } else {
    const lastAudio = tracks.map((t) => isAudible(t.kind)).lastIndexOf(true);
    index = lastAudio < 0 ? tracks.length : lastAudio + 1;
    name = nextName(tracks, 'A', count((k) => k === 'AUDIO') + 1);
  }
  tracks.splice(index, 0, { id, kind, name, order: 0, muted: false, locked: false, volume: 1, clips: [] });
  return { doc: { ...d, tracks: reorder(tracks) }, id };
}

function nextName(tracks: Track[], prefix: string, n: number) {
  const names = new Set(tracks.map((t) => t.name));
  while (names.has(`${prefix}${n}`)) n++;
  return `${prefix}${n}`;
}

export function removeTrack(d: Doc, id: string): Doc {
  return { ...d, tracks: reorder(d.tracks.filter((t) => t.id !== id)) };
}

export function setFormat(d: Doc, aspectRatio: string | null, fallback: { aspectRatio: string; resolution?: string | null }): Doc {
  const dims = aspectRatio ? dimsFor(aspectRatio) : dimsFor(fallback.aspectRatio, fallback.resolution);
  return { ...d, aspectRatio, ...dims };
}

/** Un clip neuf pour un média posé à `at`. */
export function clipFor(media: MediaRef, at: number, duration: number): Clip {
  return { id: newId(), assetId: media.id, shotId: null, name: media.name, startSec: round3(at), inSec: 0, outSec: round3(Math.max(0.1, duration)), volume: 1, opacity: 1, fadeInSec: 0, fadeOutSec: 0, text: null };
}

export function subtitleClip(at: number, text = 'Sous-titre', duration = 2): Clip {
  return { id: newId(), assetId: null, shotId: null, name: null, startSec: round3(at), inSec: 0, outSec: duration, volume: 1, opacity: 1, fadeInSec: 0, fadeOutSec: 0, text };
}

/** Bords de clips (hors clips déplacés) pour l'aimantation. */
export function snapPoints(d: Doc, exclude: Set<string>, playhead: number) {
  const pts = [0, playhead];
  for (const t of d.tracks) for (const c of t.clips) if (!exclude.has(c.id)) pts.push(c.startSec, clipEnd(c));
  return pts;
}

/** L'état à enregistrer : exactement ce qu'attend PUT /timelines/:id. */
export function payload(d: Doc) {
  return {
    name: d.name,
    fps: d.fps,
    aspectRatio: d.aspectRatio,
    tracks: d.tracks.map((t, order) => ({
      id: t.id,
      kind: t.kind,
      name: t.name,
      order,
      muted: t.muted,
      locked: t.locked,
      volume: t.volume,
      clips: t.clips.filter((c) => c.outSec > c.inSec).map((c) => ({ ...c, startSec: round3(c.startSec), inSec: round3(c.inSec), outSec: round3(c.outSec) })),
    })),
  };
}
