'use client';

import { type Clip, clipDuration, clipEnd, isAudible, isVisual, type MediaRef, sequenceDuration, snap, type Track, TRACK_KINDS, type TrackKind } from '@regie/core';
import { Captions, Copy, Eye, EyeOff, Film, Lock, LockOpen, Magnet, Maximize2, Minus, MoreHorizontal, Music, Plus, Redo2, Scissors, Trash2, Undo2, Volume2, VolumeX, Wand2 } from 'lucide-react';
import { createContext, memo, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { fileUrl } from '@/components/common/media';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Slider } from '@/components/ui/slider';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { actions, ASSET_MIME, dragState, IMAGE_SEC, viewport, ZOOM_MAX, ZOOM_MIN } from './actions';
import { PEAKS_PER_SEC, usePeaks, useThumb } from './media-cache';
import { accepts, acceptsType, moveClips, removeTrack, snapPoints, trim, updateTrack } from './ops';
import { findClip, mediaDuration, useEditor, useGuides, usePlayhead } from './store';
import { timecode, toFrame } from './time';

// La timeline : règle, pistes, clips. Les pistes et les clips sont mémoïsés
// (le document est immuable : seule la piste modifiée se redessine) ; la tête
// de lecture est peinte directement dans le DOM, hors de React.

const HEADER_W = 208;
const RULER_H = 30;
const heightOf = (kind: string) => (isVisual(kind) ? 56 : kind === 'SUBTITLE' ? 36 : 50);

type Tone = { bg: string; border: string; strip: string; wave: string };
const TONES: Record<string, Tone> = {
  video: { bg: 'bg-chart-1/15', border: 'border-chart-1/70', strip: 'bg-chart-1/85 text-background', wave: 'fill-chart-1/60' },
  image: { bg: 'bg-chart-4/15', border: 'border-chart-4/70', strip: 'bg-chart-4/85 text-background', wave: 'fill-chart-4/60' },
  audio: { bg: 'bg-chart-3/15', border: 'border-chart-3/70', strip: 'bg-chart-3/85 text-background', wave: 'fill-chart-3/70' },
  music: { bg: 'bg-chart-5/15', border: 'border-chart-5/70', strip: 'bg-chart-5/85 text-background', wave: 'fill-chart-5/70' },
  sfx: { bg: 'bg-chart-2/15', border: 'border-chart-2/70', strip: 'bg-chart-2/85 text-background', wave: 'fill-chart-2/70' },
  text: { bg: 'bg-foreground/[0.06]', border: 'border-foreground/40', strip: 'bg-foreground/80 text-background', wave: 'fill-foreground/40' },
  missing: { bg: 'bg-destructive/10', border: 'border-destructive/60', strip: 'bg-destructive/80 text-background', wave: 'fill-destructive/40' },
};
function toneOf(kind: string, media?: MediaRef | null, hasAsset?: boolean): Tone {
  if (kind === 'SUBTITLE') return TONES.text;
  if (hasAsset && !media) return TONES.missing;
  if (isVisual(kind)) return media?.type === 'IMAGE' ? TONES.image : TONES.video;
  if (kind === 'MUSIC') return TONES.music;
  if (kind === 'SFX') return TONES.sfx;
  return TONES.audio;
}

const KIND_ICON: Record<string, React.ComponentType<{ className?: string }>> = { VIDEO: Film, SUBTITLE: Captions, AUDIO: Volume2, DIALOGUE: Volume2, MUSIC: Music, SFX: Volume2 };

// ── Contrôleur : gestes souris partagés par toutes les pistes ──

interface Ctl {
  clipDown: (e: React.PointerEvent, clipId: string, trackId: string, edge: 'start' | 'end' | null) => void;
  laneDown: (e: React.PointerEvent) => void;
  laneDouble: (e: React.MouseEvent, track: Track) => void;
  laneDragOver: (e: React.DragEvent, track: Track) => void;
  laneDrop: (e: React.DragEvent, track: Track) => void;
}
const CtlContext = createContext<Ctl | null>(null);

