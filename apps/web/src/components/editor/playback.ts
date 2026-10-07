'use client';

import { sequenceDuration } from '@regie/core';
import { useEffect } from 'react';
import { useEditor, usePlayhead } from './store';
import { toFrame } from './time';

/**
 * Horloge de lecture : requestAnimationFrame sur l'horloge murale. Les
 * éléments média suivent (le moniteur les recale s'ils dérivent) ; on ne
 * fait jamais dépendre le temps d'une vidéo qui peut bloquer en chargement.
 */
export function usePlaybackClock() {
  useEffect(() => {
    let raf = 0;
    let last = 0;
    const tick = (now: number) => {
      const { playing, rate, t, seek, setPlaying } = usePlayhead.getState();
      if (playing) {
        const dt = last ? (now - last) / 1000 : 0;
        const doc = useEditor.getState().doc;
        const end = doc ? sequenceDuration(doc) : 0;
        const next = t + dt * rate;
        if (next >= end && rate > 0) {
          seek(end);
          setPlaying(false);
        } else if (next <= 0 && rate < 0) {
          seek(0);
          setPlaying(false);
        } else seek(next);
      }
      last = now;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
}

export const transport = {
  toggle() {
    const p = usePlayhead.getState();
    const doc = useEditor.getState().doc;
    if (!doc) return;
    if (p.playing) return p.setPlaying(false);
    const end = sequenceDuration(doc);
    if (end <= 0) return;
    if (p.t >= end - 0.01) p.seek(0);
    p.setPlaying(true, 1);
  },
  stop() {
    const p = usePlayhead.getState();
    p.setPlaying(false);
    p.seek(toFrame(p.t, useEditor.getState().doc?.fps ?? 24));
  },
  /** J/L : chaque appui double la vitesse dans le sens demandé. */
  shuttle(dir: 1 | -1) {
    const p = usePlayhead.getState();
    const next = p.playing && Math.sign(p.rate) === dir ? Math.max(-8, Math.min(8, p.rate * 2)) : dir;
    p.setPlaying(true, next);
  },
  step(frames: number) {
    const p = usePlayhead.getState();
    const fps = useEditor.getState().doc?.fps ?? 24;
    p.setPlaying(false);
    p.seek(toFrame(p.t + frames / fps, fps));
  },
  home() {
    usePlayhead.getState().setPlaying(false);
    usePlayhead.getState().seek(0);
  },
  end() {
    const doc = useEditor.getState().doc;
    usePlayhead.getState().setPlaying(false);
    usePlayhead.getState().seek(doc ? sequenceDuration(doc) : 0);
  },
};
