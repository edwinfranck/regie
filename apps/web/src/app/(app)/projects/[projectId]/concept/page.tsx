'use client';

import { AUDIENCES, COUNTRIES, DURATIONS, ERAS, GENRES, INSPIRATIONS, THEMES, TONES, conceptSchema, subgenresOf, toPlain, toRich } from '@regie/core';
import { useQueryClient } from '@tanstack/react-query';
import { AlignLeft, BookOpenText, Check, Compass, Drama, Globe, Hourglass, Library, Lightbulb, Loader2, Megaphone, MessageSquareQuote, Mic, Orbit, Palette, Scale, Shapes, Sparkles, Swords, Tags, Target, Timer, UserPlus, Users, X } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ComboField, ComboTags, joinList, splitList } from '@/components/common/combo';
import { AreaField, TextField } from '@/components/common/fields';
import { IconLabel } from '@/components/common/icon-label';
import { RichField } from '@/components/common/rich-field';
import { usable, useModels } from '@/components/common/model-picker';
import { PageHeader, Panel } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAiTask } from '@/hooks/use-ai';
import { useAutosave } from '@/hooks/use-autosave';
import { useBible, useProject, useProjectData, useProjectId } from '@/hooks/use-project';
import { patch, post, put, toastError } from '@/lib/client';
import { cn } from '@/lib/utils';

// Seules les clés du schéma partent au PUT : la ligne renvoyée par GET porte
// aussi id, projectId, updatedAt, que le schéma refuserait.
const KEYS = Object.keys(conceptSchema.shape) as (keyof typeof conceptSchema.shape)[];
const pick = (row: Record<string, any>) => {
  const out: Record<string, unknown> = {};
  for (const k of KEYS) if (row[k] !== undefined) out[k] = row[k];
  if (out.idea === null) out.idea = '';
  if (!Array.isArray(out.themes)) out.themes = [];
  return out;
};

const BRIEF_KEYS = ['idea', 'genre', 'durationMin', 'country', 'era', 'audience', 'tone', 'theme', 'message', 'inspirations'] as const;

// Les éléments que l'IA propose, dans l'ordre d'affichage.
const GENERATED: { key: string; label: React.ReactNode; hint?: string; rows?: number; tags?: boolean; line?: boolean; rich?: boolean }[] = [
  { key: 'logline', label: <IconLabel icon={Target}>Logline</IconLabel>, hint: 'L’histoire en une phrase : qui, veut quoi, contre quoi.', rows: 2 },
  { key: 'tagline', label: <IconLabel icon={Megaphone}>Tagline</IconLabel>, hint: 'L’accroche de l’affiche.', line: true },
  { key: 'synopsisShort', label: <IconLabel icon={AlignLeft}>Synopsis court</IconLabel>, rich: true, rows: 5 },
  { key: 'synopsisLong', label: <IconLabel icon={BookOpenText}>Synopsis long</IconLabel>, rich: true, rows: 12 },
  { key: 'pitch', label: <IconLabel icon={Mic}>Pitch</IconLabel>, hint: 'Ce que vous diriez en trente secondes.', rich: true, rows: 5 },
  { key: 'themes', label: <IconLabel icon={Tags}>Thèmes</IconLabel>, tags: true },
  { key: 'conflicts', label: <IconLabel icon={Swords}>Conflits</IconLabel>, hint: 'Le conflit central et les conflits secondaires.', rich: true, rows: 4 },
  { key: 'stakes', label: <IconLabel icon={Scale}>Enjeux</IconLabel>, hint: 'Ce qui est perdu si le personnage échoue.', rich: true, rows: 3 },
  { key: 'universe', label: <IconLabel icon={Orbit}>Univers</IconLabel>, rich: true, rows: 5 },
];
const RICH = new Set(GENERATED.filter((f) => f.rich).map((f) => f.key));
// Proposés par l'IA mais édités dans le panneau de gauche.
const LEFT_PROPOSED = [
  { key: 'genre', label: 'Genre' },
  { key: 'subgenre', label: 'Sous-genre' },
];

type Draft = Record<string, any> & { characters?: { name: string; role: string; description: string }[] };