export function Timeline({ onAssemble }: { onAssemble: () => void }) {
  const tracks = useEditor((s) => s.doc?.tracks);
  const zoom = useEditor((s) => s.zoom);
  const duration = useEditor((s) => (s.doc ? sequenceDuration(s.doc) : 0));
  const empty = useEditor((s) => !!s.doc && s.doc.tracks.every((t) => !t.clips.length));
  const scroll = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const ghost = useRef<HTMLDivElement>(null);
  const marquee = useRef<HTMLDivElement>(null);
  const [vw, setVw] = useState(1000);
  const anchor = useRef<{ t: number; x: number } | null>(null);

  useLayoutEffect(() => {
    const el = scroll.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setVw(el.clientWidth - HEADER_W);
      viewport.width = el.clientWidth - HEADER_W;
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  viewport.fit = () => {
    const d = useEditor.getState().doc;
    const len = d ? sequenceDuration(d) : 0;
    const z = len > 0 ? (viewport.width - 40) / len : 40;
    useEditor.getState().set({ zoom: Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z)) });
    if (scroll.current) scroll.current.scrollLeft = 0;
  };

  // Ctrl + molette : zoom centré sur la souris.
  useEffect(() => {
    const el = scroll.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const s = useEditor.getState();
      const x = e.clientX - el.getBoundingClientRect().left - HEADER_W;
      anchor.current = { t: (el.scrollLeft + x) / s.zoom, x };
      s.set({ zoom: Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, s.zoom * (e.deltaY < 0 ? 1.18 : 1 / 1.18))) });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  useLayoutEffect(() => {
    const el = scroll.current;
    if (!el) return;
    if (anchor.current) {
      el.scrollLeft = anchor.current.t * zoom - anchor.current.x;
      anchor.current = null;
    } else {
      // Zoom au clavier ou au curseur : on garde la tête de lecture en vue.
      const x = usePlayhead.getState().t * zoom;
      if (x < el.scrollLeft || x > el.scrollLeft + el.clientWidth - HEADER_W) el.scrollLeft = Math.max(0, x - (el.clientWidth - HEADER_W) / 2);
    }
  }, [zoom]);

  const contentW = Math.max(duration + 30, (vw - 20) / zoom) * zoom;

  const ctl = useMemo<Ctl>(() => {
    const timeAt = (clientX: number) => {
      const r = content.current!.getBoundingClientRect();
      return Math.max(0, (clientX - r.left - HEADER_W) / useEditor.getState().zoom);
    };
    let ghostTimer: ReturnType<typeof setTimeout> | undefined;
    const hideGhost = () => ghost.current && (ghost.current.style.display = 'none');

    return {
      clipDown(e, clipId, trackId, edge) {
        if (e.button !== 0) return;
        e.stopPropagation();
        const st = useEditor.getState();
        const d = st.doc;
        if (!d) return;
        const track = d.tracks.find((t) => t.id === trackId);
        if (!track || track.locked) return;
        const additive = e.shiftKey || e.metaKey || e.ctrlKey;
        const was = st.selection.includes(clipId);
        let sel = st.selection;
        if (additive) {
          sel = was ? sel.filter((x) => x !== clipId) : [...sel, clipId];
          st.select(sel);
          if (was) return;
        } else if (!was) {
          sel = [clipId];
          st.select(sel);
        }
        const clip = findClip(d, clipId)!.clip;
        const locked = new Set(d.tracks.filter((t) => t.locked).flatMap((t) => t.clips.map((c) => c.id)));
        const ids = edge ? [clipId] : sel.filter((id) => !locked.has(id));
        const zoom = st.zoom;
        const media = clip.assetId ? st.media[clip.assetId] : null;
        const maxOut = mediaDuration(clip.assetId);
        const pts = snapPoints(d, new Set(ids), usePlayhead.getState().t);
        const th = 8 / zoom;
        const minStart = Math.min(...ids.map((id) => findClip(d, id)?.clip.startSec ?? 0));
        const x0 = e.clientX;
        const y0 = e.clientY;
        let moved = false;
        st.begin();
        document.body.style.cursor = edge ? 'ew-resize' : 'grabbing';

        const onMove = (ev: PointerEvent) => {
          if (!moved && Math.abs(ev.clientX - x0) < 3 && Math.abs(ev.clientY - y0) < 4) return;
          moved = true;
          // Alt inverse l'aimantation le temps du geste.
          const snapOn = useEditor.getState().snapping !== ev.altKey;
          let dt = (ev.clientX - x0) / zoom;
          let guide: number | null = null;
          if (edge) {
            let to = (edge === 'start' ? clip.startSec : clipEnd(clip)) + dt;
            if (snapOn) {
              const s = snap(to, pts, th);
              if (s !== to) guide = to = s;
            }
            useEditor.getState().preview((doc) => trim(doc, clipId, edge, to, media, maxOut));
          } else {
            dt = Math.max(dt, -minStart);
            if (snapOn) {
              const dur = clipDuration(clip);
              const s = clip.startSec + dt;
              const ds = snap(s, pts, th) - s;
              const de = snap(s + dur, pts, th) - (s + dur);
              if (ds !== 0 && (de === 0 || Math.abs(ds) <= Math.abs(de))) {
                dt += ds;
                guide = s + ds;
              } else if (de !== 0) {
                dt += de;
                guide = s + dur + de;
              }
              dt = Math.max(dt, -minStart);
            }
            let to: string | null = null;
            if (ids.length === 1) {
              const lane = (document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null)?.closest<HTMLElement>('[data-track-lane]');
              const tid = lane?.dataset.trackLane;
              const target = tid && tid !== trackId ? d.tracks.find((t) => t.id === tid) : null;
              if (target && !target.locked && accepts(target, clip, media)) to = target.id;
            }
            useEditor.getState().preview((doc) => moveClips(doc, ids, dt, to));
          }
          useGuides.getState().set(guide);
        };
        const onUp = () => {
          window.removeEventListener('pointermove', onMove);
          window.removeEventListener('pointerup', onUp);
          document.body.style.cursor = '';
          useGuides.getState().set(null);
          useEditor.getState().end();
          if (!moved && !additive && was && sel.length > 1) useEditor.getState().select([clipId]);
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
      },

      // Zone vide : clic = tête de lecture ici et désélection ; glisser = lasso.
      laneDown(e) {
        if (e.button !== 0 || (e.target as HTMLElement).closest('[data-clip-id]')) return;
        const root = content.current!;
        const box = marquee.current!;
        const base = e.shiftKey ? useEditor.getState().selection : [];
        const x0 = e.clientX;
        const y0 = e.clientY;
        const r0 = root.getBoundingClientRect();
        const start = { x: x0 - r0.left, y: y0 - r0.top };
        let moved = false;
        const onMove = (ev: PointerEvent) => {
          if (!moved && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 4) return;
          moved = true;
          const r = root.getBoundingClientRect();
          const cur = { x: ev.clientX - r.left, y: ev.clientY - r.top };
          const left = Math.max(HEADER_W, Math.min(start.x, cur.x));
          const top = Math.min(start.y, cur.y);
          Object.assign(box.style, { display: 'block', left: `${left}px`, top: `${top}px`, width: `${Math.abs(cur.x - start.x)}px`, height: `${Math.abs(cur.y - start.y)}px` });
          const sel = box.getBoundingClientRect();
          const hit: string[] = [];
          root.querySelectorAll<HTMLElement>('[data-clip-id]').forEach((el) => {
            if (el.dataset.locked) return;
            const c = el.getBoundingClientRect();
            if (c.right > sel.left && c.left < sel.right && c.bottom > sel.top && c.top < sel.bottom) hit.push(el.dataset.clipId!);
          });
          useEditor.getState().select([...new Set([...base, ...hit])]);
        };
        const onUp = (ev: PointerEvent) => {
          window.removeEventListener('pointermove', onMove);
          window.removeEventListener('pointerup', onUp);
          box.style.display = 'none';
          if (!moved) {
            useEditor.getState().select(base);
            const fps = useEditor.getState().doc?.fps ?? 24;
            usePlayhead.getState().setPlaying(false);
            usePlayhead.getState().seek(toFrame(timeAt(ev.clientX), fps));
          }
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
      },

      laneDouble(e, track) {
        if ((e.target as HTMLElement).closest('[data-clip-id]') || track.kind !== 'SUBTITLE' || track.locked) return;
        actions.addSubtitle(track.id, toFrame(timeAt(e.clientX), useEditor.getState().doc?.fps ?? 24));
      },

      laneDragOver(e, track) {
        const a = dragState.asset;
        if (!a || track.locked || !acceptsType(track, a.type)) {
          e.dataTransfer.dropEffect = 'none';
          return;
        }
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        const st = useEditor.getState();
        const dur = a.type === 'IMAGE' ? IMAGE_SEC : (mediaDuration(a.id) ?? 5);
        let at = timeAt(e.clientX);
        if (st.snapping && st.doc) at = snap(at, snapPoints(st.doc, new Set(), usePlayhead.getState().t), 8 / st.zoom);
        const lane = e.currentTarget as HTMLElement;
        const g = ghost.current!;
        Object.assign(g.style, { display: 'block', top: `${lane.parentElement!.offsetTop + 4}px`, height: `${lane.offsetHeight - 9}px`, left: `${HEADER_W + at * st.zoom}px`, width: `${Math.max(4, dur * st.zoom)}px` });
        clearTimeout(ghostTimer);
        ghostTimer = setTimeout(hideGhost, 120);
      },

      laneDrop(e, track) {
        e.preventDefault();
        hideGhost();
        const raw = e.dataTransfer.getData(ASSET_MIME);
        const a: MediaRef | null = dragState.asset ?? (raw ? JSON.parse(raw) : null);
        dragState.asset = null;
        if (!a || track.locked || !acceptsType(track, a.type)) return;
        const st = useEditor.getState();
        let at = timeAt(e.clientX);
        if (st.snapping && st.doc) at = snap(at, snapPoints(st.doc, new Set(), usePlayhead.getState().t), 8 / st.zoom);
        void actions.insertMedia(a, track.id, toFrame(at, st.doc?.fps ?? 24));
      },
    };
  }, []);

  return (
    <CtlContext.Provider value={ctl}>
      <div className="flex h-full min-h-0 flex-col bg-background select-none">
        <Toolbar />
        <div ref={scroll} className="relative min-h-0 flex-1 overflow-auto overscroll-contain">
          <div ref={content} className="relative min-h-full" style={{ width: HEADER_W + contentW }}>
            <Ruler scroll={scroll} width={contentW} />
            {tracks?.map((t) => <TrackRow key={t.id} track={t} zoom={zoom} width={contentW} />)}
            <div className="h-10" />
            <PlayheadLine scroll={scroll} zoom={zoom} />
            <SnapGuide zoom={zoom} />
            <div ref={ghost} className="pointer-events-none absolute z-20 hidden rounded-[3px] border-2 border-dashed border-signal bg-signal/10" />
            <div ref={marquee} className="pointer-events-none absolute z-30 hidden border border-signal bg-signal/10" />
          </div>
          {empty && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center" style={{ paddingLeft: HEADER_W }}>
              <div className="pointer-events-auto flex max-w-md flex-col items-center gap-3 rounded-md border bg-background/95 px-6 py-5 text-center shadow-sm">
                <p className="font-medium">La séquence est vide</p>
                <p className="text-sm text-muted-foreground">Assemblez-la depuis le découpage (un clip par plan, dans l’ordre) ou glissez des médias du chutier sur les pistes.</p>
                <Button size="sm" onClick={onAssemble}>
                  <Wand2 /> Assembler depuis le découpage
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </CtlContext.Provider>
  );
}

// ── Barre d'outils ──

function Toolbar() {
  const zoom = useEditor((s) => s.zoom);
  const snapping = useEditor((s) => s.snapping);
  const canUndo = useEditor((s) => s.past.length > 0);
  const canRedo = useEditor((s) => s.future.length > 0);
  const hasSel = useEditor((s) => s.selection.length > 0);
  const tool = (label: string, keys: string, icon: React.ReactNode, onClick: () => void, opts: { disabled?: boolean; active?: boolean } = {}) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon-sm" onClick={onClick} disabled={opts.disabled} aria-label={label} aria-pressed={opts.active} className={cn(opts.active && 'bg-accent text-signal')}>
          {icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {label} {keys && <span className="ml-1 text-muted-foreground">{keys}</span>}
      </TooltipContent>
    </Tooltip>
  );
  // Curseur logarithmique : même course pour passer de 2 à 20 que de 48 à 480 px/s.
  const toSlider = (z: number) => (Math.log(z / ZOOM_MIN) / Math.log(ZOOM_MAX / ZOOM_MIN)) * 100;
  const fromSlider = (v: number) => ZOOM_MIN * (ZOOM_MAX / ZOOM_MIN) ** (v / 100);
  return (
    <div className="flex h-10 shrink-0 items-center gap-1 border-b px-2">
      {tool('Annuler', 'Ctrl+Z', <Undo2 />, actions.undo, { disabled: !canUndo })}
      {tool('Rétablir', 'Ctrl+Maj+Z', <Redo2 />, actions.redo, { disabled: !canRedo })}
      <div className="mx-1 h-5 w-px bg-border" />
      {tool('Couper à la tête de lecture', 'S', <Scissors />, actions.split)}
      {tool('Dupliquer', 'Ctrl+D', <Copy />, actions.duplicate, { disabled: !hasSel })}
      {tool('Supprimer', 'Suppr', <Trash2 />, actions.remove, { disabled: !hasSel })}
      <div className="mx-1 h-5 w-px bg-border" />
      {tool(snapping ? 'Aimantation activée' : 'Aimantation désactivée', 'N', <Magnet />, actions.toggleSnap, { active: snapping })}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="ml-1 text-muted-foreground">
            <Plus /> Piste
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onSelect={() => actions.addTrack('VIDEO')}>Piste vidéo</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => actions.addTrack('AUDIO')}>Piste audio</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => actions.addTrack('MUSIC')}>Piste musique</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => actions.addTrack('SFX')}>Piste effets</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => actions.addTrack('DIALOGUE')}>Piste dialogue</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => actions.addTrack('SUBTITLE')}>Piste de sous-titres</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <div className="flex-1" />
      {tool('Dézoomer', '−', <Minus />, () => actions.zoomBy(1 / 1.4))}
      <Slider className="w-32" min={0} max={100} step={0.5} value={[toSlider(zoom)]} onValueChange={([v]) => useEditor.getState().set({ zoom: fromSlider(v) })} aria-label="Zoom de la timeline" />
      {tool('Zoomer', '+', <Plus />, () => actions.zoomBy(1.4))}
      {tool('Ajuster la timeline', 'Maj+Z', <Maximize2 />, actions.fit)}
    </div>
  );
}

