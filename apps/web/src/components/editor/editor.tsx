'use client';

import type { MediaRef, Sequence } from '@regie/core';
import { sequenceDuration } from '@regie/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Clapperboard, Loader2, Plus } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { get, post, put, toastError } from '@/lib/client';
import { actions } from './actions';
import { Bin } from './bin';
import { Inspector, type ProjectInfo } from './inspector';
import { MenuBar } from './menubar';
import { Monitor } from './monitor';
import { payload } from './ops';
import { transport, usePlaybackClock } from './playback';
import { RenderDialog, useRenderEvents, useRenders } from './render-dialog';
import { NewSequenceDialog, RenameDialog, type TimelineRow, timelinesKey } from './sequence-dialogs';
import { type Doc, useEditor, usePlayhead } from './store';
import { Timeline } from './timeline';

// L'espace de montage, plein écran : chutier, moniteur, inspecteur, timeline.

interface TimelineData {
  id: string;
  name: string;
  fps: number;
  aspectRatio: string | null;
  sequence: Sequence;
  media: MediaRef[];
}

const docFrom = (d: TimelineData): Doc => ({ name: d.name, fps: d.fps, aspectRatio: d.aspectRatio, width: d.sequence.width, height: d.sequence.height, tracks: [...d.sequence.tracks].sort((a, b) => a.order - b.order) });

