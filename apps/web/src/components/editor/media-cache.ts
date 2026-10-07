'use client';

import { useEffect, useState } from 'react';
import { fileUrl } from '@/components/common/media';

// Ce que l'éditeur apprend des fichiers eux-mêmes : durée réelle, vignette,
// forme d'onde. Calculé une fois par asset dans le navigateur et gardé en
// mémoire ; tout est facultatif (un stockage sans CORS n'empêche pas de monter).

const durations = new Map<string, Promise<number | null>>();

/** Durée d'une vidéo ou d'un son, lue par un élément média (métadonnées seules). */
export function probeDuration(assetId: string, type: string): Promise<number | null> {
  const hit = durations.get(assetId);
  if (hit) return hit;
  const p = new Promise<number | null>((resolve) => {
    if (typeof document === 'undefined' || type === 'IMAGE') return resolve(null);
    const el = document.createElement(type === 'AUDIO' ? 'audio' : 'video');
    el.preload = 'metadata';
    const done = (v: number | null) => {
      el.removeAttribute('src');
      el.load();
      resolve(v);
    };
    el.onloadedmetadata = () => done(Number.isFinite(el.duration) ? el.duration : null);
    el.onerror = () => done(null);
    setTimeout(() => done(null), 15000);
    el.src = fileUrl(assetId);
  });
  durations.set(assetId, p);
  return p;
}

// ── Vignettes vidéo ──

const thumbs = new Map<string, Promise<string | null>>();
let running = 0;
const waiting: (() => void)[] = [];
const slot = () => new Promise<void>((r) => (running < 2 ? (running++, r()) : waiting.push(() => (running++, r()))));
const release = () => {
  running--;
  waiting.shift()?.();
};

function makeThumb(assetId: string): Promise<string | null> {
  return new Promise((resolve) => {
    const v = document.createElement('video');
    v.crossOrigin = 'anonymous';
    v.muted = true;
    v.preload = 'auto';
    const finish = (url: string | null) => {
      v.removeAttribute('src');
      v.load();
      resolve(url);
    };
    v.onloadeddata = () => {
      v.currentTime = Math.min(0.5, (v.duration || 1) / 3);
    };
    v.onseeked = () => {
      try {
        const h = 72;
        const w = Math.round((v.videoWidth / v.videoHeight) * h) || 128;
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        c.getContext('2d')!.drawImage(v, 0, 0, w, h);
        finish(c.toDataURL('image/jpeg', 0.7));
      } catch {
        finish(null);
      }
    };
    v.onerror = () => finish(null);
    setTimeout(() => finish(null), 20000);
    v.src = fileUrl(assetId);
  });
}

export function useThumb(assetId: string | null | undefined, enabled = true) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!assetId || !enabled || typeof document === 'undefined') return;
    let alive = true;
    let p = thumbs.get(assetId);
    if (!p) {
      p = slot().then(() => makeThumb(assetId).finally(release));
      thumbs.set(assetId, p);
    }
    p.then((u) => alive && setUrl(u));
    return () => {
      alive = false;
    };
  }, [assetId, enabled]);
  return url;
}

// ── Formes d'onde ──

/** Pics par seconde conservés : assez pour zoomer à l'image près sans alourdir. */
export const PEAKS_PER_SEC = 60;
const peaks = new Map<string, Promise<{ path: string; duration: number } | null>>();

async function makePeaks(assetId: string) {
  const res = await fetch(fileUrl(assetId));
  const len = Number(res.headers.get('content-length') || 0);
  if (!res.ok || len > 40 * 1024 * 1024) return null;
  const buf = await res.arrayBuffer();
  const ctx = new OfflineAudioContext(1, 1, 8000);
  const audio = await ctx.decodeAudioData(buf);
  const data = audio.getChannelData(0);
  const step = Math.max(1, Math.floor(audio.sampleRate / PEAKS_PER_SEC));
  const values: number[] = [];
  for (let i = 0; i < data.length; i += step) {
    let m = 0;
    const end = Math.min(data.length, i + step);
    for (let j = i; j < end; j++) m = Math.max(m, Math.abs(data[j]));
    values.push(m);
  }
  // Normalisée sur le pic du fichier : un son enregistré bas reste lisible.
  const gain = 0.95 / values.reduce((a, v) => Math.max(a, v), 0.05);
  // Chemin SVG en unités « pic » (x) et amplitude ±1 (y), fermé en miroir.
  const top = values.map((v, x) => `${x} ${(-v * gain).toFixed(3)}`);
  const bottom = values.map((v, x) => `${x} ${(v * gain).toFixed(3)}`);
  const path = `M0 0L${top.join('L')}L${bottom.reverse().join('L')}Z`;
  return { path, duration: audio.duration };
}

export function usePeaks(assetId: string | null | undefined, enabled = true) {
  const [value, setValue] = useState<{ path: string; duration: number } | null>(null);
  useEffect(() => {
    if (!assetId || !enabled || typeof window === 'undefined') return;
    let alive = true;
    let p = peaks.get(assetId);
    if (!p) {
      p = slot().then(() => makePeaks(assetId).catch(() => null).finally(release));
      peaks.set(assetId, p);
    }
    p.then((v) => alive && setValue(v));
    return () => {
      alive = false;
    };
  }, [assetId, enabled]);
  return value;
}