// ── Règle ──

const STEPS = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 1800];

function Ruler({ scroll, width }: { scroll: React.RefObject<HTMLDivElement | null>; width: number }) {
  const zoom = useEditor((s) => s.zoom);
  const fps = useEditor((s) => s.doc?.fps ?? 24);
  const [view, setView] = useState({ left: 0, width: 1600 });
  const handle = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scroll.current;
    if (!el) return;
    let raf = 0;
    const on = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setView({ left: el.scrollLeft, width: el.clientWidth }));
    };
    on();
    el.addEventListener('scroll', on, { passive: true });
    const ro = new ResizeObserver(on);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', on);
      ro.disconnect();
    };
  }, [scroll]);

  useEffect(() => {
    const paint = (t: number) => handle.current && (handle.current.style.transform = `translateX(${HEADER_W + t * zoom}px)`);
    paint(usePlayhead.getState().t);
    return usePlayhead.subscribe((s) => paint(s.t));
  }, [zoom]);

  // Graduation : un repère principal tous les ~90 px, en images si l'on zoome fort.
  const frameStep = zoom >= 90 ? [1, 2, 5, 10].find((f) => (f / fps) * zoom >= 90) : undefined;
  const major = frameStep ? frameStep / fps : (STEPS.find((s) => s * zoom >= 90) ?? 3600);
  const div = frameStep ? Math.min(frameStep, 5) : major * zoom >= 150 ? 10 : 5;
  const minor = major / div;
  const first = Math.max(0, Math.floor((view.left - HEADER_W) / zoom / major));
  const t1 = (view.left + view.width) / zoom;
  const ticks: { t: number; major: boolean }[] = [];
  for (let i = 0; i < 2000; i++) {
    const t = first * major + i * minor;
    if (t > t1 + major) break;
    ticks.push({ t, major: i % div === 0 });
  }
  const label = (t: number) => {
    const tc = timecode(t, fps);
    return major < 1 ? tc.slice(3) : tc.slice(0, 2) === '00' ? tc.slice(3, 8) : tc.slice(0, 8);
  };

  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const el = e.currentTarget;
    const seekAt = (x: number) => {
      const r = el.getBoundingClientRect();
      const { doc, zoom: z } = useEditor.getState();
      usePlayhead.getState().seek(toFrame(Math.max(0, (x - r.left) / z), doc?.fps ?? 24));
    };
    usePlayhead.getState().setPlaying(false);
    seekAt(e.clientX);
    el.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => seekAt(ev.clientX);
    const up = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
  };

  return (
    <div className="sticky top-0 z-30 flex border-b bg-background" style={{ height: RULER_H, width: HEADER_W + width }}>
      <div className="sticky left-0 z-10 flex shrink-0 items-center border-r bg-background px-3 text-xs text-muted-foreground" style={{ width: HEADER_W }}>
        <RulerTimecode />
      </div>
      <div className="relative flex-1 cursor-text overflow-hidden" onPointerDown={onDown} title="Cliquer ou glisser pour déplacer la tête de lecture">
        {ticks.map(({ t, major: m }) => (
          <div key={t.toFixed(4)} className="absolute bottom-0" style={{ left: t * zoom }}>
            <div className={cn('w-px', m ? 'h-3 bg-foreground/50' : 'h-1.5 bg-foreground/25')} />
            {m && <span className="absolute bottom-3 left-1 font-mono text-[10px] whitespace-nowrap text-muted-foreground tabular-nums">{label(t)}</span>}
          </div>
        ))}
      </div>
      <div ref={handle} className="pointer-events-none absolute top-0 left-0 z-[5] h-full">
        <div className="absolute top-0 -left-[6px] h-[14px] w-[13px] bg-signal [clip-path:polygon(0_0,100%_0,100%_60%,50%_100%,0_60%)]" />
      </div>
    </div>
  );
}