export default function ConceptPage() {
  const projectId = useProjectId();
  const qc = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const key = ['project', projectId, 'concept'];
  const { data: concept, isLoading } = useProjectData('concept');
  const { data: project } = useProject();
  const { data: characters = [] } = useBible('characters');
  const { data: text = [], isFetched: modelsFetched } = useModels('TEXT');
  const canDraft = text.some(usable);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [creating, setCreating] = useState(false);
  const autoStarted = useRef(false);

  const ai = useAiTask<Draft>('concept', { onSuccess: (d) => setDraft(d ?? null) });

  const { queue } = useAutosave<Record<string, unknown>>(async () => {
    // L'objet complet, fusionné depuis le cache (qui porte déjà les frappes en attente).
    const row = await put(`/api/projects/${projectId}/concept`, pick(qc.getQueryData<any>(key) ?? {}));
    qc.setQueryData(key, (old: any) => ({ ...old, updatedAt: row.updatedAt }));
    qc.invalidateQueries({ queryKey: ['project', projectId], exact: true });
  });
  const set = (p: Record<string, unknown>) => {
    qc.setQueryData(key, (old: any) => ({ ...old, ...p }));
    queue(p);
  };

  const title = useAutosave<{ title: string }>(async (p) => {
    if (!p.title?.trim()) return;
    await patch(`/api/projects/${projectId}`, { title: p.title.trim() });
    router.refresh();
  });
  const setTitle = (v: string) => {
    qc.setQueryData(['project', projectId], (old: any) => ({ ...old, title: v }));
    title.queue({ title: v });
  };

  function brief() {
    const c = qc.getQueryData<any>(key) ?? {};
    const b: Record<string, unknown> = { title: project?.title };
    for (const k of BRIEF_KEYS) if (c[k] !== null && c[k] !== undefined && c[k] !== '') b[k] = c[k];
    return b;
  }
  const propose = () => ai.mutate({ brief: brief() });

  // Arrivée depuis la création de projet : on lance la proposition une fois.
  useEffect(() => {
    if (!search.get('draft') || autoStarted.current || !concept || !modelsFetched) return;
    autoStarted.current = true;
    if (canDraft) ai.mutate({ brief: brief() });
    router.replace(pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, concept, modelsFetched, canDraft]);

  const proposed = (k: string) => {
    const v = draft?.[k];
    if (v === undefined || v === null) return undefined;
    if (Array.isArray(v)) return v.length ? v : undefined;
    return String(v).trim() ? String(v) : undefined;
  };
  const dropFromDraft = (k: string) => setDraft((d) => (d ? { ...d, [k]: undefined } : d));
  const apply = (k: string) => {
    const v = proposed(k);
    if (v === undefined) return;
    set({ [k]: Array.isArray(v) ? v.map(String).slice(0, 30) : RICH.has(k) ? toRich(v) : v });
    dropFromDraft(k);
  };
  const pending = [...GENERATED, ...LEFT_PROPOSED].filter((f) => proposed(f.key) !== undefined);
  const applyAll = () => {
    const p: Record<string, unknown> = {};
    for (const f of pending) {
      const v = proposed(f.key)!;
      p[f.key] = Array.isArray(v) ? v.map(String).slice(0, 30) : RICH.has(f.key) ? toRich(v) : v;
    }
    set(p);
    setDraft((d) => (d ? { characters: d.characters } : d));
  };

  const existing = new Set(characters.map((c: any) => c.name.trim().toLowerCase()));
  const newCharacters = (draft?.characters ?? []).filter((c) => c?.name?.trim() && !existing.has(c.name.trim().toLowerCase()));

  async function createCharacters() {
    setCreating(true);
    let n = 0;
    try {
      for (const c of newCharacters) {
        await post(`/api/projects/${projectId}/bible/characters`, { name: c.name.trim().slice(0, 160), role: c.role?.slice(0, 200) || undefined, profile: { backstory: c.description ?? '' } });
        n++;
      }
      toast.success(`${n} personnage${n > 1 ? 's' : ''} créé${n > 1 ? 's' : ''}`, { description: 'Leurs fiches sont à compléter dans Personnages.' });
    } catch (e) {
      toastError(e);
    } finally {
      setCreating(false);
      qc.invalidateQueries({ queryKey: ['project', projectId] });
    }
  }

  if (isLoading || !concept)
    return (
      <div className="space-y-4 p-8">
        <Skeleton className="h-10 w-72" />
        <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
          <Skeleton className="h-[600px]" />
          <Skeleton className="h-[600px]" />
        </div>
      </div>
    );

  const c = concept;
  return (
    <div>
      <PageHeader
        title="Concept"
        description="Le point de départ et ce qu’il devient : logline, synopsis, pitch. Tout ici nourrit le contexte des tâches IA du projet."
        actions={
          <Button onClick={propose} disabled={!canDraft || ai.isPending} title={canDraft ? undefined : 'Aucun modèle de texte configuré'}>
            {ai.isPending ? <Loader2 className="animate-spin" /> : <Sparkles />} {ai.isPending ? 'L’IA écrit…' : 'Proposer un concept avec l’IA'}
          </Button>
        }
      >
        {!canDraft && modelsFetched && <p className="text-sm text-muted-foreground">Aucun modèle de texte configuré : la proposition par l’IA est désactivée.</p>}
      </PageHeader>

      <div className="grid gap-6 p-8 xl:grid-cols-[380px_1fr]">
        <div className="space-y-4 xl:sticky xl:top-16 xl:self-start">
          <Panel title="Point de départ" description="Ce que vous savez déjà. L’IA part de là.">
            <div className="space-y-4">
              <TextField label="Titre" value={project?.title} onChange={setTitle} />
              <RichField label={<IconLabel icon={Lightbulb}>Idée</IconLabel>} hint="Libre : une image, une situation, une question." value={c.idea} onChange={(v) => set({ idea: v })} minHeight={110} placeholder="Une couturière de Dakar dont les robes exaucent les vœux…" />
              <div className="grid grid-cols-2 gap-3">
                <ComboField label={<IconLabel icon={Drama}>Genre</IconLabel>} value={c.genre} onChange={(v) => set({ genre: v })} options={GENRES.map((g) => ({ value: g.value }))} />
                <ComboField label={<IconLabel icon={Shapes}>Sous-genre</IconLabel>} value={c.subgenre} onChange={(v) => set({ subgenre: v })} options={subgenresOf(c.genre).map((value) => ({ value }))} />
                <ComboField
                  label={<IconLabel icon={Timer}>Durée</IconLabel>}
                  value={c.durationMin ? String(c.durationMin) : null}
                  onChange={(v) => {
                    const n = v === null ? null : parseInt(v, 10);
                    set({ durationMin: n === null || Number.isNaN(n) ? null : Math.max(0, n) });
                  }}
                  options={DURATIONS}
                  display={(v) => `${v} min`}
                  placeholder="Minutes"
                />
                <ComboField label={<IconLabel icon={Globe}>Pays</IconLabel>} value={c.country} onChange={(v) => set({ country: v })} options={COUNTRIES} />
                <ComboField label={<IconLabel icon={Hourglass}>Époque</IconLabel>} value={c.era} onChange={(v) => set({ era: v })} options={ERAS} className="col-span-2" />
              </div>
              <ComboField label={<IconLabel icon={Users}>Public</IconLabel>} value={c.audience} onChange={(v) => set({ audience: v })} options={AUDIENCES} />
              <ComboTags label={<IconLabel icon={Palette}>Ton</IconLabel>} value={splitList(c.tone)} onChange={(v) => set({ tone: joinList(v) })} options={TONES} placeholder="Choisir un ou plusieurs tons" />
              <ComboField label={<IconLabel icon={Compass}>Thème principal</IconLabel>} value={c.theme} onChange={(v) => set({ theme: v })} options={THEMES} />
              <RichField label={<IconLabel icon={MessageSquareQuote}>Message</IconLabel>} hint="Ce que le spectateur emporte en sortant." value={c.message} onChange={(v) => set({ message: v })} minHeight={60} />
              <ComboTags label={<IconLabel icon={Library}>Inspirations</IconLabel>} hint="Réalisateurs, films, esthétiques — ou vos propres références." value={splitList(c.inspirations)} onChange={(v) => set({ inspirations: joinList(v) })} options={INSPIRATIONS} />
            </div>
          </Panel>
        </div>

        <div className="min-w-0 space-y-4">
          {draft && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-foreground/30 bg-secondary/50 px-4 py-3">
              <p className="text-sm">
                <span className="font-medium">Proposition de l’IA.</span> {pending.length ? `${pending.length} champ${pending.length > 1 ? 's' : ''} à relire, à droite de vos valeurs.` : 'Tout a été appliqué ou écarté.'}
              </p>
              {LEFT_PROPOSED.some((f) => proposed(f.key) !== undefined) && (
                <div className="flex w-full flex-wrap gap-2">
                  {LEFT_PROPOSED.filter((f) => proposed(f.key) !== undefined).map((f) => (
                    <span key={f.key} className="inline-flex items-center gap-2 rounded-sm border bg-background px-2 py-1 text-sm">
                      {f.label} : <span className="font-medium">{String(proposed(f.key))}</span>
                      <Button size="xs" variant="outline" onClick={() => apply(f.key)}>
                        <Check /> Appliquer
                      </Button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                {pending.length > 0 && (
                  <Button size="sm" onClick={applyAll}>
                    <Check /> Tout appliquer
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => setDraft(null)}>
                  <X /> Fermer
                </Button>
              </div>
            </div>
          )}

          <Panel title="Le concept">
            <div className="space-y-5">
              {GENERATED.map((f) => {
                const p = proposed(f.key);
                const field = f.tags ? (
                  <ComboTags label={f.label} hint={f.hint} value={c[f.key] ?? []} onChange={(v) => set({ [f.key]: v })} options={THEMES} />
                ) : f.rich ? (
                  <RichField label={f.label} hint={f.hint} value={c[f.key]} onChange={(v) => set({ [f.key]: v })} minHeight={(f.rows ?? 4) * 22} />
                ) : f.line ? (
                  <TextField label={f.label} hint={f.hint} value={c[f.key]} onChange={(v) => set({ [f.key]: v })} />
                ) : (
                  <AreaField label={f.label} hint={f.hint} value={c[f.key]} onChange={(v) => set({ [f.key]: v })} rows={f.rows} />
                );
                return (
                  <div key={f.key} className={cn(p !== undefined && 'grid gap-4 lg:grid-cols-2')}>
                    {field}
                    {p !== undefined && <Proposal value={p} onApply={() => apply(f.key)} onDismiss={() => dropFromDraft(f.key)} />}
                  </div>
                );
              })}
            </div>
          </Panel>

          {!!draft?.characters?.length && (
            <Panel
              title="Personnages proposés"
              description={newCharacters.length ? 'Ils seront créés dans la bible avec leur rôle et leur description, à compléter ensuite.' : 'Ils existent déjà tous dans la bible.'}
              actions={
                newCharacters.length > 0 && (
                  <Button size="sm" onClick={createCharacters} disabled={creating}>
                    {creating ? <Loader2 className="animate-spin" /> : <UserPlus />} Créer ces personnages
                  </Button>
                )
              }
            >
              <ul className="divide-y">
                {draft.characters.map((ch, i) => (
                  <li key={i} className="py-2.5 first:pt-0 last:pb-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{ch.name}</span>
                      {ch.role && <span className="rounded-sm bg-secondary px-1.5 py-0.5 text-xs">{ch.role}</span>}
                      {existing.has(ch.name?.trim().toLowerCase()) && <span className="text-xs text-muted-foreground">déjà dans la bible</span>}
                    </div>
                    {ch.description && <p className="text-sm text-muted-foreground">{ch.description}</p>}
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}

function Proposal({ value, onApply, onDismiss }: { value: string | unknown[]; onApply: () => void; onDismiss: () => void }) {
  return (
    <div className="space-y-1.5">
      <div className="flex h-5 items-center justify-between">
        <span className="flex items-center gap-1.5 text-sm font-medium">
          <Sparkles className="size-3.5" /> Proposition
        </span>
        <div className="flex gap-1">
          <Button size="xs" variant="ghost" onClick={onDismiss}>
            Écarter
          </Button>
          <Button size="xs" variant="outline" onClick={onApply}>
            <Check /> Appliquer
          </Button>
        </div>
      </div>
      <div className="max-h-72 overflow-y-auto rounded-md border border-dashed bg-secondary/40 px-3 py-2 text-sm whitespace-pre-wrap">
        {Array.isArray(value) ? (
          <div className="flex flex-wrap gap-1.5">
            {value.map((t, i) => (
              <span key={i} className="rounded-sm bg-background px-2 py-0.5">
                {String(t)}
              </span>
            ))}
          </div>
        ) : (
          toPlain(String(value))
        )}
      </div>
    </div>
  );
}
