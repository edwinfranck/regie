'use client';

import { ASPECT_RATIOS } from '@regie/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Trash2, X } from 'lucide-react';
import { AreaField, NumberField, TextField } from '@/components/common/fields';
import { Choice, PillPicker } from '@/components/common/choice';
import { Code } from '@/components/common/status';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAutosave } from '@/hooks/use-autosave';
import { useBible, useProject, useProjectData, useProjectId } from '@/hooks/use-project';
import { del, get, patch, toastError } from '@/lib/client';
import { cn } from '@/lib/utils';
import { ShotMedia } from './shot-media';
import { ShotPrompts } from './shot-prompts';
import { ANGLE_OPTIONS, LENS_OPTIONS, MOVE_OPTIONS, SIZE_OPTIONS, STAGE_OPTIONS, TRANSITION_OPTIONS, bibleOptions, cameraLabel } from './shot-meta';

interface Props {
  shotId: string;
  onClose?: () => void;
  onDeleted?: () => void;
  className?: string;
}

/**
 * L'éditeur de plan, partagé par la scène et le storyboard. Monté une fois
 * par plan (clé) : l'enregistrement différé ne peut pas écrire sur le voisin.
 */
export function ShotEditor(props: Props) {
  return <Editor key={props.shotId} {...props} />;
}

