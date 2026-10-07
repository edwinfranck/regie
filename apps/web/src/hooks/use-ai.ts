'use client';

import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { post, toastError } from '@/lib/client';
import { fmtUsd } from '@/lib/utils';
import { useProjectId } from './use-project';

/**
 * Lance une tâche d'écriture assistée (/api/projects/:id/ai/:task). Le
 * résultat est une proposition : c'est à la page de la montrer et de laisser
 * l'auteur l'appliquer.
 */
export function useAiTask<TOut = any, TIn = any>(task: string, opts: { onSuccess?: (data: TOut) => void } = {}) {
  const projectId = useProjectId();
  return useMutation<{ data: TOut; model: { label: string; provider: string }; costUsd: number | null }, Error, TIn>({
    mutationFn: (input) => post(`/api/projects/${projectId}/ai/${task}`, input ?? {}),
    onSuccess: (r) => {
      toast.message('Proposition prête', { description: `${r.model.label} (${r.model.provider})${r.costUsd ? ` · ${fmtUsd(r.costUsd)}` : ''}` });
      opts.onSuccess?.(r.data);
    },
    onError: (e) => toastError(e, 'L’IA n’a pas pu répondre'),
  });
}
