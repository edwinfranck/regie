'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Film, FileText, LayoutList, Loader2, Plus, Table2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { EmptyState, PageHeader } from '@/components/common/page-header';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useBible, useProjectData, useProjectId } from '@/hooks/use-project';
import { post, toastError } from '@/lib/client';
import { SortableItem, SortableList } from '@/components/shots/sortable';
import { SceneRow, SceneTable } from './_components/scene-list';

export default function ScenesPage() {
  const projectId = useProjectId();
  const router = useRouter();
  const qc = useQueryClient();
  const key = ['project', projectId, 'scenes'];
  const { data, isLoading } = useProjectData<{ scenes: any[] }>('scenes');
  const { data: characters } = useBible('characters');
  const [view, setView] = useState<'list' | 'table'>('list');
  const [busy, setBusy] = useState<'new' | 'sync' | null>(null);
  const scenes = data?.scenes ?? [];
  const codeOf = new Map((characters ?? []).map((c: any) => [c.id, c.code as string]));

  async function create() {
    setBusy('new');
    try {
      const s = await post(`/api/projects/${projectId}/scenes`, {});
      qc.invalidateQueries({ queryKey: ['project', projectId] });
      router.push(`/projects/${projectId}/scenes/${s.id}`);
    } catch (e) {
      toastError(e, 'Création impossible');
      setBusy(null);
    }
  }

  async function sync() {
    setBusy('sync');
    try {
      const r = await post(`/api/projects/${projectId}/scenes/sync`);
      qc.invalidateQueries({ queryKey: ['project', projectId] });
      if (!r.total) toast.message('Aucune scène dans le scénario', { description: 'Le scénario ne contient pas encore d’en-tête de scène (INT. / EXT.).' });
      else
        toast.success(`${r.total} scène${r.total > 1 ? 's' : ''} lue${r.total > 1 ? 's' : ''} dans le scénario`, {
          description: [
            `${r.created} créée${r.created > 1 ? 's' : ''}, ${r.updated} mise${r.updated > 1 ? 's' : ''} à jour.`,
            r.extra ? `${r.extra} scène${r.extra > 1 ? 's' : ''} en plus du scénario, conservée${r.extra > 1 ? 's' : ''}.` : '',
            r.unknownCharacters?.length ? `Absents de la bible : ${r.unknownCharacters.join(', ')}.` : '',
          ].filter(Boolean).join(' '),
          duration: 10000,
        });
    } catch (e) {
      toastError(e, 'Synchronisation impossible');
    } finally {
      setBusy(null);
    }
  }

  async function reorder(next: any[]) {
    const prev = data;
    // Numérotation locale immédiate : l'API renumérote de la même façon.
    qc.setQueryData(key, (old: any) => ({ ...old, scenes: next.map((s, i) => ({ ...s, number: i + 1 })) }));
    try {
      await post(`/api/projects/${projectId}/scenes/reorder`, { ids: next.map((s) => s.id) });
      qc.invalidateQueries({ queryKey: ['project', projectId] });
    } catch (e) {
      qc.setQueryData(key, prev);
      toastError(e, 'Déplacement refusé');
    }
  }

  const total = scenes.reduce((a, s) => a + (s.estSeconds ?? 0), 0);

  return (
    <div>
      <PageHeader
        title="Scènes"
        description="La story map : les scènes dans l’ordre du film. Glissez une scène pour la déplacer, les numéros et les codes de plans suivent."
        actions={
          <>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" disabled={!!busy}>
                  {busy === 'sync' ? <Loader2 className="animate-spin" /> : <FileText />} Depuis le scénario
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Créer les scènes depuis le scénario ?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Chaque en-tête du scénario devient une scène. Les scènes existantes sont mises à jour dans l’ordre du scénario (titre, lieu, moment, description, distribution) ; leurs plans sont conservés et rien n’est supprimé.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction onClick={sync}>Synchroniser</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button onClick={create} disabled={!!busy}>
              {busy === 'new' ? <Loader2 className="animate-spin" /> : <Plus />} Nouvelle scène
            </Button>
          </>
        }
      />
      <div className="space-y-4 p-8">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        ) : !scenes.length ? (
          <EmptyState
            icon={Film}
            title="Aucune scène"
            description="Créez les scènes une à une, ou lisez-les dans le scénario : chaque en-tête INT. / EXT. devient une scène."
            action={
              <div className="flex gap-2">
                <Button variant="outline" onClick={sync} disabled={!!busy}>
                  Depuis le scénario
                </Button>
                <Button onClick={create} disabled={!!busy}>
                  Nouvelle scène
                </Button>
              </div>
            }
          />
        ) : (
          <>
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                {scenes.length} scène{scenes.length > 1 ? 's' : ''} · {scenes.reduce((a, s) => a + s.shots.length, 0)} plans{total ? ` · environ ${Math.round(total / 60)} min estimées` : ''}
              </p>
              <ToggleGroup type="single" variant="outline" size="sm" value={view} onValueChange={(v) => v && setView(v as 'list' | 'table')}>
                <ToggleGroupItem value="list" aria-label="Vue liste">
                  <LayoutList /> Liste
                </ToggleGroupItem>
                <ToggleGroupItem value="table" aria-label="Vue tableau">
                  <Table2 /> Tableau
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
            {view === 'list' ? (
              <SortableList items={scenes} onReorder={reorder}>
                <div className="space-y-2">
                  {scenes.map((s) => (
                    <SortableItem key={s.id} id={s.id}>
                      <SceneRow scene={s} codeOf={codeOf} />
                    </SortableItem>
                  ))}
                </div>
              </SortableList>
            ) : (
              <SceneTable scenes={scenes} codeOf={codeOf} />
            )}
          </>
        )}
      </div>
    </div>
  );
}