export function Editor({ projectId, projectTitle }: { projectId: string; projectTitle: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const qc = useQueryClient();
  const project = useQuery({ queryKey: ['project', projectId], queryFn: () => get<ProjectInfo & { title: string }>(`/api/projects/${projectId}`) });
  const list = useQuery({ queryKey: timelinesKey(projectId), queryFn: () => get<TimelineRow[]>(`/api/projects/${projectId}/timelines`) });
  const wanted = search.get('t');
  const timelineId = wanted ?? list.data?.[0]?.id ?? null;
  const [dialog, setDialog] = useState<null | 'new' | 'rename' | 'render'>(null);

  const data = useQuery({ queryKey: ['editor', 'timeline', timelineId], queryFn: () => get<TimelineData>(`/api/projects/${projectId}/timelines/${timelineId}`), enabled: !!timelineId, staleTime: Infinity, gcTime: 0, refetchOnWindowFocus: false, retry: false });

  const { flush } = useSequenceSave(projectId);
  usePlaybackClock();
  useShortcuts(flush);
  useRenderEvents(projectId);
  const renders = useRenders(projectId, timelineId);
  const running = renders.data?.find((r) => r.status === 'QUEUED' || r.status === 'PROCESSING');

  // Chargement (ou changement) de séquence : état neuf, tête au début.
  useEffect(() => {
    if (!data.data) return;
    useEditor.getState().load(data.data.id, docFrom(data.data), data.data.media);
    usePlayhead.getState().setPlaying(false);
    usePlayhead.getState().seek(0);
    requestAnimationFrame(() => actions.fit());
  }, [data.data]);

  useEffect(() => {
    if (data.data) document.title = `${data.data.name} · Montage · régie`;
  }, [data.data]);

  const openSequence = useCallback(
    async (id: string) => {
      await flush();
      const sp = new URLSearchParams(search.toString());
      sp.set('t', id);
      router.replace(`${pathname}?${sp}`);
    },
    [flush, pathname, router, search],
  );

  const back = async () => {
    await flush();
    router.push(`/projects/${projectId}/timeline`);
  };

  const reassemble = async () => {
    if (!timelineId) return;
    if (!(await flush())) return;
    try {
      const r = await post<{ missing: string[] }>(`/api/projects/${projectId}/timelines/${timelineId}`, { action: 'reassemble' });
      const fresh = await get<TimelineData>(`/api/projects/${projectId}/timelines/${timelineId}`);
      const s = useEditor.getState();
      s.addMedia(fresh.media);
      // Le serveur a déjà l'état réassemblé ; on le garde dans l'historique pour pouvoir annuler.
      s.replace(docFrom(fresh));
      requestAnimationFrame(() => actions.fit());
      toast.success('Séquence réassemblée depuis le découpage', { description: r.missing.length ? `${r.missing.length} plan(s) sans média : ${r.missing.slice(0, 12).join(', ')}${r.missing.length > 12 ? '…' : ''}` : 'Tous les plans ont un média.' });
    } catch (e) {
      toastError(e, 'Réassemblage impossible');
    }
  };

  const duplicate = async () => {
    if (!timelineId || !(await flush())) return;
    try {
      const copy = await post<{ id: string; name: string }>(`/api/projects/${projectId}/timelines/${timelineId}`, { action: 'duplicate' });
      qc.invalidateQueries({ queryKey: timelinesKey(projectId) });
      toast.success(`« ${copy.name} » créée`);
      await openSequence(copy.id);
    } catch (e) {
      toastError(e, 'Duplication impossible');
    }
  };

  const exportFile = async (format: 'srt' | 'edl') => {
    if (!timelineId || !(await flush())) return;
    window.location.href = `/api/projects/${projectId}/timelines/${timelineId}/export?format=${format}`;
  };

  const docName = useEditor((s) => s.doc?.name ?? '');
  const empty = useEditor((s) => !s.doc || sequenceDuration(s.doc) <= 0);
  const showBin = useEditor((s) => s.showBin);
  const showInspector = useEditor((s) => s.showInspector);
  const loaded = useEditor((s) => !!s.doc && s.timelineId === timelineId);
  const tlHeight = useTimelineHeight();

  const noSequence = list.isSuccess && !list.data.length && !wanted;
  const notFound = data.isError;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <MenuBar
        projectTitle={projectTitle}
        timelines={list.data ?? []}
        timelineId={timelineId}
        project={project.data}
        rendering={running ? running.progress : null}
        h={{
          onNew: () => setDialog('new'),
          onOpenSequence: openSequence,
          onDuplicate: duplicate,
          onRename: () => setDialog('rename'),
          onReassemble: reassemble,
          onExport: exportFile,
          onRender: () => setDialog('render'),
          onBack: back,
          onRetrySave: () => void flush(),
        }}
      />

      {noSequence || notFound ? (
        <div className="flex flex-1 items-center justify-center p-8">
          <div className="flex max-w-md flex-col items-center gap-3 text-center">
            <Clapperboard className="size-8 text-muted-foreground" />
            <p className="font-medium">{notFound ? 'Séquence introuvable' : 'Aucune séquence dans ce projet'}</p>
            <p className="text-sm text-muted-foreground">Créez une séquence : elle peut être assemblée d’emblée depuis le découpage, un clip par plan, les dialogues en sous-titres.</p>
            <Button onClick={() => setDialog('new')}>
              <Plus /> Nouvelle séquence
            </Button>
          </div>
        </div>
      ) : !loaded ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1">
            {showBin && (
              <aside className="w-72 shrink-0 border-r">
                <Bin projectId={projectId} />
              </aside>
            )}
            <main className="dark min-w-0 flex-1 text-foreground">
              <Monitor />
            </main>
            {showInspector && (
              <aside className="w-80 shrink-0 border-l">
                <Inspector projectId={projectId} project={project.data} />
              </aside>
            )}
          </div>
          <div role="separator" aria-orientation="horizontal" aria-label="Redimensionner la timeline" onPointerDown={tlHeight.onDown} className="h-1.5 shrink-0 cursor-row-resize border-t bg-background hover:bg-accent" />
          <div className="shrink-0" style={{ height: tlHeight.height }}>
            <Timeline onAssemble={reassemble} />
          </div>
        </div>
      )}

      <NewSequenceDialog open={dialog === 'new'} onOpenChange={(v) => setDialog(v ? 'new' : null)} projectId={projectId} projectAspect={project.data?.aspectRatio} defaultName={`Séquence ${(list.data?.length ?? 0) + 1}`} onOpen={openSequence} />
      <RenameDialog open={dialog === 'rename'} onOpenChange={(v) => setDialog(v ? 'rename' : null)} name={docName} onSubmit={(name) => useEditor.getState().commit((d) => ({ ...d, name }))} />
      {timelineId && <RenderDialog open={dialog === 'render'} onOpenChange={(v) => setDialog(v ? 'render' : null)} projectId={projectId} timelineId={timelineId} flush={flush} empty={empty} />}
    </div>
  );
}

/**
 * Enregistrement automatique de l'état complet, ~800 ms après la dernière
 * modification. Les envois sont chaînés (jamais deux PUT en parallèle) ; en
 * cas de conflit entre onglets, le dernier écrit gagne.
 */
