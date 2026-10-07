'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { create } from 'zustand';
import { del, get, patch, post, toastError } from '@/lib/client';

export function useProjectId() {
  return useParams<{ projectId: string }>().projectId;
}

export function useProject(projectId = useProjectId()) {
  return useQuery({ queryKey: ['project', projectId], queryFn: () => get(`/api/projects/${projectId}`), enabled: !!projectId });
}

/** Une ressource du projet : /api/projects/:id/<path>, clé ['project', id, path]. */
export function useProjectData<T = any>(path: string, opts: { enabled?: boolean } = {}) {
  const projectId = useProjectId();
  return useQuery<T>({ queryKey: ['project', projectId, path], queryFn: () => get(`/api/projects/${projectId}/${path}`), enabled: !!projectId && opts.enabled !== false });
}

export const BIBLE_KINDS = ['characters', 'locations', 'props', 'styles', 'lights'] as const;
export type BibleKind = (typeof BIBLE_KINDS)[number];

export function useBible<T = any>(kind: BibleKind) {
  return useProjectData<T[]>(`bible/${kind}`);
}

export function useBibleMutations(kind: BibleKind) {
  const projectId = useProjectId();
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['project', projectId, `bible/${kind}`] });
    qc.invalidateQueries({ queryKey: ['project', projectId, 'lint'] });
  };
  const base = `/api/projects/${projectId}/bible/${kind}`;
  return {
    create: useMutation({ mutationFn: (data: any) => post(base, data), onSuccess: invalidate, onError: (e) => toastError(e) }),
    update: useMutation({
      mutationFn: ({ id, ...data }: any) => patch(`${base}/${id}`, data),
      onSuccess: (row: any) => {
        qc.setQueryData(['project', projectId, `bible/${kind}/${row.id}`], (old: any) => (old ? { ...old, ...row } : old));
        invalidate();
      },
      onError: (e) => toastError(e),
    }),
    remove: useMutation({ mutationFn: (id: string) => del(`${base}/${id}`), onSuccess: invalidate, onError: (e) => toastError(e) }),
  };
}

// L'état d'enregistrement affiché dans la barre du haut.
type SaveState = 'idle' | 'saving' | 'saved' | 'error';
export const useSaveStatus = create<{ state: SaveState; at?: number; set: (s: SaveState) => void }>((set) => ({
  state: 'idle',
  set: (state) => set({ state, at: Date.now() }),
}));
