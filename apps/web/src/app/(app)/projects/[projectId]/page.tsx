'use client';

import { KIND_LABELS, STAGE_LABELS, STAGES } from '@regie/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Check, Circle, CircleDot, ImageIcon, ShieldCheck, Star } from 'lucide-react';
import Link from 'next/link';
import { Choice } from '@/components/common/choice';
import { AssetThumb } from '@/components/common/media';
import { EmptyState, PageHeader, Panel } from '@/components/common/page-header';
import { IssueList, LEVEL, StatusPill } from '@/components/common/status';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useBible, useProject, useProjectData, useProjectId } from '@/hooks/use-project';
import { get, patch, post, toastError } from '@/lib/client';
import { cn, fmtDuration, fmtRelative } from '@/lib/utils';

type State = 'todo' | 'partial' | 'done';
interface Step {
  href: string;
  label: string;
  state: State;
  detail: string;
}

type Status = Omit<Step, 'href' | 'label'>;

const STATE_ICON: Record<State, React.ComponentType<{ className?: string }>> = { todo: Circle, partial: CircleDot, done: Check };
const STATE_LABEL: Record<State, string> = { todo: 'À faire', partial: 'En cours', done: 'Fait' };

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n > 1 ? many : one}`;

export default function ProjectOverviewPage() {
  const projectId = useProjectId();
  const qc = useQueryClient();
  const { data: project, isLoading } = useProject();
  const { data: lint } = useProjectData('lint');
  const { data: story } = useProjectData('story');
  const { data: script } = useProjectData('script');
  const { data: scenesData } = useProjectData('scenes');
  const { data: characters } = useBible('characters');
  const { data: locations } = useBible('locations');
  // Les clés commencent par 'generations' : le temps réel les tient à jour.
  const { data: recent } = useQuery({ queryKey: ['generations', projectId, 'recent'], queryFn: () => get(`/api/projects/${projectId}/generations?take=8`) });

  async function update(p: Record<string, unknown>) {
    qc.setQueryData(['project', projectId], (old: any) => ({ ...old, ...p }));
    try {
      await patch(`/api/projects/${projectId}`, p);
    } catch (e) {
      toastError(e);
      qc.invalidateQueries({ queryKey: ['project', projectId] });
    }
  }

  async function toggleFavorite() {
    try {
      const r = await post(`/api/projects/${projectId}/favorite`);
      qc.setQueryData(['project', projectId], (old: any) => ({ ...old, favorite: r.favorite }));
      qc.invalidateQueries({ queryKey: ['projects'] });
    } catch (e) {
      toastError(e);
    }
  }

  if (isLoading || !project)
    return (
      <div className="space-y-6 p-8">
        <Skeleton className="h-10 w-80" />
        <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
          <Skeleton className="h-[480px]" />
          <Skeleton className="h-[480px]" />
        </div>
      </div>
    );

  const steps = computeSteps({ projectId, project, story, script, scenes: scenesData?.scenes, characters, locations, imageCount: project?.assetCounts?.IMAGE, videoCount: project?.assetCounts?.VIDEO, lint });
  const done = steps.filter((s) => s.state === 'done').length;
  const next = steps.find((s) => s.state !== 'done');
  const shownIssues = (lint?.issues ?? []).slice(0, 5);

  return (
    <div>
      <PageHeader
        title={project.title}
        description={
          <>
            {KIND_LABELS[project.kind as keyof typeof KIND_LABELS] ?? project.kind} · {project.aspectRatio}
            {lint?.totalSeconds ? ` · ${fmtDuration(lint.totalSeconds)} découpées` : ''}
          </>
        }
        actions={
          <>
            <Choice value={project.stage} onChange={(v) => v && update({ stage: v })} options={STAGES.map((s) => ({ value: s, label: STAGE_LABELS[s] }))} className="w-48" />
            <Button variant="outline" onClick={toggleFavorite} aria-pressed={project.favorite} title={project.favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}>
              <Star className={cn(project.favorite && 'fill-current')} /> {project.favorite ? 'Favori' : 'Mettre en favori'}
            </Button>
          </>
        }
      />

      <div className="grid gap-6 p-8 xl:grid-cols-[1fr_400px]">
        <Panel
          title="Parcours de fabrication"
          description={`${done} étape${done > 1 ? 's' : ''} sur ${steps.length} terminée${done > 1 ? 's' : ''}.`}
          actions={
            next && (
              <Button size="sm" asChild>
                <Link href={next.href}>
                  Continuer : {next.label} <ArrowRight />
                </Link>
              </Button>
            )
          }
          className="min-w-0"
        >
          <ol className="-my-1">
            {steps.map((s, i) => {
              const Icon = STATE_ICON[s.state];
              return (
                <li key={s.href}>
                  <Link href={s.href} className="group flex items-center gap-4 rounded-md px-2 py-2.5 hover:bg-accent">
                    <span
                      className={cn(
                        'flex size-7 shrink-0 items-center justify-center rounded-full border text-xs',
                        s.state === 'done' && 'border-foreground bg-foreground text-background',
                        s.state === 'partial' && 'border-foreground',
                        s.state === 'todo' && 'text-muted-foreground',
                      )}
                      title={STATE_LABEL[s.state]}
                    >
                      {s.state === 'done' ? <Icon className="size-3.5" /> : i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{s.label}</div>
                      <div className="truncate text-sm text-muted-foreground">{s.detail}</div>
                    </div>
                    <span className={cn('shrink-0 rounded-sm px-1.5 py-0.5 text-xs', s.state === 'done' ? 'bg-success/15 text-success' : s.state === 'partial' ? 'bg-warning/15 text-warning' : 'bg-secondary text-muted-foreground')}>{STATE_LABEL[s.state]}</span>
                    <ArrowRight className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </Link>
                </li>
              );
            })}
          </ol>
        </Panel>

        <div className="space-y-6">
          <Panel
            title="Contrôle"
            description="Bible, découpage et continuité, vérifiés à chaque affichage."
            actions={
              <Button size="sm" variant="ghost" asChild>
                <Link href={`/projects/${projectId}/continuity`}>Tout voir</Link>
              </Button>
            }
          >
            {!lint ? (
              <Skeleton className="h-32" />
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-2">
                  <Counter label="Erreurs" value={lint.counts?.error ?? 0} className={LEVEL.error.className} />
                  <Counter label="Avertissements" value={lint.counts?.warning ?? 0} className={LEVEL.warning.className} />
                  <Counter label="Bloquants" value={lint.blocking ?? 0} className={LEVEL.error.className} />
                </div>
                {shownIssues.length ? (
                  <>
                    <IssueList issues={shownIssues} compact />
                    {lint.issues.length > shownIssues.length && <p className="text-sm text-muted-foreground">Et {plural(lint.issues.length - shownIssues.length, 'autre problème', 'autres problèmes')}.</p>}
                  </>
                ) : (
                  <p className="flex items-center gap-2 text-sm text-success">
                    <ShieldCheck className="size-4" /> Rien à signaler.
                  </p>
                )}
              </div>
            )}
          </Panel>

          <Panel
            title="Générations récentes"
            actions={
              <Button size="sm" variant="ghost" asChild>
                <Link href={`/projects/${projectId}/assets`}>Assets</Link>
              </Button>
            }
          >
            {!recent ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-12" />
                ))}
              </div>
            ) : !recent.items?.length ? (
              <EmptyState icon={ImageIcon} title="Aucune génération" description="Les images et vidéos lancées depuis le projet apparaîtront ici." className="py-8" />
            ) : (
              <ul className="space-y-2">
                {recent.items.map((g: any) => (
                  <li key={g.id} className="flex items-center gap-3">
                    <AssetThumb asset={g.outputs?.[0] ?? null} ratio="16:9" className="w-20 shrink-0 rounded-sm border" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm" title={g.prompt}>
                        {g.shot?.code ? <span className="mr-1 font-mono text-xs">{g.shot.code}</span> : null}
                        {g.prompt}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {g.model?.label ?? 'Modèle retiré'} · {fmtRelative(g.createdAt)}
                      </p>
                    </div>
                    <StatusPill status={g.status} progress={g.progress} />
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Counter({ label, value, className }: { label: string; value: number; className?: string }) {
  return (
    <div className="rounded-md border px-3 py-2">
      <div className={cn('text-2xl font-semibold tabular-nums', value ? className : 'text-muted-foreground')}>{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

// L'état de chaque étape se lit dans les données : rien n'est coché à la main.
function computeSteps(d: { projectId: string; project: any; story?: any; script?: any; scenes?: any[]; characters?: any[]; locations?: any[]; imageCount?: number; videoCount?: number; lint?: any }): Step[] {
  const base = `/projects/${d.projectId}`;
  const c = d.project.concept ?? {};
  const loading = '…';

  const concept: Status = (() => {
    if (c.logline?.trim() && c.synopsisShort?.trim()) return { state: 'done', detail: 'Logline et synopsis écrits' } as Status;
    if (c.logline?.trim() || c.idea?.trim() || c.synopsisShort?.trim()) return { state: 'partial', detail: c.logline?.trim() ? 'Logline écrite, synopsis à écrire' : 'Idée notée, logline et synopsis à écrire' } as Status;
    return { state: 'todo', detail: 'L’idée, la logline, le synopsis' } as Status;
  })();

  const beats: any[] = d.story?.beats ?? [];
  const written = beats.filter((b) => b.description?.trim()).length;
  const story: Status = !d.story
    ? { state: 'todo', detail: loading } as Status
    : { state: beats.length && written === beats.length ? 'done' : written ? 'partial' : 'todo', detail: beats.length ? `${written} temps fort${written > 1 ? 's' : ''} écrit${written > 1 ? 's' : ''} sur ${beats.length}` : 'Choisir une structure' } as Status;

  const bibleStep = (rows: any[] | undefined, noun: string, nouns: string, missing: string): Status => {
    if (!rows) return { state: 'todo', detail: loading };
    if (!rows.length) return { state: 'todo', detail: `Aucun ${noun}` };
    const without = rows.filter((r) => !r.refAssetId).length;
    return { state: without ? 'partial' : 'done', detail: `${plural(rows.length, noun, nouns)}${without ? ` dont ${without} ${missing}` : ', tous avec référence'}` };
  };

  const fountain: string = d.script?.fountain ?? '';
  const words = fountain.trim() ? fountain.trim().split(/\s+/).length : 0;
  const script: Status = { state: words > 200 ? 'done' : words ? 'partial' : 'todo', detail: d.script ? (words ? `${words} mots` : 'Page blanche') : loading } as Status;

  const scenes = d.scenes ?? [];
  const shots = scenes.flatMap((s) => s.shots ?? []);
  const cut = scenes.filter((s) => s.shots?.length).length;
  const scenesStep: Status = { state: scenes.length && cut === scenes.length ? 'done' : scenes.length ? 'partial' : 'todo', detail: d.scenes ? (scenes.length ? `${plural(scenes.length, 'scène')} · ${plural(shots.length, 'plan')}${cut < scenes.length ? ` · ${scenes.length - cut} à découper` : ''}` : 'Aucune scène') : loading } as Status;

  const framed = shots.filter((s) => s.frameAssetId || s.frameAsset).length;
  const board: Status = { state: shots.length && framed === shots.length ? 'done' : framed ? 'partial' : 'todo', detail: shots.length ? `${framed} plan${framed > 1 ? 's' : ''} sur ${shots.length} avec une image` : 'Aucun plan découpé' } as Status;

  const img = d.imageCount ?? 0;
  const vid = d.videoCount ?? 0;
  const imagesStep: Status = { state: img && shots.length && framed === shots.length ? 'done' : img ? 'partial' : 'todo', detail: d.project ? (img ? `${img} image${img > 1 ? 's' : ''} dans les assets` : 'Aucune image') : loading } as Status;
  const videosStep: Status = { state: vid && shots.length && vid >= shots.length ? 'done' : vid ? 'partial' : 'todo', detail: d.project ? (vid ? `${vid} vidéo${vid > 1 ? 's' : ''}${shots.length ? ` pour ${plural(shots.length, 'plan')}` : ''}` : 'Aucune vidéo') : loading } as Status;

  const blocking = d.lint?.blocking ?? 0;
  const exportStep: Status = { state: shots.length && !blocking ? 'done' : shots.length ? 'partial' : 'todo', detail: !d.lint ? loading : !shots.length ? 'Rien à exporter pour l’instant' : blocking ? `${plural(blocking, 'problème bloquant', 'problèmes bloquants')}` : 'Prêt à exporter' } as Status;

  return [
    { href: `${base}/concept`, label: 'Concept', ...concept },
    { href: `${base}/story`, label: 'Histoire', ...story },
    { href: `${base}/characters`, label: 'Personnages', ...bibleStep(d.characters, 'personnage', 'personnages', 'sans feuille') },
    { href: `${base}/locations`, label: 'Lieux', ...bibleStep(d.locations, 'lieu', 'lieux', 'sans plaque') },
    { href: `${base}/script`, label: 'Scénario', ...script },
    { href: `${base}/scenes`, label: 'Scènes', ...scenesStep },
    { href: `${base}/storyboard`, label: 'Storyboard', ...board },
    { href: `${base}/images`, label: 'Images', ...imagesStep },
    { href: `${base}/videos`, label: 'Vidéos', ...videosStep },
    { href: `${base}/export`, label: 'Export', ...exportStep },
  ];
}