function RulerTimecode() {
  const fps = useEditor((s) => s.doc?.fps ?? 24);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const paint = (t: number) => ref.current && (ref.current.textContent = timecode(t, fps));
    paint(usePlayhead.getState().t);
    return usePlayhead.subscribe((s) => paint(s.t));
  }, [fps]);
  return <span ref={ref} className="font-mono text-[13px] font-medium text-signal tabular-nums" />;
}

// ── Tête de lecture et guide d'aimantation ──

function PlayheadLine({ scroll, zoom }: { scroll: React.RefObject<HTMLDivElement | null>; zoom: number }) {
  const line = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const paint = (t: number, playing: boolean) => {
      const x = t * zoom;
      if (line.current) line.current.style.transform = `translateX(${HEADER_W + x}px)`;
      // Pendant la lecture, la vue suit la tête page par page.
      const el = scroll.current;
      if (playing && el) {
        const visible = el.clientWidth - HEADER_W;
        if (x > el.scrollLeft + visible - 24 || x < el.scrollLeft) el.scrollLeft = Math.max(0, x - 40);
      }
    };
    paint(usePlayhead.getState().t, false);
    return usePlayhead.subscribe((s) => paint(s.t, s.playing));
  }, [zoom, scroll]);
  return <div ref={line} className="pointer-events-none absolute top-0 bottom-0 left-0 z-[15] w-px bg-signal" />;
}

