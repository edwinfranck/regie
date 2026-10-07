'use client';

import { ERAS, LIGHTINGS, MOODS, PALETTES, type Preset, type PresetGroup, WEATHERS } from '@regie/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Armchair, ArrowLeft, AudioLines, Ban, Building2, CloudSun, DoorOpen, Hourglass, Layers, Palette, ScanEye, Sun, Text, Trash2, Wind } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ComboField, ComboTags, joinList, splitList } from '@/components/common/combo';
import { AreaField, TagInput, TextField } from '@/components/common/fields';
import { IconLabel } from '@/components/common/icon-label';
import { RichField } from '@/components/common/rich-field';
import { Panel } from '@/components/common/page-header';
import { Code } from '@/components/common/status';
import { ReferencePanel } from '@/components/project/reference-panel';
import { RevisionsButton } from '@/components/project/revisions';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAutosave } from '@/hooks/use-autosave';
import { useBibleMutations, useProjectId } from '@/hooks/use-project';
import { get, patch } from '@/lib/client';

// L'atmosphère nourrit le contexte des tâches IA, pas les prompts d'image
// (seuls block, short, never et sound y partent) : les descriptions longues
// sont donc rédigées en éditeur riche, les qualités courtes choisies en listes.
const ATMOSPHERE_TAGS: { key: string; label: React.ReactNode; hint?: string; options: Preset[] | PresetGroup[] }[] = [
  { key: 'palette', label: <IconLabel icon={Palette}>Palette</IconLabel>, hint: 'Les couleurs dominantes et leurs accents.', options: PALETTES },
  { key: 'lighting', label: <IconLabel icon={Sun}>Lumière</IconLabel>, hint: 'Sources, qualité, température.', options: LIGHTINGS },
  { key: 'mood', label: <IconLabel icon={Wind}>Ambiance</IconLabel>, options: MOODS },
];
const ATMOSPHERE_RICH: { key: string; label: React.ReactNode; hint?: string; rows: number }[] = [
  { key: 'architecture', label: <IconLabel icon={Building2}>Architecture</IconLabel>, hint: 'Volumes, matériaux, structure, profondeur.', rows: 4 },
  { key: 'textures', label: <IconLabel icon={Layers}>Textures</IconLabel>, hint: 'Surfaces, usure, patine.', rows: 4 },
  { key: 'objects', label: <IconLabel icon={Armchair}>Objets</IconLabel>, hint: 'Mobilier et objets toujours présents.', rows: 4 },
];

