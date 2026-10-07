'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Plus, Sun, Trash2 } from 'lucide-react';
import { AreaField, TagInput, TextField } from '@/components/common/fields';
import { EmptyState } from '@/components/common/page-header';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { useAutosave } from '@/hooks/use-autosave';
import { useBible, useBibleMutations, useProjectId } from '@/hooks/use-project';
import { patch } from '@/lib/client';

interface Light {
  id: string;
  code: string;
  name: string;
  short: string;
  block: string;
  never: string[];
  isDefault: boolean;
}

/** Les états de lumière (DAY, NIGHT, GOLDEN…) : un plan en déclare un, sinon celui par défaut. */
export function LightsSection({ editable }: { editable: boolean }) {
  const { data: lights = [], isLoading } = useBible<Light>('lights');
  const { create } = useBibleMutations('lights');
  if (isLoading) return <Skeleton className="h-64" />;
  const add = () => create.mutate({ name: lights.length ? `Lumière ${lights.length + 1}` : 'Jour', code: lights.length ? undefined : 'DAY' });
  return (
    <div className="space-y-4">
      <p className="max-w-3xl text-sm text-muted-foreground">Chaque plan déclare un état de lumière ; sans déclaration, il prend celui par défaut. Le bloc part dans le prompt, les interdits dans les négatifs.</p>
      {lights.length === 0 ? (
        <EmptyState
          icon={Sun}
          title="Aucun état de lumière"
          description="Déclarez les lumières du film (jour, nuit, heure dorée…) pour que deux plans de la même scène gardent la même lumière."
          action={
            editable && (
              <Button onClick={add}>
                <Plus /> Créer un état de lumière
              </Button>
            )
          }
        />
      ) : (
        <>
          <div className="grid gap-4 2xl:grid-cols-2">
            {lights.map((l) => (
              <LightCard key={l.id} light={l} editable={editable} />
            ))}
          </div>
          {editable && (
            <Button variant="outline" size="sm" onClick={add}>
              <Plus /> Nouvel état de lumière
            </Button>
          )}
        </>
      )}
    </div>
  );
}

function LightCard({ light: l, editable }: { light: Light; editable: boolean }) {
  const projectId = useProjectId();
  const qc = useQueryClient();
  const key = ['project', projectId, 'bible/lights'];
  const { update, remove } = useBibleMutations('lights');
  const { queue } = useAutosave<Record<string, unknown>>(async (p) => {
    await patch(`/api/projects/${projectId}/bible/lights/${l.id}`, p);
    qc.invalidateQueries({ queryKey: key });
  });
  const set = (p: Partial<Light>) => {
    qc.setQueryData<Light[]>(key, (old) => old?.map((x) => (x.id === l.id ? { ...x, ...p } : x)));
    queue(p);
  };
  return (
    <section className="rounded-md border bg-card">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-2.5">
        <p className="font-medium">
          <span className="font-mono text-sm">{l.code}</span> <span className="text-muted-foreground">·</span> {l.name}
        </p>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-sm" title="Un seul état par défaut">
            <Switch checked={l.isDefault} disabled={!editable || l.isDefault} onCheckedChange={(v) => v && update.mutate({ id: l.id, isDefault: true })} />
            {l.isDefault ? 'Par défaut' : 'Définir par défaut'}
          </label>
          {editable && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label={`Supprimer ${l.name}`} className="text-muted-foreground hover:text-destructive">
                  <Trash2 />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Supprimer la lumière {l.code} ?</AlertDialogTitle>
                  <AlertDialogDescription>Les scènes et plans qui la déclarent n’auront plus d’état de lumière.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction onClick={() => remove.mutate(l.id)}>Supprimer</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>
      <fieldset disabled={!editable} className="space-y-3 p-4">
        <div className="grid gap-3 md:grid-cols-[160px_1fr]">
          <TextField label="Code" value={l.code} onChange={(v) => { const code = v.toUpperCase().replace(/[^A-Z0-9_-]/g, ''); if (code) set({ code }); }} mono />
          <TextField label="Nom" value={l.name} onChange={(v) => v.trim() && set({ name: v })} />
        </div>
        <TextField label="Forme courte" value={l.short} onChange={(v) => set({ short: v })} mono placeholder="warm low sun, long shadows" />
        <AreaField label="Bloc" value={l.block} onChange={(v) => set({ block: v })} rows={3} mono />
        <TagInput label="Jamais" value={l.never ?? []} onChange={(v) => set({ never: v })} />
      </fieldset>
    </section>
  );
}
