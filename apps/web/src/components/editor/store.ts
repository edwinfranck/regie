'use client';

import type { Clip, MediaRef, Track } from '@regie/core';
import { create } from 'zustand';

// L'état de l'éditeur. Le document (la séquence) est immuable : chaque
// modification produit un nouvel objet, ce qui donne l'historique
// (annuler/rétablir) gratuitement et permet aux pistes intactes de ne pas
// se redessiner. La tête de lecture vit dans son propre store : elle bouge
// soixante fois par seconde et ne doit réveiller que ceux qui l'écoutent.

export interface Doc {
  name: string;
  fps: number;
  aspectRatio: string | null;
  width: number;
  height: number;
  /** Triées par `order` (du haut vers le bas de la timeline). */
  tracks: Track[];
}

export type SaveState = 'saved' | 'dirty' | 'saving' | 'error';

const HISTORY = 100;

interface EditorState {
  timelineId: string | null;
  doc: Doc | null;
  /** Incrémenté à chaque changement du document (déclenche l'autosave). */
  rev: number;
  past: Doc[];
  future: Doc[];
  /** Base d'une transaction en cours (glisser un clip) : un seul pas d'historique. */
  txBase: Doc | null;
  coalesce: { key: string; at: number } | null;
  selection: string[];
  media: Record<string, MediaRef>;
  /** Durées lues dans le navigateur quand la base ne les connaît pas. */
  durations: Record<string, number>;
  zoom: number;
  snapping: boolean;
  showBin: boolean;
  showInspector: boolean;
  save: SaveState;

  load: (timelineId: string, doc: Doc, media: MediaRef[]) => void;
  commit: (fn: (d: Doc) => Doc, opts?: { coalesce?: string }) => void;
  /** Remplace le document en gardant l'état précédent dans l'historique. */
  replace: (doc: Doc) => void;
  begin: () => void;
  preview: (fn: (d: Doc) => Doc) => void;
  end: () => void;
  undo: () => void;
  redo: () => void;
  select: (ids: string[]) => void;
  addMedia: (m: MediaRef[]) => void;
  setDuration: (assetId: string, d: number) => void;
  set: (p: Partial<Pick<EditorState, 'zoom' | 'snapping' | 'showBin' | 'showInspector' | 'save'>>) => void;
}

export const useEditor = create<EditorState>((set, get) => ({
  timelineId: null,
  doc: null,
  rev: 0,
  past: [],
  future: [],
  txBase: null,
  coalesce: null,
  selection: [],
  media: {},
  durations: {},
  zoom: 40,
  snapping: true,
  showBin: true,
  showInspector: true,
  save: 'saved',

  load: (timelineId, doc, media) => set({ timelineId, doc, rev: 0, past: [], future: [], txBase: null, coalesce: null, selection: [], media: Object.fromEntries(media.map((m) => [m.id, m])), save: 'saved' }),

  commit: (fn, opts) => {
    const { doc, past, rev, coalesce, txBase } = get();
    if (!doc || txBase) return;
    const next = fn(doc);
    if (next === doc) return;
    const now = Date.now();
    // Les frappes successives dans un même champ ne font qu'un pas d'historique.
    const merge = opts?.coalesce && coalesce?.key === opts.coalesce && now - coalesce.at < 1500;
    set({
      doc: next,
      rev: rev + 1,
      past: merge ? past : [...past, doc].slice(-HISTORY),
      future: [],
      coalesce: opts?.coalesce ? { key: opts.coalesce, at: now } : null,
    });
  },

  replace: (next) => {
    const { doc, past, rev } = get();
    set({ doc: next, rev: rev + 1, past: doc ? [...past, doc].slice(-HISTORY) : past, future: [], coalesce: null, selection: [] });
  },

  begin: () => set({ txBase: get().doc, coalesce: null }),
  preview: (fn) => {
    const { txBase, doc } = get();
    if (!txBase || !doc) return;
    set({ doc: fn(txBase) });
  },
  end: () => {
    const { txBase, doc, past, rev } = get();
    if (!txBase) return;
    if (doc === txBase) return set({ txBase: null });
    set({ txBase: null, past: [...past, txBase].slice(-HISTORY), future: [], rev: rev + 1 });
  },

  undo: () => {
    const { past, future, doc, rev, txBase } = get();
    if (!past.length || !doc || txBase) return;
    set({ doc: past[past.length - 1], past: past.slice(0, -1), future: [doc, ...future].slice(0, HISTORY), rev: rev + 1, coalesce: null });
  },
  redo: () => {
    const { past, future, doc, rev, txBase } = get();
    if (!future.length || !doc || txBase) return;
    set({ doc: future[0], future: future.slice(1), past: [...past, doc].slice(-HISTORY), rev: rev + 1, coalesce: null });
  },

  select: (ids) => set({ selection: ids }),
  addMedia: (list) => set({ media: { ...get().media, ...Object.fromEntries(list.map((m) => [m.id, m])) } }),
  setDuration: (assetId, d) => {
    if (get().durations[assetId] === d) return;
    set({ durations: { ...get().durations, [assetId]: d } });
  },
  set: (p) => set(p),
}));

/** Durée connue d'un média (base, sinon lue dans le navigateur). */
export function mediaDuration(assetId: string | null | undefined): number | null {
  if (!assetId) return null;
  const s = useEditor.getState();
  return s.media[assetId]?.durationSec || s.durations[assetId] || null;
}

// ── Tête de lecture ──

interface PlayheadState {
  t: number;
  playing: boolean;
  /** Vitesse de lecture (J/K/L) : négative = arrière. */
  rate: number;
  seek: (t: number) => void;
  setPlaying: (playing: boolean, rate?: number) => void;
}

export const usePlayhead = create<PlayheadState>((set) => ({
  t: 0,
  playing: false,
  rate: 1,
  seek: (t) => set({ t: Math.max(0, t) }),
  setPlaying: (playing, rate = 1) => set({ playing, rate }),
}));

// ── Guides éphémères (aimantation, sélection au lasso) ──

export const useGuides = create<{ snapAt: number | null; set: (snapAt: number | null) => void }>((set) => ({ snapAt: null, set: (snapAt) => set({ snapAt }) }));

export const allClips = (d: Doc) => d.tracks.flatMap((t) => t.clips);
export const findClip = (d: Doc, id: string): { clip: Clip; track: Track } | null => {
  for (const track of d.tracks) {
    const clip = track.clips.find((c) => c.id === id);
    if (clip) return { clip, track };
  }
  return null;
};
