'use client';

import { clipAt, isAudible, isVisual, type MediaRef, opacityAt, sequenceDuration, type Track } from '@regie/core';
import { ChevronFirst, ChevronLast, Pause, Play, StepBack, StepForward } from 'lucide-react';
import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { fileUrl } from '@/components/common/media';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { transport } from './playback';
import { type Doc, useEditor, usePlayhead } from './store';
import { timecode } from './time';

// Le moniteur de programme : la composition à la tête de lecture, calculée
// comme le rendu FFmpeg (buildRenderPlan) — pistes vidéo non masquées, V1 en
// dessous, clip actif par piste (clipAt), opacité et fondus (opacityAt),
// sous-titres des pistes visibles, son des pistes non muettes.

type Slot = { key: string; track: Track; asset: MediaRef; el: 'img' | 'video' | 'audio'; z: number };

/** Les éléments à monter : clip actif et clip suivant de chaque piste (préchargé). */
function slotsAt(doc: Doc, media: Record<string, MediaRef>, t: number): Slot[] {
  const slots: Slot[] = [];
  const visual = doc.tracks.filter((tr) => isVisual(tr.kind) && !tr.muted).sort((a, b) => b.order - a.order);
  const audible = doc.tracks.filter((tr) => isAudible(tr.kind) && !tr.muted);
  const add = (track: Track, z: number, kind: 'visual' | 'audio') => {
    const active = clipAt(track, t);
    const next = track.clips.find((c) => c.startSec > t && c !== active && c.startSec - t < 4);
    const seen = new Set<string>();
    for (const c of [active, next]) {
      const m = c?.assetId ? media[c.assetId] : null;
      if (!m || seen.has(m.id)) continue;
      seen.add(m.id);
      if (kind === 'visual' && m.type !== 'IMAGE' && m.type !== 'VIDEO') continue;
      if (kind === 'audio' && m.type !== 'AUDIO' && m.type !== 'VIDEO') continue;
      slots.push({ key: `${track.id}:${m.id}`, track, asset: m, el: kind === 'audio' ? 'audio' : m.type === 'IMAGE' ? 'img' : 'video', z });
    }
  };
  visual.forEach((tr, i) => add(tr, i + 1, 'visual'));
  audible.forEach((tr) => add(tr, 0, 'audio'));
  return slots;
}

type Entry = { el: HTMLElement; trackId: string; assetId: string };

export function Monitor() {
  const doc = useEditor((s) => s.doc);
  const media = useEditor((s) => s.media);
  const [, setSig] = useState('');
  const entries = useRef(new Map<string, Entry>());
  const box = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState({ w: 0, h: 0 });

  const W = doc?.width ?? 1920;
  const H = doc?.height ?? 1080;

  // Taille du cadre : le plus grand rectangle au format de la séquence.
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      const scale = Math.min(r.width / W, r.height / H);
      setFit({ w: Math.floor(W * scale), h: Math.floor(H * scale) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [W, H]);

  const sync = useCallback((t: number) => {
    const { doc: d } = useEditor.getState();
    const { playing, rate } = usePlayhead.getState();
    if (!d) return;
    const fps = d.fps;
    for (const { el, trackId, assetId } of entries.current.values()) {
      const track = d.tracks.find((tr) => tr.id === trackId);
      if (!track) continue;
      const clip = clipAt(track, t);
      const active = !!clip && clip.assetId === assetId;
      if (el.tagName !== 'AUDIO') el.style.opacity = active ? String(opacityAt(clip!, t)) : '0';
      if (!(el instanceof HTMLMediaElement)) continue;
      if (!active) {
        if (!el.paused) el.pause();
        // Prépare le clip suivant à son point d'entrée : pas d'attente à la coupe.
        const next = track.clips.find((c) => c.startSec > t && c.assetId === assetId);
        if (next && Math.abs(el.currentTime - next.inSec) > 0.05 && el.readyState > 0) el.currentTime = next.inSec;
        continue;
      }
      const target = clip!.inSec + (t - clip!.startSec);
      const vol = Math.max(0, Math.min(1, clip!.volume * track.volume));
      el.volume = vol;
      el.muted = vol === 0;
      if (playing && rate > 0) {
        if (el.playbackRate !== rate) el.playbackRate = rate;
        if (el.paused) {
          el.currentTime = target;
          el.play().catch(() => {});
        } else if (Math.abs(el.currentTime - target) > 0.15 * rate) el.currentTime = target;
      } else {
        if (!el.paused) el.pause();
        if (Math.abs(el.currentTime - target) > 0.5 / fps) el.currentTime = target;
      }
    }
  }, []);

  // À chaque mouvement de la tête : recalcul des éléments montés (rarement
  // différent) puis recalage impératif, sans re-rendu React.
  useEffect(() => {
    let prev = '';
    const run = (t: number) => {
      const s = useEditor.getState();
      if (!s.doc) return;
      const sig = slotsAt(s.doc, s.media, t)
        .map((x) => x.key)
        .join('|');
      if (sig !== prev) {
        prev = sig;
        setSig(sig);
      }
      sync(t);
    };
    run(usePlayhead.getState().t);
    const unsub = usePlayhead.subscribe((s, p) => {
      if (s.t !== p.t || s.playing !== p.playing || s.rate !== p.rate) run(s.t);
    });
    return unsub;
  }, [sync]);

  // Après une modification du document : l'image doit refléter l'édition.
  useEffect(() => {
    sync(usePlayhead.getState().t);
  });

  const register = useCallback((key: string, trackId: string, assetId: string) => (el: HTMLElement | null) => {
    if (el) {
      entries.current.set(key, { el, trackId, assetId });
      sync(usePlayhead.getState().t);
    } else entries.current.delete(key);
  }, [sync]);

  const slots = doc ? slotsAt(doc, media, usePlayhead.getState().t) : [];

  return (
    <div className="flex h-full min-h-0 flex-col bg-stage">
      <div ref={box} className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden p-4">
        {/* Le noir du cadre est celui du fond du rendu (color=black). */}
        <div className="relative overflow-hidden bg-black ring-1 ring-border" style={{ width: fit.w, height: fit.h }}>
          {slots.map((s) =>
            s.el === 'img' ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={s.key} ref={register(s.key, s.track.id, s.asset.id)} src={fileUrl(s.asset.id)} alt="" className="absolute inset-0 size-full object-contain" style={{ zIndex: s.z, opacity: 0 }} draggable={false} />
            ) : s.el === 'video' ? (
              <video key={s.key} ref={register(s.key, s.track.id, s.asset.id)} src={fileUrl(s.asset.id)} className="absolute inset-0 size-full object-contain" style={{ zIndex: s.z, opacity: 0 }} preload="auto" playsInline />
            ) : (
              <audio key={s.key} ref={register(s.key, s.track.id, s.asset.id)} src={fileUrl(s.asset.id)} preload="auto" />
            ),
          )}
          <Subtitles height={fit.h} />
        </div>
      </div>
      <Transport />
    </div>
  );
}

