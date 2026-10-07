'use client';

import { clipEnd, isVisual, type MediaRef, sequenceDuration, type TrackKind } from '@regie/core';
import { toast } from 'sonner';
import { probeDuration } from './media-cache';
import { acceptsType, addClip, addTrack, clipFor, duplicateClips, removeClips, splitAt, subtitleClip } from './ops';
import { allClips, mediaDuration, useEditor, usePlayhead } from './store';

// Les commandes de l'éditeur, appelées à l'identique par le clavier, les
// menus, la barre d'outils et l'inspecteur.

export const ZOOM_MIN = 2;
export const ZOOM_MAX = 480;
export const IMAGE_SEC = 3;
export const ASSET_MIME = 'application/x-regie-asset';

/** Le média glissé depuis le chutier (le dnd natif ne laisse pas lire les données pendant le survol). */
export const dragState: { asset: MediaRef | null } = { asset: null };

/** Ajustement de la timeline à la largeur visible : fourni par le composant timeline. */
export const viewport = { fit: () => {}, width: 1000 };

const ed = () => useEditor.getState();
const now = () => usePlayhead.getState().t;

export async function durationFor(m: MediaRef) {
  if (m.type === 'IMAGE') return IMAGE_SEC;
  const known = mediaDuration(m.id);
  if (known) return known;
  const d = await probeDuration(m.id, m.type);
  if (d) ed().setDuration(m.id, d);
  return d ?? 5;
}

export const actions = {
  undo: () => ed().undo(),
  redo: () => ed().redo(),

  split() {
    const s = ed();
    if (!s.doc) return;
    const { doc, created } = splitAt(s.doc, now(), s.selection);
    if (!created.length) return void toast.message('Rien à couper à la tête de lecture.');
    s.commit(() => doc);
  },

  remove() {
    const s = ed();
    if (!s.doc || !s.selection.length) return;
    s.commit((d) => removeClips(d, s.selection));
    s.select([]);
  },

  duplicate() {
    const s = ed();
    if (!s.doc || !s.selection.length) return;
    const { doc, created } = duplicateClips(s.doc, s.selection);
    if (!created.length) return;
    s.commit(() => doc);
    s.select(created);
  },

  selectAll() {
    const s = ed();
    if (!s.doc) return;
    s.select(s.doc.tracks.filter((t) => !t.locked).flatMap((t) => t.clips.map((c) => c.id)));
  },

  /** Pose un média sur une piste (ou la première compatible) à `at` (ou la tête de lecture). */
  async insertMedia(m: MediaRef, trackId?: string | null, at?: number) {
    const s = ed();
    if (!s.doc) return;
    const open = s.doc.tracks.filter((t) => !t.locked && acceptsType(t, m.type));
    let track = trackId ? open.find((t) => t.id === trackId) : undefined;
    if (!track) {
      // Image et vidéo : V1 (la piste vidéo du bas) ; son : A1 avant les autres.
      if (m.type === 'AUDIO') track = open.find((t) => t.kind === 'AUDIO') ?? open[0];
      else track = open.filter((t) => isVisual(t.kind)).pop() ?? open[0];
    }
    if (!track) return void toast.error('Aucune piste libre n’accepte ce média.', { description: 'Ajoutez une piste ou déverrouillez-en une.' });
    s.addMedia([m]);
    const dur = await durationFor(m);
    const clip = clipFor(m, at ?? now(), dur);
    ed().commit((d) => addClip(d, track!.id, clip));
    ed().select([clip.id]);
  },

  addSubtitle(trackId?: string, at?: number) {
    const s = ed();
    if (!s.doc) return;
    let track = s.doc.tracks.find((t) => t.id === trackId && t.kind === 'SUBTITLE' && !t.locked) ?? s.doc.tracks.find((t) => t.kind === 'SUBTITLE' && !t.locked);
    let doc = s.doc;
    if (!track) {
      const r = addTrack(doc, 'SUBTITLE');
      doc = r.doc;
      track = doc.tracks.find((t) => t.id === r.id)!;
    }
    const clip = subtitleClip(at ?? now());
    s.commit(() => addClip(doc, track!.id, clip));
    s.select([clip.id]);
  },

  addTrack(kind: TrackKind) {
    ed().commit((d) => addTrack(d, kind).doc);
  },

  toggleSnap() {
    const s = ed();
    s.set({ snapping: !s.snapping });
    toast.message(s.snapping ? 'Aimantation désactivée' : 'Aimantation activée', { duration: 1200 });
  },

  zoomBy(f: number) {
    const s = ed();
    s.set({ zoom: Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, s.zoom * f)) });
  },

  fit: () => viewport.fit(),

  /** Va au bord de clip précédent / suivant (flèches haut et bas). */
  jumpEdge(dir: 1 | -1) {
    const s = ed();
    if (!s.doc) return;
    const t = now();
    const edges = [0, sequenceDuration(s.doc), ...allClips(s.doc).flatMap((c) => [c.startSec, clipEnd(c)])];
    const next = dir > 0 ? Math.min(...edges.filter((e) => e > t + 0.001)) : Math.max(...edges.filter((e) => e < t - 0.001));
    if (Number.isFinite(next)) {
      usePlayhead.getState().setPlaying(false);
      usePlayhead.getState().seek(next);
    }
  },
};