function SnapGuide({ zoom }: { zoom: number }) {
  const at = useGuides((s) => s.snapAt);
  if (at === null) return null;
  return <div className="pointer-events-none absolute top-0 bottom-0 z-[16] w-px bg-foreground" style={{ left: HEADER_W + at * zoom }} />;
}

// ── Pistes ──

const TrackRow = memo(function TrackRow({ track, zoom, width }: { track: Track; zoom: number; width: number }) {
  const ctl = useContext(CtlContext)!;
  const h = heightOf(track.kind);
  return (
    <div className="flex" style={{ height: h }}>
      <TrackHeader track={track} height={h} />
      <div
        data-track-lane={track.id}
        className={cn('relative border-b', track.locked ? 'bg-muted/60' : isVisual(track.kind) ? 'bg-muted/30' : 'bg-background')}
        style={{ width, height: h }}
        onPointerDown={ctl.laneDown}
        onDoubleClick={(e) => ctl.laneDouble(e, track)}
        onDragOver={(e) => ctl.laneDragOver(e, track)}
        onDrop={(e) => ctl.laneDrop(e, track)}
      >
        {track.clips.map((c) => (
          <ClipView key={c.id} clip={c} trackId={track.id} kind={track.kind} zoom={zoom} locked={track.locked} muted={track.muted} />
        ))}
      </div>
    </div>
  );
});

