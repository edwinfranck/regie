'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { toast } from 'sonner';

export type StudioEvent =
  | { type: 'generation.queued'; generationId: string; projectId: string; position?: number }
  | { type: 'generation.progress'; generationId: string; projectId: string; progress: number; message?: string }
  | { type: 'generation.completed'; generationId: string; projectId: string; assetIds: string[] }
  | { type: 'generation.failed'; generationId: string; projectId: string; error: string; code?: string; willRetry: boolean }
  | { type: 'project.updated'; projectId: string; entity: string; id?: string }
  | { type: 'render.progress'; renderId: string; timelineId: string; projectId: string; progress: number }
  | { type: 'render.completed'; renderId: string; timelineId: string; projectId: string; assetId: string }
  | { type: 'render.failed'; renderId: string; timelineId: string; projectId: string; error: string };

type Listener = (e: StudioEvent) => void;
const listeners = new Set<Listener>();
let source: EventSource | null = null;

function ensureSource() {
  if (source || typeof window === 'undefined') return;
  source = new EventSource('/api/events');
  source.onmessage = (m) => {
    try {
      const ev = JSON.parse(m.data) as StudioEvent;
      listeners.forEach((l) => l(ev));
    } catch {}
  };
  // EventSource se reconnecte seul ; on ne ferme que sur 401.
  source.onerror = () => {
    if (source?.readyState === EventSource.CLOSED) source = null;
  };
}

/** S'abonne au flux temps réel (une seule connexion SSE par onglet). */
export function useStudioEvents(fn?: Listener) {
  useEffect(() => {
    ensureSource();
    if (!fn) return;
    listeners.add(fn);
    return () => void listeners.delete(fn);
  }, [fn]);
}

/** Tient à jour le cache des requêtes au rythme des événements. */
export function useLiveInvalidation() {
  const qc = useQueryClient();
  useEffect(() => {
    ensureSource();
    const fn: Listener = (ev) => {
      if (ev.type === 'generation.progress') {
        qc.setQueriesData({ queryKey: ['generations'] }, (old: any) =>
          old?.items ? { ...old, items: old.items.map((g: any) => (g.id === ev.generationId ? { ...g, status: 'PROCESSING', progress: ev.progress, message: ev.message } : g)) } : old,
        );
        return;
      }
      if (ev.type.startsWith('generation.')) qc.invalidateQueries({ queryKey: ['generations'] });
      if (ev.type === 'generation.completed') {
        qc.invalidateQueries({ queryKey: ['assets'] });
        qc.invalidateQueries({ queryKey: ['project', ev.projectId] });
        toast.success('Génération terminée', { description: `${ev.assetIds.length} fichier(s) ajouté(s) aux assets.` });
      }
      if (ev.type === 'generation.failed' && !ev.willRetry) toast.error('Génération échouée', { description: ev.error, duration: 10000 });
      if (ev.type === 'project.updated') qc.invalidateQueries({ queryKey: ['project', ev.projectId] });
    };
    listeners.add(fn);
    return () => void listeners.delete(fn);
  }, [qc]);
}
