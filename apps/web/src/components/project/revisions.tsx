'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { History, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useProjectId } from '@/hooks/use-project';
import { get, post, toastError } from '@/lib/client';
import { cn, fmtDate } from '@/lib/utils';

const show = (v: unknown) => (v === null || v === undefined || v === '' ? '∅' : typeof v === 'string' ? v : JSON.stringify(v));

/** Historique d'une entité : versions, auteur, champs modifiés, comparaison, restauration. */
export function RevisionsButton({ entityType, entityId, onRestored }: { entityType: string; entityId: string; onRestored?: () => void }) {
  const projectId = useProjectId();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const qc = useQueryClient();
  const { data: revs = [], isLoading } = useQuery({ queryKey: ['revisions', entityType, entityId], queryFn: () => get(`/api/projects/${projectId}/revisions?entityType=${entityType}&entityId=${entityId}`), enabled: open });
  const current = revs.find((r: any) => r.id === selected) ?? revs[0];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <History /> Historique
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Historique des versions</DialogTitle>
          <DialogDescription>Chaque modification est conservée. Restaurer crée une nouvelle version : rien n’est perdu.</DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Chargement de l’historique…</p>
        ) : revs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune version enregistrée.</p>
        ) : (
          <div className="grid max-h-[60vh] grid-cols-[220px_1fr] gap-4">
            <ul className="space-y-1 overflow-y-auto pr-1">
              {revs.map((r: any) => (
                <li key={r.id}>
                  <button onClick={() => setSelected(r.id)} className={cn('w-full rounded-md px-2 py-1.5 text-left text-sm', current?.id === r.id ? 'bg-secondary' : 'hover:bg-accent')}>
                    <div className="font-medium">v{r.version}</div>
                    <div className="text-xs text-muted-foreground">
                      {fmtDate(r.createdAt)} · {r.author?.name ?? '—'}
                    </div>
                    {r.message && <div className="truncate text-xs">{r.message}</div>}
                  </button>
                </li>
              ))}
            </ul>
            <div className="space-y-3 overflow-y-auto">
              {current && (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">{current.changes?.length ? `${current.changes.length} champ(s) modifié(s) par rapport à la version précédente` : 'Première version'}</p>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={current.id === revs[0].id}
                      onClick={async () => {
                        try {
                          await post(`/api/projects/${projectId}/revisions`, { revisionId: current.id });
                          toast.success(`Version ${current.version} restaurée`);
                          qc.invalidateQueries({ queryKey: ['project', projectId] });
                          qc.invalidateQueries({ queryKey: ['revisions', entityType, entityId] });
                          onRestored?.();
                          setOpen(false);
                        } catch (e) {
                          toastError(e);
                        }
                      }}
                    >
                      <RotateCcw /> Restaurer cette version
                    </Button>
                  </div>
                  {(current.changes ?? []).map((c: any) => (
                    <div key={c.field} className="space-y-1 rounded-md border p-3 text-sm">
                      <div className="font-mono text-xs text-muted-foreground">{c.field}</div>
                      <div className="grid grid-cols-2 gap-3">
                        <pre className="rounded-sm bg-destructive/5 p-2 text-xs whitespace-pre-wrap">{show(c.before)}</pre>
                        <pre className="rounded-sm bg-success/5 p-2 text-xs whitespace-pre-wrap">{show(c.after)}</pre>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