const TrackHeader = memo(function TrackHeader({ track, height }: { track: Track; height: number }) {
  const [editing, setEditing] = useState(false);
  const Icon = KIND_ICON[track.kind] ?? Film;
  const commit = (patch: Partial<Track>, key?: string) => useEditor.getState().commit((d) => updateTrack(d, track.id, patch), key ? { coalesce: key } : undefined);
  const audible = isAudible(track.kind);
  const hideLabel = isVisual(track.kind) || track.kind === 'SUBTITLE';
  const iconBtn = (label: string, on: boolean, icon: React.ReactNode, onClick: () => void) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" onClick={onClick} aria-label={label} aria-pressed={on} className={cn('flex size-6 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground [&_svg]:size-3.5', on && 'text-signal hover:text-signal')}>
          {icon}
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
  return (
    <div className="sticky left-0 z-20 flex shrink-0 flex-col justify-center gap-1 border-r border-b bg-background px-2.5" style={{ width: HEADER_W, height }}>
      <div className="flex items-center gap-1.5">
        <Icon className="size-3.5 shrink-0 text-muted-foreground" />
        {editing ? (
          <input
            autoFocus
            defaultValue={track.name}
            maxLength={60}
            className="h-6 min-w-0 flex-1 rounded-sm border bg-background px-1 text-sm outline-none"
            onBlur={(e) => {
              setEditing(false);
              if (e.target.value.trim() && e.target.value.trim() !== track.name) commit({ name: e.target.value.trim() });
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              if (e.key === 'Escape') setEditing(false);
            }}
          />
        ) : (
          <button type="button" className="min-w-0 flex-1 truncate text-left text-sm font-medium" onDoubleClick={() => setEditing(true)} title={`${TRACK_KINDS[track.kind as TrackKind]?.label ?? track.kind} — double-clic pour renommer`}>
            {track.name}
          </button>
        )}
        <div className="flex items-center">
          {iconBtn(hideLabel ? (track.muted ? 'Afficher la piste' : 'Masquer la piste') : track.muted ? 'Rétablir le son' : 'Couper le son', track.muted, hideLabel ? track.muted ? <EyeOff /> : <Eye /> : track.muted ? <VolumeX /> : <Volume2 />, () => commit({ muted: !track.muted }))}
          {iconBtn(track.locked ? 'Déverrouiller' : 'Verrouiller', track.locked, track.locked ? <Lock /> : <LockOpen />, () => commit({ locked: !track.locked }))}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" aria-label="Options de la piste" className="flex size-6 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground">
                <MoreHorizontal className="size-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onSelect={() => setEditing(true)}>Renommer</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => {
                  useEditor.getState().commit((d) => removeTrack(d, track.id));
                  toast.message(`Piste ${track.name} supprimée`, { description: 'Ctrl+Z pour annuler.', action: { label: 'Annuler', onClick: actions.undo } });
                }}
              >
                <Trash2 /> Supprimer la piste
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {audible && (
        <div className="flex items-center gap-2 pl-5">
          <Slider min={0} max={2} step={0.01} value={[track.volume]} onValueChange={([v]) => commit({ volume: v }, `tv:${track.id}`)} className="flex-1 [&_[data-slot=slider-thumb]]:size-3" aria-label={`Volume de ${track.name}`} />
          <span className="w-9 text-right text-[11px] text-muted-foreground tabular-nums">{Math.round(track.volume * 100)} %</span>
        </div>
      )}
    </div>
  );
});

