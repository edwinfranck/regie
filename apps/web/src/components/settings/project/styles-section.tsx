'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Palette, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { AreaField, TagInput, TextField } from '@/components/common/fields';
import { EmptyState, Panel } from '@/components/common/page-header';
import { Code } from '@/components/common/status';
import { ReferencePanel } from '@/components/project/reference-panel';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { useAutosave } from '@/hooks/use-autosave';
import { useBible, useBibleMutations, useProjectId } from '@/hooks/use-project';
import { get, patch } from '@/lib/client';
import { cn } from '@/lib/utils';

interface Style {
  id: string;
  code: string;
  name: string;
  short: string;
  block: string;
  never: string[];
  active: boolean;
  refAssetId: string | null;
}

/** Les styles de rendu (LOOK) : un seul actif, injecté dans chaque prompt d'image. */
export function StylesSection({ editable, aspectRatio }: { editable: boolean; aspectRatio: string }) {
  const { data: styles = [], isLoading } = useBible<Style>('styles');
  const { create, update } = useBibleMutations('styles');
  const [selected, setSelected] = useState<string | null>(null);
  const current = styles.find((s) => s.id === selected) ?? styles.find((s) => s.active) ?? styles[0];

  if (isLoading) return <Skeleton className="h-64" />;
  return (
    <div className="space-y-4">
      <p className="max-w-3xl text-sm text-muted-foreground">Le style actif part dans chaque prompt d’image et de vidéo, avec son image de référence. Changer de style actif change le rendu de tout le film.</p>
      {styles.length === 0 ? (
        <EmptyState
          icon={Palette}
          title="Aucun style de rendu"
          description="Décrivez le rendu voulu (pellicule, grain, palette, type d’animation) : il sera ajouté à chaque prompt."
          action={
            editable && (
              <Button onClick={() => create.mutate({ name: 'Style principal' }, { onSuccess: (s: Style) => setSelected(s.id) })}>
                <Plus /> Créer un style
              </Button>
            )
          }
        />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[280px_1fr]">
          <div className="space-y-2">
            <ul className="divide-y rounded-md border">
              {styles.map((s) => (
                <li key={s.id} className={cn('flex items-center gap-2 px-3 py-2', s.id === current?.id ? 'bg-accent' : 'hover:bg-accent/50')}>
                  <button type="button" onClick={() => setSelected(s.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                    <Code>{s.code}</Code>
                    <span className="truncate">{s.name}</span>
                  </button>
                  <label className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground" title="Un seul style actif à la fois">
                    <Switch checked={s.active} disabled={!editable || s.active} onCheckedChange={(v) => v && update.mutate({ id: s.id, active: true })} aria-label={`Activer ${s.name}`} />
                    {s.active ? <span className="text-foreground">Actif</span> : 'Activer'}
                  </label>
                </li>
              ))}
            </ul>
            {editable && (
              <Button variant="outline" size="sm" onClick={() => create.mutate({ name: `Style ${styles.length + 1}` }, { onSuccess: (s: Style) => setSelected(s.id) })}>
                <Plus /> Nouveau style
              </Button>
            )}
          </div>
          {current && <StyleEditor key={current.id} id={current.id} editable={editable} aspectRatio={aspectRatio} onDeleted={() => setSelected(null)} />}
        </div>
      )}
    </div>
  );
}

function StyleEditor({ id, editable, aspectRatio, onDeleted }: { id: string; editable: boolean; aspectRatio: string; onDeleted: () => void }) {
  const projectId = useProjectId();
  const qc = useQueryClient();
  const key = ['project', projectId, `bible/styles/${id}`];
  const { data: s } = useQuery({ queryKey: key, queryFn: () => get(`/api/projects/${projectId}/bible/styles/${id}`) });
  const { remove } = useBibleMutations('styles');
  const { queue } = useAutosave<Record<string, unknown>>(async (p) => {
    const row = await patch(`/api/projects/${projectId}/bible/styles/${id}`, p);
    qc.setQueryData(key, (old: any) => ({ ...old, ...row, assets: old?.assets }));
    qc.invalidateQueries({ queryKey: ['project', projectId, 'bible/styles'] });
  });
  const set = (p: Record<string, unknown>) => {
    qc.setQueryData(key, (old: any) => ({ ...old, ...p }));
    queue(p);
  };

  if (!s) return <Skeleton className="h-64" />;
  return (
    <div className="grid min-w-0 gap-6 2xl:grid-cols-[1fr_340px]">
      <Panel
        title={
          <span className="flex items-center gap-2">
            <Code>{s.code}</Code> {s.name}
          </span>
        }
        actions={
          editable && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="text-destructive">
                  <Trash2 /> Supprimer
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Supprimer le style {s.name} ?</AlertDialogTitle>
                  <AlertDialogDescription>{s.active ? 'C’est le style actif : les prompts n’auront plus de style tant qu’un autre ne sera pas activé.' : 'Les images déjà générées ne changent pas.'}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction onClick={() => remove.mutate(s.id, { onSuccess: onDeleted })}>Supprimer</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )
        }
      >
        <fieldset disabled={!editable} className="space-y-4">
          <TextField label="Nom" value={s.name} onChange={(v) => v.trim() && set({ name: v })} />
          <TextField label="Forme courte" hint="Quelques mots pour les moteurs vidéo : « 35mm film, soft grain, muted teal palette »." value={s.short} onChange={(v) => set({ short: v })} mono />
          <AreaField label="Bloc de style" hint="La description complète du rendu, ajoutée à chaque prompt d’image. En anglais." value={s.block} onChange={(v) => set({ block: v })} rows={7} mono />
          <TagInput label="Jamais" hint="Ce que ce style exclut : ces termes rejoignent les négatifs." value={s.never ?? []} onChange={(v) => set({ never: v })} />
        </fieldset>
      </Panel>
      <Panel title="Image de référence" description="Chargée avec chaque génération tant que ce style est actif.">
        <ReferencePanel kind="style" entity={s} assets={s.assets} ratio={aspectRatio} />
      </Panel>
    </div>
  );
}