function Editor({ shotId, onClose, onDeleted, className }: Props) {
  const projectId = useProjectId();
  const qc = useQueryClient();
  const key = ['project', projectId, `shots/${shotId}`];
  const { data: shot, isLoading } = useQuery({ queryKey: key, queryFn: () => get(`/api/projects/${projectId}/shots/${shotId}`) });
  const { data: scene } = useProjectData(`scenes/${shot?.sceneId}`, { enabled: !!shot?.sceneId });
  const { data: project } = useProject();
  const { data: characters } = useBible('characters');
  const { data: props } = useBible('props');
  const { data: locations } = useBible('locations');
  const { data: lights } = useBible('lights');

  const refresh = (sceneId: string) => {
    qc.invalidateQueries({ queryKey: ['project', projectId, `shots/${shotId}/prompts`] });
    qc.invalidateQueries({ queryKey: ['project', projectId, `scenes/${sceneId}`] });
    qc.invalidateQueries({ queryKey: ['project', projectId, 'scenes'] });
    qc.invalidateQueries({ queryKey: ['project', projectId, 'lint'] });
  };
  const { queue } = useAutosave<Record<string, unknown>>(async (p) => {
    const row = await patch(`/api/projects/${projectId}/shots/${shotId}`, p);
    qc.setQueryData(key, (old: any) => ({ ...old, ...row, scene: old?.scene }));
    refresh(row.sceneId);
  });
  // `local` : forme du cache (relations) ; `remote` : forme de l'API (ids).
  const set = (local: Record<string, unknown>, remote: Record<string, unknown> = local) => {
    qc.setQueryData(key, (old: any) => ({ ...old, ...local }));
    queue(remote);
  };

  async function remove() {
    try {
      await del(`/api/projects/${projectId}/shots/${shotId}`);
      qc.removeQueries({ queryKey: key });
      refresh(shot.sceneId);
      onDeleted?.();
    } catch (e) {
      toastError(e, 'Suppression impossible');
    }
  }

  if (isLoading || !shot)
    return (
      <div className={cn('space-y-3 p-4', className)}>
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-80" />
      </div>
    );

  const characterIds: string[] = shot.characters.map((c: any) => c.characterId);
  const propIds: string[] = shot.props.map((p: any) => p.propId);
  const ratio = shot.aspectRatio || project?.aspectRatio || '16:9';
  const inherited = (name?: string | null) => `Hérité de la scène${name ? ` (${name})` : ' (aucun)'}`;
  const cam = cameraLabel(shot);

  return (
    <div className={cn('flex min-h-0 flex-col', className)}>
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <Code className="text-sm">{shot.code}</Code>
        <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{cam || 'Cadre à définir'} · {shot.durationSec} s</span>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon-sm" className="text-destructive" aria-label="Supprimer le plan">
              <Trash2 />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Supprimer le plan {shot.code} ?</AlertDialogTitle>
              <AlertDialogDescription>Les plans suivants seront renumérotés. Les images et vidéos générées restent dans les assets.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction onClick={remove}>Supprimer</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        {onClose && (
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Fermer l’éditeur">
            <X />
          </Button>
        )}
      </div>

      <Tabs defaultValue="shot" className="min-h-0 flex-1 gap-0">
        <TabsList className="mx-4 mt-3">
          <TabsTrigger value="shot">Plan</TabsTrigger>
          <TabsTrigger value="prompts">Prompts</TabsTrigger>
          <TabsTrigger value="media">Images et vidéos</TabsTrigger>
        </TabsList>

        <TabsContent value="shot" className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
          <AreaField label="Description" hint="Ce qu’on voit, en français, pour l’équipe." value={shot.description} onChange={(v) => set({ description: v })} rows={2} />
          <AreaField label="Action" hint="En anglais, au présent : une action visible et filmable. C’est elle qui part dans les prompts." value={shot.action} onChange={(v) => set({ action: v })} rows={3} mono />
          <div className="grid gap-4 sm:grid-cols-2">
            <AreaField label="Dialogue" value={shot.dialogue} onChange={(v) => set({ dialogue: v || null })} rows={2} />
            <AreaField label="Son" hint="Ambiance, effets. Vide : l’ambiance du lieu." value={shot.audio} onChange={(v) => set({ audio: v || null })} rows={2} />
          </div>

          <fieldset className="space-y-4">
            <legend className="mb-2 text-sm font-medium">Cadre</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <Choice label="Valeur de plan" value={shot.size} onChange={(v) => set({ size: v })} options={SIZE_OPTIONS} allowNone noneLabel="Non définie" />
              <Choice label="Angle" value={shot.angle} onChange={(v) => set({ angle: v })} options={ANGLE_OPTIONS} allowNone noneLabel="Non défini" />
              <Choice label="Mouvement" value={shot.move} onChange={(v) => set({ move: v })} options={MOVE_OPTIONS} allowNone noneLabel="Non défini" />
              <Choice label="Objectif" value={shot.lens} onChange={(v) => set({ lens: v })} options={LENS_OPTIONS} allowNone noneLabel="Non défini" />
              <NumberField label="Durée" value={shot.durationSec} onChange={(v) => v && v >= 0.1 && set({ durationSec: v })} step={0.5} min={0.5} max={600} suffix="s" />
              <Choice label="Transition vers le suivant" value={shot.transition} onChange={(v) => set({ transition: v })} options={TRANSITION_OPTIONS} allowNone noneLabel="Aucune" />
            </div>
            <TextField label="Composition" hint="En anglais : placement dans le cadre, premier plan, lignes." value={shot.composition} onChange={(v) => set({ composition: v || null })} mono />
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <Choice label="Lieu" value={shot.locationId} onChange={(v) => set({ locationId: v })} options={bibleOptions(locations)} allowNone noneLabel={inherited(scene?.location?.name)} />
            <Choice label="Lumière" value={shot.lightId} onChange={(v) => set({ lightId: v })} options={bibleOptions(lights)} allowNone noneLabel={inherited(scene?.light?.name)} />
          </div>
          <PillPicker label="Personnages" options={bibleOptions(characters)} value={characterIds} onChange={(ids) => set({ characters: ids.map((characterId) => ({ characterId })) }, { characterIds: ids })} />
          <PillPicker label="Objets et costumes" options={bibleOptions(props)} value={propIds} onChange={(ids) => set({ props: ids.map((propId) => ({ propId })) }, { propIds: ids })} />

          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm" title="Un plan de groupe peut dépasser le nombre maximal de personnages par plan fixé dans les règles du projet.">
              <Switch checked={shot.isGroup} onCheckedChange={(v) => set({ isGroup: v })} /> Plan de groupe
            </label>
            <TextField label="Note" value={shot.note} onChange={(v) => set({ note: v || null })} placeholder="Raccord, contrainte, idée à garder…" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Choice label="Statut" value={shot.status} onChange={(v) => v && set({ status: v })} options={STAGE_OPTIONS} />
            <Choice label="Format" value={shot.aspectRatio} onChange={(v) => set({ aspectRatio: v })} options={ASPECT_RATIOS.map((r) => ({ value: r, label: r }))} allowNone noneLabel={`Format du projet (${project?.aspectRatio ?? '16:9'})`} />
          </div>
        </TabsContent>

        <TabsContent value="prompts" className="min-h-0 flex-1 overflow-y-auto p-4">
          <ShotPrompts shot={shot} />
        </TabsContent>

        <TabsContent value="media" className="min-h-0 flex-1 overflow-y-auto p-4">
          <ShotMedia shot={shot} ratio={ratio} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
