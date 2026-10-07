'use client';

import { AGE_RANGES, CHARACTER_PROFILE_FIELDS, CHARACTER_ROLES, COUNTRIES, GENDERS } from '@regie/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Ban, BookOpen, Brain, Cake, Compass, Drama, Footprints, Gem, Globe, Goal, Heart, type LucideIcon, MessageCircle, Network, Ruler, ScanFace, Shirt, Skull, Sprout, Swords, Text, Trash2, TrendingUp, User, VenusAndMars } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ComboField } from '@/components/common/combo';
import { AreaField, NumberField, TagInput, TextField } from '@/components/common/fields';
import { IconLabel } from '@/components/common/icon-label';
import { Panel } from '@/components/common/page-header';
import { Code } from '@/components/common/status';
import { CommentsButton } from '@/components/project/comments';
import { ReferencePanel } from '@/components/project/reference-panel';
import { RichField } from '@/components/common/rich-field';
import { RevisionsButton } from '@/components/project/revisions';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAutosave } from '@/hooks/use-autosave';
import { useBibleMutations, useProjectId } from '@/hooks/use-project';
import { get, patch } from '@/lib/client';

// Une icône par rubrique du profil, pour s'y retrouver dans la grille.
const PROFILE_ICONS: Record<keyof typeof CHARACTER_PROFILE_FIELDS, LucideIcon> = {
  personality: Brain,
  backstory: BookOpen,
  motivation: Compass,
  fear: Skull,
  desire: Heart,
  goal: Goal,
  conflict: Swords,
  arc: TrendingUp,
  relations: Network,
  speech: MessageCircle,
  behavior: Footprints,
  accessories: Gem,
  evolution: Sprout,
};

