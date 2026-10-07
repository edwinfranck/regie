'use client';

import { EMOTIONS } from '@regie/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlignLeft, ArrowLeft, DoorOpen, Flag, Heart, MapPin, Star, Sun, SunMoon, Swords, Target, Timer, Trash2, Users } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { ComboField } from '@/components/common/combo';
import { NumberField } from '@/components/common/fields';
import { IconLabel } from '@/components/common/icon-label';
import { RichField } from '@/components/common/rich-field';
import { Choice, PillPicker } from '@/components/common/choice';
import { EmptyState } from '@/components/common/page-header';
import { RevisionsButton } from '@/components/project/revisions';
import { IMPORTANCE_OPTIONS, SETTING_OPTIONS, STAGE_OPTIONS, TIME_OPTIONS, bibleOptions, fmtDuration, sceneHeading, shotsSeconds } from '@/components/shots/shot-meta';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAutosave } from '@/hooks/use-autosave';
import { useBible, useProjectId } from '@/hooks/use-project';
import { ApiError, del, get, patch, toastError } from '@/lib/client';
import { BreakdownTab } from './_components/breakdown-tab';
import { DirectionTab } from './_components/direction-tab';
import { ShotsTab } from './_components/shots-tab';

export default function ScenePage() {
  const projectId = useProjectId();
  const { sceneId } = useParams<{ sceneId: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const qc = useQueryClient();
  const key = ['project', projectId, `scenes/${sceneId}`];
  const { data: s, isLoading, error } = useQuery({ queryKey: key, queryFn: () => get(`/api/projects/${projectId}/scenes/${sceneId}`) });
  const { data: characters } = useBible('characters');
  const { data: locations } = useBible('locations');
  const { data: lights } = useBible('lights');
  const shotParam = search.get('shot');
  const [tab, setTab] = useState(shotParam ? 'shots' : (search.get('tab') ?? null));

  const { queue } = useAutosave<Record<string, unknown>>(async (p) => {
    const row = await patch(`/api/projects/${projectId}/scenes/${sceneId}`, p);
    qc.setQueryData(key, (old: any) => ({ ...old, ...row }));
    qc.invalidateQueries({ queryKey: ['project', projectId, 'scenes'] });
    qc.invalidateQueries({ queryKey: ['project', projectId, 'lint'] });
  });
  // `local` : forme du cache (relations incluses) ; `remote` : ce que l'API attend.
  const set = (local: Record<string, unknown>, remote: Record<string, unknown> = local) => {
    qc.setQueryData(key, (old: any) => ({ ...old, ...local }));
    queue(remote);
  };

  async function remove() {
    try {
      await del(`/api/projects/${projectId}/scenes/${sceneId}`);
      qc.invalidateQueries({ queryKey: ['project', projectId] });
      router.push(`/projects/${projectId}/scenes`);
    } catch (e) {
      toastError(e, 'Suppression impossible');
    }
  }

  if (error instanceof ApiError && error.status === 404)
    return (
      <div className="p-8">
        <EmptyState title="Scène introuvable" description="Elle a peut-être été supprimée." action={<Button asChild variant="outline"><Link href={`/projects/${projectId}/scenes`}>Retour aux scènes</Link></Button>} />
      </div>
    );
  if (isLoading || !s)
    return (
      <div className="space-y-4 p-8">
        <Skeleton className="h-10 w-96" />
        <Skeleton className="h-96" />
      </div>
    );

  const castIds: string[] = s.characters.map((c: any) => c.characterId);
  const activeTab = tab ?? (s.shots.length ? 'shots' : 'sheet');
  const byId = (rows: any[] | undefined, id: string | null) => (id ? (rows ?? []).find((r) => r.id === id) : null);

  return (
    <div>
      <header className="space-y-3 border-b px-8 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Button variant="ghost" size="icon-sm" asChild>
              <Link href={`/projects/${projectId}/scenes`} aria-label="Retour aux scènes">
                <ArrowLeft />
              </Link>
            </Button>
            <label className="flex items-baseline gap-1 text-2xl font-semibold tabular-nums" title="Numéro de la scène : il entre dans le code des plans (12A).">
              <span className="text-muted-foreground">#</span>
              <input
                type="number"
                min={0}
                value={s.number}
                onChange={(e) => e.target.value !== '' && set({ number: Math.max(0, Math.round(Number(e.target.value))) })}
                className="w-12 bg-transparent outline-none"
                aria-label="Numéro de scène"
              />
            </label>
            <input value={s.title} onChange={(e) => set({ title: e.target.value })} placeholder="Titre de la scène" className="min-w-0 flex-1 bg-transparent text-2xl font-semibold tracking-tight outline-none placeholder:text-muted-foreground/60" aria-label="Titre" />
          </div>
          <div className="flex items-center gap-2">
            <Choice value={s.status} onChange={(v) => v && set({ status: v })} options={STAGE_OPTIONS} triggerClassName="w-40" />
            <RevisionsButton entityType="scene" entityId={s.id} onRestored={() => qc.invalidateQueries({ queryKey: key })} />
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="text-destructive">
                  <Trash2 /> Supprimer
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Supprimer la scène {s.number} ?</AlertDialogTitle>
                  <AlertDialogDescription>Ses {s.shots.length} plans seront supprimés avec elle et les scènes suivantes renumérotées. Les images et vidéos générées restent dans les assets.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction onClick={remove}>Supprimer</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
        <p className="font-mono text-sm text-muted-foreground">{sceneHeading(s)}</p>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Choice label={<IconLabel icon={DoorOpen}>Intérieur / extérieur</IconLabel>} value={s.setting} onChange={(v) => v && set({ setting: v })} options={SETTING_OPTIONS} />
          <Choice label={<IconLabel icon={MapPin}>Lieu</IconLabel>} value={s.locationId} onChange={(v) => set({ locationId: v, location: byId(locations, v) }, { locationId: v })} options={bibleOptions(locations)} allowNone noneLabel="Aucun" placeholder="Choisir un lieu" />
          <Choice label={<IconLabel icon={SunMoon}>Moment</IconLabel>} value={s.timeOfDay} onChange={(v) => v && set({ timeOfDay: v })} options={TIME_OPTIONS} />
          <Choice label={<IconLabel icon={Sun}>Lumière</IconLabel>} value={s.lightId} onChange={(v) => set({ lightId: v, light: byId(lights, v) }, { lightId: v })} options={bibleOptions(lights)} allowNone noneLabel="Lumière par défaut" />
          <NumberField label={<IconLabel icon={Timer}>Durée estimée</IconLabel>} value={s.estSeconds} onChange={(v) => set({ estSeconds: v === null ? null : Math.round(v) })} min={0} suffix="s" hint={s.shots.length ? `Plans : ${fmtDuration(shotsSeconds(s.shots))}` : undefined} />
          <Choice label={<IconLabel icon={Star}>Importance</IconLabel>} value={String(s.importance)} onChange={(v) => v && set({ importance: Number(v) })} options={IMPORTANCE_OPTIONS} />
        </div>
      </header>

      <Tabs value={activeTab} onValueChange={setTab} className="gap-0">
        <div className="border-b px-8 pt-3 pb-3">
          <TabsList>
            <TabsTrigger value="sheet">Fiche</TabsTrigger>
            <TabsTrigger value="breakdown">Dépouillement</TabsTrigger>
            <TabsTrigger value="direction">Mise en scène</TabsTrigger>
            <TabsTrigger value="shots">Découpage ({s.shots.length})</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="sheet" className="grid gap-6 p-8 xl:grid-cols-[1fr_380px]">
          <div className="min-w-0 space-y-5">
            <RichField label={<IconLabel icon={AlignLeft}>Description</IconLabel>} hint="Ce qui se passe, comme dans le scénario." value={s.description} onChange={(v) => set({ description: v })} minHeight={220} />
            {/* L'émotion part telle quelle dans les prompts : une valeur courte, pas de mise en forme. */}
            <ComboField label={<IconLabel icon={Heart}>Émotion</IconLabel>} hint="Ce que le spectateur doit ressentir. Elle part dans les prompts." value={s.emotion} onChange={(v) => set({ emotion: v })} options={EMOTIONS} className="max-w-md" />
            <div className="grid gap-4 lg:grid-cols-2">
              <RichField label={<IconLabel icon={Target}>Objectif</IconLabel>} hint="Ce que veut le personnage dans cette scène." value={s.objective} onChange={(v) => set({ objective: v })} minHeight={66} />
              <RichField label={<IconLabel icon={Swords}>Conflit</IconLabel>} hint="Ce qui s’y oppose." value={s.conflict} onChange={(v) => set({ conflict: v })} minHeight={66} />
              <RichField label={<IconLabel icon={Flag}>Résultat</IconLabel>} hint="Ce qui a changé à la fin de la scène." value={s.outcome} onChange={(v) => set({ outcome: v })} minHeight={66} className="lg:col-span-2" />
            </div>
          </div>
          <div className="space-y-4">
            <PillPicker label={<IconLabel icon={Users}>Distribution</IconLabel>} options={bibleOptions(characters)} value={castIds} onChange={(ids) => set({ characters: ids.map((characterId) => ({ characterId })) }, { characterIds: ids })} />
            <p className="text-xs text-muted-foreground">La distribution de la scène sert au dépouillement et au plan de travail. Les personnages visibles se choisissent plan par plan.</p>
          </div>
        </TabsContent>

        <TabsContent value="breakdown" className="p-8">
          <BreakdownTab scene={s} set={set} />
        </TabsContent>

        <TabsContent value="direction" className="p-8">
          <DirectionTab scene={s} set={set} />
        </TabsContent>

        <TabsContent value="shots">
          <ShotsTab scene={s} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