// ── Clips ──

const ClipView = memo(function ClipView({ clip, trackId, kind, zoom, locked, muted }: { clip: Clip; trackId: string; kind: string; zoom: number; locked: boolean; muted: boolean }) {
  const ctl = useContext(CtlContext)!;
  const selected = useEditor((s) => s.selection.includes(clip.id));
  const media = useEditor((s) => (clip.assetId ? s.media[clip.assetId] : null));
  const tone = toneOf(kind, media, !!clip.assetId);
  const dur = clipDuration(clip);
  const w = Math.max(3, dur * zoom);
  const wide = w > 24;
  const visual = isVisual(kind);
  const thumb = useThumb(clip.assetId, visual && media?.type === 'VIDEO' && w > 40);
  const peaks = usePeaks(clip.assetId, !visual && kind !== 'SUBTITLE' && !!media && w > 30);
  const label = kind === 'SUBTITLE' ? clip.text || 'Sous-titre' : clip.name || media?.name || 'Clip';
  const bg = visual ? (media?.type === 'IMAGE' ? `url(${fileUrl(media.id)})` : thumb ? `url(${thumb})` : undefined) : undefined;

  return (
    <div
      data-clip-id={clip.id}
      data-locked={locked ? '1' : undefined}
      className={cn('group absolute top-1 bottom-1 overflow-hidden rounded-[3px] border', tone.bg, tone.border, locked ? 'pointer-events-none opacity-60' : 'cursor-grab', muted && 'opacity-45', selected && 'z-[2] border-signal ring-2 ring-signal')}
      style={{ left: clip.startSec * zoom, width: w }}
      onPointerDown={(e) => ctl.clipDown(e, clip.id, trackId, null)}
      title={`${label} — ${dur.toFixed(2).replace('.', ',')} s`}
    >
      <div className={cn('relative z-[1] flex h-4 items-center gap-1 truncate px-1.5 text-[11px] leading-4 font-medium', tone.strip)}>{wide && <span className="truncate">{label}</span>}</div>
      {bg && <div className="absolute inset-x-0 top-4 bottom-0 bg-repeat-x opacity-80" style={{ backgroundImage: bg, backgroundSize: 'auto 100%' }} />}
      {peaks && (
        <svg className={cn('absolute inset-x-0 top-4 bottom-0 h-[calc(100%-1rem)] w-full', tone.wave)} viewBox={`${clip.inSec * PEAKS_PER_SEC} -1 ${Math.max(0.01, dur * PEAKS_PER_SEC)} 2`} preserveAspectRatio="none" aria-hidden>
          <path d={peaks.path} transform={`scale(1 ${Math.max(0.15, Math.min(1, clip.volume))})`} />
        </svg>
      )}
      {clip.fadeInSec > 0 && <div className="pointer-events-none absolute top-0 bottom-0 left-0 z-[1] bg-foreground/25 [clip-path:polygon(0_0,100%_0,0_100%)]" style={{ width: clip.fadeInSec * zoom }} />}
      {clip.fadeOutSec > 0 && <div className="pointer-events-none absolute top-0 right-0 bottom-0 z-[1] bg-foreground/25 [clip-path:polygon(0_0,100%_0,100%_100%)]" style={{ width: clip.fadeOutSec * zoom }} />}
      {!locked && w > 10 && (
        <>
          <div className="absolute inset-y-0 left-0 z-[3] w-1.5 cursor-ew-resize group-hover:bg-foreground/30" onPointerDown={(e) => ctl.clipDown(e, clip.id, trackId, 'start')} />
          <div className="absolute inset-y-0 right-0 z-[3] w-1.5 cursor-ew-resize group-hover:bg-foreground/30" onPointerDown={(e) => ctl.clipDown(e, clip.id, trackId, 'end')} />
        </>
      )}
    </div>
  );
});
