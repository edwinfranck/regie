'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, MessageSquare, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { useProjectId } from '@/hooks/use-project';
import { apiFetch, get, patch, post, toastError } from '@/lib/client';
import { cn, fmtRelative } from '@/lib/utils';

/** Fil de commentaires attaché à une entité (personnage, scène, plan…). @nom notifie un membre. */
export function CommentsButton({ entityType, entityId, label = 'Commentaires' }: { entityType: string; entityId: string; label?: string }) {
  const projectId = useProjectId();
  const qc = useQueryClient();
  const key = ['comments', entityType, entityId];
  const [text, setText] = useState('');
  const { data: comments = [] } = useQuery({ queryKey: key, queryFn: () => get(`/api/projects/${projectId}/comments?entityType=${entityType}&entityId=${entityId}`) });
  const open = comments.filter((c: any) => !c.resolvedAt).length;
  const send = useMutation({
    mutationFn: () => post(`/api/projects/${projectId}/comments`, { entityType, entityId, body: text }),
    onSuccess: () => {
      setText('');
      qc.invalidateQueries({ queryKey: key });
    },
    onError: (e) => toastError(e),
  });
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm">
          <MessageSquare /> {label}
          {open > 0 && <span className="rounded-full bg-foreground px-1.5 text-xs text-background">{open}</span>}
        </Button>
      </SheetTrigger>
      <SheetContent className="flex w-[420px] flex-col gap-0 sm:max-w-[420px]">
        <SheetHeader className="border-b">
          <SheetTitle>Commentaires</SheetTitle>
          <SheetDescription>Mentionnez un membre avec @prénom ou @email pour le notifier.</SheetDescription>
        </SheetHeader>
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {comments.length === 0 && <p className="text-sm text-muted-foreground">Aucun commentaire.</p>}
          {comments.map((c: any) => (
            <div key={c.id} className={cn('space-y-1 rounded-md border p-3 text-sm', c.resolvedAt && 'opacity-60')}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{c.author?.name ?? c.author?.email}</span>
                <span className="text-xs text-muted-foreground">{fmtRelative(c.createdAt)}</span>
              </div>
              <p className="whitespace-pre-wrap">{c.body}</p>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={async () => {
                    await patch(`/api/projects/${projectId}/comments`, { id: c.id, resolved: !c.resolvedAt }).catch(toastError);
                    qc.invalidateQueries({ queryKey: key });
                  }}
                >
                  <Check /> {c.resolvedAt ? 'Rouvrir' : 'Résolu'}
                </Button>
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={async () => {
                    await apiFetch(`/api/projects/${projectId}/comments?id=${c.id}`, { method: 'DELETE' }).catch(toastError);
                    qc.invalidateQueries({ queryKey: key });
                  }}
                >
                  <Trash2 />
                </Button>
              </div>
            </div>
          ))}
        </div>
        <div className="space-y-2 border-t p-4">
          <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder="Écrire un commentaire…" onKeyDown={(e) => e.key === 'Enter' && (e.metaKey || e.ctrlKey) && text.trim() && send.mutate()} />
          <Button size="sm" onClick={() => send.mutate()} disabled={!text.trim() || send.isPending}>
            Publier
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