function useSequenceSave(projectId: string) {
  const qc = useQueryClient();
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const chain = useRef<Promise<boolean>>(Promise.resolve(true));
  const savedRev = useRef(0);

  const save = useCallback(() => {
    const run = async () => {
      const s = useEditor.getState();
      if (!s.doc || !s.timelineId) return true;
      if (s.rev === savedRev.current && s.save !== 'error') return true;
      const { rev, timelineId } = s;
      s.set({ save: 'saving' });
      try {
        await put(`/api/projects/${projectId}/timelines/${timelineId}`, payload(s.doc));
        const now = useEditor.getState();
        if (now.timelineId === timelineId) {
          savedRev.current = rev;
          now.set({ save: now.rev === rev ? 'saved' : 'dirty' });
        }
        qc.invalidateQueries({ queryKey: timelinesKey(projectId) });
        return true;
      } catch (e) {
        useEditor.getState().set({ save: 'error' });
        toastError(e, 'Enregistrement impossible');
        return false;
      }
    };
    chain.current = chain.current.then(run, run);
    return chain.current;
  }, [projectId, qc]);

  const flush = useCallback(() => {
    clearTimeout(timer.current);
    return save();
  }, [save]);

  useEffect(
    () =>
      useEditor.subscribe((s, p) => {
        // Nouvelle séquence chargée : rien à enregistrer.
        if (s.timelineId !== p.timelineId || s.rev < p.rev) {
          savedRev.current = s.rev;
          return;
        }
        if (s.rev !== p.rev || (p.txBase && !s.txBase && s.rev !== savedRev.current)) {
          if (s.save !== 'saving' && s.save !== 'dirty') s.set({ save: 'dirty' });
          clearTimeout(timer.current);
          timer.current = setTimeout(() => void save(), 800);
        }
      }),
    [save],
  );

  // Sortie de page : envoi de dernière chance (keepalive) et avertissement.
  useEffect(() => {
    const onLeave = (e: BeforeUnloadEvent) => {
      const s = useEditor.getState();
      if (!s.doc || !s.timelineId || s.rev === savedRev.current) return;
      try {
        void fetch(`/api/projects/${projectId}/timelines/${s.timelineId}`, { method: 'PUT', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload(s.doc)) });
      } catch {}
      e.preventDefault();
    };
    window.addEventListener('beforeunload', onLeave);
    return () => {
      window.removeEventListener('beforeunload', onLeave);
      void flush();
    };
  }, [flush, projectId]);

  return { flush };
}

function useShortcuts(flush: () => Promise<boolean>) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target;
      if (target instanceof Element && target.closest('input, textarea, select, [contenteditable="true"], [role="dialog"], [role="menu"], [role="listbox"], [role="slider"]')) return;
      if (!useEditor.getState().doc) return;
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      const fps = useEditor.getState().doc?.fps ?? 24;
      const run = (fn: () => void) => {
        e.preventDefault();
        if (document.activeElement instanceof HTMLButtonElement) document.activeElement.blur();
        fn();
      };
      if (mod) {
        if (key === 'z') return run(e.shiftKey ? actions.redo : actions.undo);
        if (key === 'y') return run(actions.redo);
        if (key === 'k') return run(actions.split);
        if (key === 'd') return run(actions.duplicate);
        if (key === 'a') return run(actions.selectAll);
        if (key === 's') return run(() => void flush());
        return;
      }
      if (e.altKey) return;
      switch (e.key) {
        case ' ':
          return run(transport.toggle);
        case 'ArrowLeft':
          return run(() => transport.step(e.shiftKey ? -fps : -1));
        case 'ArrowRight':
          return run(() => transport.step(e.shiftKey ? fps : 1));
        case 'ArrowUp':
          return run(() => actions.jumpEdge(-1));
        case 'ArrowDown':
          return run(() => actions.jumpEdge(1));
        case 'Home':
          return run(transport.home);
        case 'End':
          return run(transport.end);
        case 'Delete':
        case 'Backspace':
          return run(actions.remove);
        case 'Escape':
          return run(() => useEditor.getState().select([]));
        case '+':
        case '=':
          return run(() => actions.zoomBy(1.4));
        case '-':
        case '_':
          return run(() => actions.zoomBy(1 / 1.4));
      }
      if (key === 'z' && e.shiftKey) return run(actions.fit);
      if (e.shiftKey) return;
      if (key === 'j') return run(() => transport.shuttle(-1));
      if (key === 'k') return run(transport.stop);
      if (key === 'l') return run(() => transport.shuttle(1));
      if (key === 's') return run(actions.split);
      if (key === 'n') return run(actions.toggleSnap);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [flush]);
}

/** Hauteur de la timeline, réglable à la souris et retenue par navigateur. */
function useTimelineHeight() {
  const [height, setHeight] = useState(340);
  useEffect(() => {
    try {
      const v = Number(localStorage.getItem('regie:editor:timeline-h'));
      if (v > 120) setHeight(Math.min(v, window.innerHeight - 260));
      else setHeight(Math.round(Math.max(260, window.innerHeight * 0.44)));
    } catch {
      setHeight(Math.round(Math.max(260, window.innerHeight * 0.44)));
    }
  }, []);
  const onDown = (e: React.PointerEvent) => {
    const y0 = e.clientY;
    const h0 = height;
    let last = h0;
    const move = (ev: PointerEvent) => {
      last = Math.max(160, Math.min(window.innerHeight - 260, h0 + (y0 - ev.clientY)));
      setHeight(last);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      document.body.style.cursor = '';
      try {
        localStorage.setItem('regie:editor:timeline-h', String(last));
      } catch {}
    };
    document.body.style.cursor = 'row-resize';
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  return { height, onDown };
}