export default function LocationPage() {
  const projectId = useProjectId();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const key = ['project', projectId, `bible/locations/${id}`];
  const { data: l, isLoading } = useQuery({ queryKey: key, queryFn: () => get(`/api/projects/${projectId}/bible/locations/${id}`) });
  const { remove } = useBibleMutations('locations');

  const { queue } = useAutosave<Record<string, unknown>>(async (p) => {
    const row = await patch(`/api/projects/${projectId}/bible/locations/${id}`, p);
    qc.setQueryData(key, (old: any) => ({ ...old, ...row, assets: old?.assets }));
    qc.invalidateQueries({ queryKey: ['project', projectId, 'bible/locations'] });
  });
  // Mise à jour locale immédiate + enregistrement différé.
  const set = (p: Record<string, unknown>) => {
    qc.setQueryData(key, (old: any) => ({ ...old, ...p }));
    queue(p);
  };

  if (isLoading || !l)
    return (
      <div className="space-y-4 p-8">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-96" />
      </div>
    );

  return (
    <div>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b px-8 py-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon-sm" asChild>
            <Link href={`/projects/${projectId}/locations`} aria-label="Retour">
              <ArrowLeft />
            </Link>
          </Button>
          <Code className="text-sm">{l.code}</Code>
          <input value={l.name} onChange={(e) => (e.target.value.trim() ? set({ name: e.target.value }) : qc.setQueryData(key, (o: any) => ({ ...o, name: e.target.value })))} className="min-w-0 bg-transparent text-2xl font-semibold tracking-tight outline-none" aria-label="Nom" />
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm" title="Un lieu gelé ne change plus : sa description et sa plaque font foi.">
            <Switch checked={l.frozen} onCheckedChange={(v) => set({ frozen: v })} /> Gelé
          </label>
          <RevisionsButton entityType="location" entityId={l.id} onRestored={() => qc.invalidateQueries({ queryKey: key })} />
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="text-destructive">
                <Trash2 /> Supprimer
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Supprimer {l.name} ?</AlertDialogTitle>
                <AlertDialogDescription>Le lieu sera détaché de toutes les scènes et de tous les plans. Les images générées restent dans les assets.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction onClick={() => remove.mutate(l.id, { onSuccess: () => router.push(`/projects/${projectId}/locations`) })}>Supprimer</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </header>

      <div className="grid gap-6 p-8 xl:grid-cols-[1fr_420px]">
        <Tabs defaultValue="visual" className="min-w-0">
          <TabsList>
            <TabsTrigger value="visual">Description</TabsTrigger>
            <TabsTrigger value="atmosphere">Atmosphère</TabsTrigger>
          </TabsList>

          <TabsContent value="visual" className="space-y-5 pt-4">
            <p className="text-sm text-muted-foreground">Ces champs partent tels quels dans les prompts. Écrivez-les en anglais, avec des mots concrets et visuels.</p>
            <div className="flex flex-wrap items-end gap-6">
              <div className="space-y-1.5">
                <Label>
                  <IconLabel icon={DoorOpen}>Type de décor</IconLabel>
                </Label>
                <label className="flex h-9 items-center gap-2 text-sm">
                  <Switch checked={l.interior} onCheckedChange={(v) => set({ interior: v })} /> {l.interior ? 'Intérieur' : 'Extérieur'}
                </label>
              </div>
              <ComboField label={<IconLabel icon={Hourglass}>Époque</IconLabel>} value={l.era} onChange={(v) => set({ era: v })} options={ERAS} className="w-64" />
            </div>
            <AreaField label={<IconLabel icon={ScanEye}>Description gelée</IconLabel>} hint="Le décor vide : architecture, matériaux, couleurs, mobilier, profondeur. Elle ne change plus une fois le lieu gelé." value={l.block} onChange={(v) => set({ block: v })} rows={7} mono />
            <TextField label={<IconLabel icon={Text}>Forme courte</IconLabel>} hint="Une phrase qui commence par le code et le nom, pour les moteurs vidéo qui décrochent au-delà de 70 mots." value={l.short} onChange={(v) => set({ short: v })} mono />
            <TagInput label={<IconLabel icon={Ban}>Jamais</IconLabel>} hint="Ce que le modèle ne doit jamais montrer ici : ces termes rejoignent les négatifs de chaque plan." value={l.never ?? []} onChange={(v) => set({ never: v })} />
          </TabsContent>

          <TabsContent value="atmosphere" className="space-y-5 pt-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <ComboField label={<IconLabel icon={CloudSun}>Météo</IconLabel>} value={l.weather} onChange={(v) => set({ weather: v })} options={WEATHERS} />
              {ATMOSPHERE_TAGS.map((f) => (
                <ComboTags key={f.key} label={f.label} hint={f.hint} value={splitList(l[f.key])} onChange={(v) => set({ [f.key]: joinList(v) })} options={f.options} />
              ))}
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              {ATMOSPHERE_RICH.map((f) => (
                <RichField key={f.key} label={f.label} hint={f.hint} value={l[f.key]} onChange={(v) => set({ [f.key]: v })} minHeight={f.rows * 22} className={f.key === 'architecture' ? 'lg:col-span-2' : undefined} />
              ))}
            </div>
            {/* Le son part tel quel dans les prompts vidéo quand le plan n'en précise pas : texte brut. */}
            <AreaField label={<IconLabel icon={AudioLines}>Son</IconLabel>} hint="L’ambiance sonore du lieu. Reprise telle quelle par les prompts vidéo quand le plan ne précise pas le sien." value={l.sound} onChange={(v) => set({ sound: v })} rows={2} mono />
          </TabsContent>
        </Tabs>

        <div className="space-y-4 xl:sticky xl:top-16 xl:self-start">
          <Panel title="Référence et cohérence" description={`Chargée dans les ${l._count?.shots ?? 0} plans tournés ici.`}>
            <ReferencePanel kind="location" entity={l} assets={l.assets} ratio="16:9" />
          </Panel>
        </div>
      </div>
    </div>
  );
}
