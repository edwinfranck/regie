'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Clapperboard, Download, Loader2, MoreHorizontal, Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { EmptyState, PageHeader } from '@/components/common/page-header';
import { fileUrl } from '@/components/common/media';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { type StudioEvent, useStudioEvents } from '@/hooks/use-events';
import { useProject } from '@/hooks/use-project';
import { del, get, post, toastError } from '@/lib/client';
import { NewSequenceDialog, RenameDialog, type TimelineRow, timelinesKey } from './sequence-dialogs';
import { humanDuration, timecode } from './time';

// Le lanceur du montage, dans le projet : les séquences et leurs rendus.

const RENDER_LABEL: Record<string, string> = { QUEUED: 'En file', PROCESSING: 'En cours', COMPLETED: 'Terminé', FAILED: 'Échec', CANCELED: 'Annulé' };
const when = (d: string) => new Date(d).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export function SequenceList({ projectId }: { projectId: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const { data: project } = useProject(projectId);
  const { data, isLoading } = useQuery({ queryKey: timelinesKey(projectId), queryFn: () => get<TimelineRow[]>(`/api/projects/${projectId}/timelines`) });
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState<TimelineRow | null>(null);
  const [deleting, setDeleting] = useState<TimelineRow | null>(null);
  const invalidate = () => qc.invalidateQueries({ queryKey: timelinesKey(projectId) });
  const open = (id: string) => router.push(`/edit/${projectId}?t=${id}`);

  // Les rendus se terminent pendant qu'on regarde la liste.
  useStudioEvents(
    useCallback(
      (ev: StudioEvent) => {
        const e = ev as unknown as { type: string; projectId?: string };
        if ((e.type === 'render.completed' || e.type === 'render.failed') && e.projectId === projectId) qc.invalidateQueries({ queryKey: timelinesKey(projectId) });
      },
      [projectId, qc],
    ),
  );

  const action = async (t: TimelineRow, body: Record<string, unknown>, done: string) => {
    try {
      await post(`/api/projects/${projectId}/timelines/${t.id}`, body);
      invalidate();
      toast.success(done);
    } catch (e) {
      toastError(e);
    }
  };

  return (
    <div>
      <PageHeader
        title="Montage"
        description="Les séquences du film : assemblées depuis le découpage, montées dans l’éditeur, rendues en MP4 ou MOV."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus /> Nouvelle séquence
          </Button>
        }
      />
      <div className="p-8">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : !data?.length ? (
          <EmptyState
            icon={Clapperboard}
            title="Aucune séquence"
            description="Une première séquence peut être assemblée d’emblée depuis le découpage : un clip par plan (sa vidéo, sinon son image), les dialogues en sous-titres."
            action={
              <Button onClick={() => setCreating(true)}>
                <Plus /> Nouvelle séquence
              </Button>
            }
          />
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Nom</TableHead>
                  <TableHead>Durée</TableHead>
                  <TableHead>Clips</TableHead>
                  <TableHead>Format</TableHead>
                  <TableHead>Dernier rendu</TableHead>
                  <TableHead>Modifiée</TableHead>
                  <TableHead className="w-0" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((t) => (
                  <TableRow key={t.id} className="group">
                    <TableCell className="pl-4">
                      <Link href={`/edit/${projectId}?t=${t.id}`} className="font-medium hover:underline hover:underline-offset-2">
                        {t.name}
                      </Link>
                    </TableCell>
                    <TableCell className="tabular-nums">
                      <span className="font-mono text-[13px]">{timecode(t.durationSec, t.fps)}</span>
                      <span className="ml-2 text-muted-foreground">{humanDuration(t.durationSec)}</span>
                    </TableCell>
                    <TableCell className="tabular-nums">{t.clipCount}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {t.aspectRatio ?? project?.aspectRatio ?? '—'} · {t.fps} i/s
                    </TableCell>
                    <TableCell>
                      {t.lastRender ? (
                        <div className="flex items-center gap-2">
                          <span className={t.lastRender.status === 'FAILED' ? 'text-destructive' : t.lastRender.status === 'COMPLETED' ? '' : 'text-signal'}>{RENDER_LABEL[t.lastRender.status] ?? t.lastRender.status}</span>
                          <span className="text-muted-foreground">{when(t.lastRender.createdAt)}</span>
                          {t.lastRender.status === 'COMPLETED' && t.lastRender.assetId && (
                            <Button variant="outline" size="xs" asChild>
                              <a href={fileUrl(t.lastRender.assetId, true)}>
                                <Download /> Télécharger
                              </a>
                            </Button>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Jamais rendue</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{when(t.updatedAt)}</TableCell>
                    <TableCell className="pr-4">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="sm" variant="outline" onClick={() => open(t.id)}>
                          Ouvrir dans le montage
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon-sm" aria-label={`Actions pour ${t.name}`}>
                              <MoreHorizontal />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => action(t, { action: 'duplicate' }, 'Séquence dupliquée')}>Dupliquer</DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => setRenaming(t)}>Renommer…</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(t)}>
                              Supprimer…
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <NewSequenceDialog open={creating} onOpenChange={setCreating} projectId={projectId} projectAspect={project?.aspectRatio} defaultName={`Séquence ${(data?.length ?? 0) + 1}`} onOpen={open} />
      <RenameDialog open={!!renaming} onOpenChange={(v) => !v && setRenaming(null)} name={renaming?.name ?? ''} onSubmit={async (name) => {
          if (renaming) await action(renaming, { action: 'rename', name }, 'Séquence renommée');
        }}
      />
      <AlertDialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer « {deleting?.name} » ?</AlertDialogTitle>
            <AlertDialogDescription>Le montage (pistes et clips) est supprimé. Les médias et les vidéos déjà rendues restent dans les assets.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={async () => {
                if (!deleting) return;
                try {
                  await del(`/api/projects/${projectId}/timelines/${deleting.id}`);
                  invalidate();
                  toast.success('Séquence supprimée');
                } catch (e) {
                  toastError(e);
                }
              }}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