/** Sous-titres actifs, placés comme l'incrustation libass du rendu. */
const Subtitles = memo(function Subtitles({ height }: { height: number }) {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    const run = (t: number) => {
      const d = useEditor.getState().doc;
      const lines = (d?.tracks ?? [])
        .filter((tr) => tr.kind === 'SUBTITLE' && !tr.muted)
        .map((tr) => clipAt(tr, t)?.text?.trim())
        .filter(Boolean)
        .join('\n');
      setText(lines || null);
    };
    run(usePlayhead.getState().t);
    const a = usePlayhead.subscribe((s) => run(s.t));
    const b = useEditor.subscribe((s, p) => s.doc !== p.doc && run(usePlayhead.getState().t));
    return () => {
      a();
      b();
    };
  }, []);
  if (!text) return null;
  // FontSize=20 et MarginV=28 sur une hauteur de référence libass de 288.
  return (
    <div className="dark pointer-events-none absolute inset-x-0 z-50 px-[6%] text-center leading-tight whitespace-pre-line text-foreground" style={{ bottom: (height * 28) / 288, fontSize: (height * 20) / 288 / 1.45, textShadow: '0 0 2px var(--background), 0 0 2px var(--background), 0 0 1px var(--background)' }}>
      {text}
    </div>
  );
});

function Transport() {
  const fps = useEditor((s) => s.doc?.fps ?? 24);
  const duration = useEditor((s) => (s.doc ? sequenceDuration(s.doc) : 0));
  const dims = useEditor((s) => (s.doc ? `${s.doc.width}×${s.doc.height}` : ''));
  const playing = usePlayhead((s) => s.playing);
  const rate = usePlayhead((s) => s.rate);
  const tc = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const paint = (t: number) => tc.current && (tc.current.textContent = timecode(t, fps));
    paint(usePlayhead.getState().t);
    return usePlayhead.subscribe((s) => paint(s.t));
  }, [fps]);

  const btn = (label: string, keys: string, icon: React.ReactNode, onClick: () => void, primary = false) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant={primary ? 'default' : 'ghost'} size={primary ? 'icon-sm' : 'icon-sm'} onClick={onClick} aria-label={label} className={primary ? 'rounded-full' : undefined}>
          {icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {label} <span className="ml-1 text-muted-foreground">{keys}</span>
      </TooltipContent>
    </Tooltip>
  );

  return (
    <div className="grid h-12 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-4 border-t bg-background px-4">
      <div className="flex items-baseline gap-2 font-mono text-sm tabular-nums">
        <span ref={tc} className="font-medium">
          00:00:00:00
        </span>
        <span className="text-muted-foreground">/ {timecode(duration, fps)}</span>
        {playing && rate !== 1 && <span className="text-xs text-signal">{rate > 0 ? `×${rate}` : `arrière ×${-rate}`}</span>}
      </div>
      <div className="flex items-center gap-1">
        {btn('Début', 'Début', <ChevronFirst />, transport.home)}
        {btn('Image précédente', '←', <StepBack />, () => transport.step(-1))}
        {btn(playing ? 'Pause' : 'Lecture', 'Espace', playing ? <Pause /> : <Play className="translate-x-px" />, transport.toggle, true)}
        {btn('Image suivante', '→', <StepForward />, () => transport.step(1))}
        {btn('Fin', 'Fin', <ChevronLast />, transport.end)}
      </div>
      <div className="text-right text-xs text-muted-foreground tabular-nums">
        {dims} · {fps} i/s
      </div>
    </div>
  );
}