export default function CharacterPage() {
  const projectId = useProjectId();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const key = ['project', projectId, `bible/characters/${id}`];
  const { data: c, isLoading } = useQuery({ queryKey: key, queryFn: () => get(`/api/projects/${projectId}/bible/characters/${id}`) });
  const { remove } = useBibleMutations('characters');

  const { queue } = useAutosave<Record<string, unknown>>(async (p) => {
    const row = await patch(`/api/projects/${projectId}/bible/characters/${id}`, p);
    qc.setQueryData(key, (old: any) => ({ ...old, ...row, assets: old?.assets }));
    qc.invalidateQueries({ queryKey: ['project', projectId, 'bible/characters'] });
  });
  // Mise à jour locale immédiate + enregistrement différé.
  const set = (p: Record<string, unknown>) => {
    qc.setQueryData(key, (old: any) => ({ ...old, ...p }));
    queue(p);
  };
  const setProfile = (k: string, v: string) => {
    const profile = { ...(c?.profile ?? {}), [k]: v };
    set({ profile });
  };

  if (isLoading || !c)
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
            <Link href={`/projects/${projectId}/characters`} aria-label="Retour">
              <ArrowLeft />
            </Link>
          </Button>
          <Code className="text-sm">{c.code}</Code>
          <input value={c.name} onChange={(e) => (e.target.value.trim() ? set({ name: e.target.value }) : qc.setQueryData(key, (o: any) => ({ ...o, name: e.target.value })))} className="min-w-0 bg-transparent text-2xl font-semibold tracking-tight outline-none" aria-label="Nom" />
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm" title="Un personnage gelé ne change plus : sa description et sa feuille font foi.">
            <Switch checked={c.frozen} onCheckedChange={(v) => set({ frozen: v })} /> Gelé
          </label>
          <CommentsButton entityType="character" entityId={c.id} />
          <RevisionsButton entityType="character" entityId={c.id} onRestored={() => qc.invalidateQueries({ queryKey: key })} />
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="text-destructive">
                <Trash2 /> Supprimer
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Supprimer {c.name} ?</AlertDialogTitle>
                <AlertDialogDescription>Le personnage sera retiré de toutes les scènes et de tous les plans. Les images générées restent dans les assets.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction onClick={() => remove.mutate(c.id, { onSuccess: () => router.push(`/projects/${projectId}/characters`) })}>Supprimer</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </header>

      <div className="grid gap-6 p-8 xl:grid-cols-[1fr_380px]">
        <Tabs defaultValue="visual" className="min-w-0">
          <TabsList>
            <TabsTrigger value="visual">Apparence</TabsTrigger>
            <TabsTrigger value="identity">Identité</TabsTrigger>
            <TabsTrigger value="profile">Profil narratif</TabsTrigger>
          </TabsList>

          <TabsContent value="visual" className="space-y-5 pt-4">
            <p className="text-sm text-muted-foreground">Ces champs partent tels quels dans les prompts. Écrivez-les en anglais, avec des mots concrets et visuels.</p>
            <AreaField label={<IconLabel icon={ScanFace}>Description gelée</IconLabel>} hint="Visage, âge apparent, morphologie, cheveux, traits distinctifs. Elle ne change plus une fois le personnage gelé." value={c.block} onChange={(v) => set({ block: v })} rows={6} mono />
            <TextField label={<IconLabel icon={Text}>Forme courte</IconLabel>} hint="Une phrase qui commence par le code et le nom, pour les moteurs vidéo qui décrochent au-delà de 70 mots." value={c.short} onChange={(v) => set({ short: v })} mono />
            <AreaField label={<IconLabel icon={Shirt}>Costume</IconLabel>} value={c.costume} onChange={(v) => set({ costume: v })} rows={3} mono />
            <TextField label={<IconLabel icon={User}>Marqueur de silhouette</IconLabel>} hint="Ce qui l’identifie de loin quand le visage ne se lit plus : un chapeau, une couleur, une taille." value={c.silhouette} onChange={(v) => set({ silhouette: v })} mono />
            <TagInput label={<IconLabel icon={Ban}>Jamais</IconLabel>} hint="Ce que le modèle ne doit jamais lui donner : ces termes rejoignent les négatifs de chaque plan." value={c.never ?? []} onChange={(v) => set({ never: v })} />
            <NumberField label={<IconLabel icon={Ruler}>Taille</IconLabel>} value={c.heightM} onChange={(v) => set({ heightM: v })} step={0.01} min={0.3} max={3} suffix="m" className="max-w-40" />
          </TabsContent>

          <TabsContent value="identity" className="grid content-start gap-4 pt-4 sm:grid-cols-2">
            <ComboField label={<IconLabel icon={Drama}>Rôle</IconLabel>} value={c.role} onChange={(v) => set({ role: v })} options={CHARACTER_ROLES} placeholder="Protagoniste, antagoniste, mentor…" />
            <ComboField label={<IconLabel icon={Cake}>Âge</IconLabel>} hint="Une tranche, ou un âge précis : « 34 ans »." value={c.age} onChange={(v) => set({ age: v })} options={AGE_RANGES} />
            <ComboField label={<IconLabel icon={VenusAndMars}>Genre</IconLabel>} value={c.gender} onChange={(v) => set({ gender: v })} options={GENDERS} />
            <ComboField label={<IconLabel icon={Globe}>Origine</IconLabel>} value={c.origin} onChange={(v) => set({ origin: v })} options={COUNTRIES} />
          </TabsContent>

          <TabsContent value="profile" className="grid content-start gap-4 pt-4 lg:grid-cols-2">
            {Object.entries(CHARACTER_PROFILE_FIELDS).map(([k, label]) => (
              <RichField key={k} label={<IconLabel icon={PROFILE_ICONS[k as keyof typeof CHARACTER_PROFILE_FIELDS]}>{label}</IconLabel>} value={c.profile?.[k]} onChange={(v) => setProfile(k, v)} minHeight={70} />
            ))}
          </TabsContent>
        </Tabs>

        <div className="space-y-4 xl:sticky xl:top-16 xl:self-start">
          <Panel title="Référence et cohérence" description={`Chargée dans les ${c._count?.shots ?? 0} plans où ${c.name} apparaît.`}>
            <ReferencePanel kind="character" entity={c} assets={c.assets} ratio="16:9" />
          </Panel>
        </div>
      </div>
    </div>
  );
}
