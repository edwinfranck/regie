'use client';

import { ArrowRight, Loader2, ShieldAlert, ShieldCheck, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useModels, usable } from '@/components/common/model-picker';
import { PageHeader, Panel } from '@/components/common/page-header';
import { IssueList, type IssueLike, LEVEL } from '@/components/common/status';
import { fmtDuration } from '@/components/shots/shot-meta';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useAiTask } from '@/hooks/use-ai';
import { useProjectData, useProjectId } from '@/hooks/use-project';
import { cn } from '@/lib/utils';

interface Issue extends IssueLike {
  code: string;
  entity?: { type: 'character' | 'location' | 'prop' | 'scene' | 'shot' | 'project'; id: string };
}
interface LintResult {
  issues: Issue[];
  totalSeconds: number;
  counts: Record<'error' | 'warning' | 'info', number>;
  blocking: number;
}

const LEVELS = ['error', 'warning', 'info'] as const;
const GROUP_TITLES = { error: 'Erreurs', warning: 'Avertissements', info: 'Informations' };

export default function ContinuityPage() {
  const projectId = useProjectId();
  const { data, isLoading, refetch, isFetching } = useProjectData<LintResult>('lint');
  const { data: shots } = useProjectData<{ id: string; sceneId: string }[]>('shots');
  const { data: text = [] } = useModels('TEXT');
  const canAi = text.some(usable);
  const [levels, setLevels] = useState<string[]>([...LEVELS]);
  const [aiIssues, setAiIssues] = useState<IssueLike[] | null>(null);
  const ai = useAiTask<{ issues: IssueLike[] }>('continuity', { onSuccess: (d) => setAiIssues((d.issues ?? []).filter((i) => i.level in LEVEL)) });

  const sceneOf = new Map((shots ?? []).map((s) => [s.id, s.sceneId]));
  const base = `/projects/${projectId}`;
  const hrefOf = (e?: Issue['entity']) => {
    if (!e) return null;
    switch (e.type) {
      case 'character':
        return `${base}/characters/${e.id}`;
      case 'location':
        return `${base}/locations/${e.id}`;
      case 'prop':
        return `${base}/props`;
      case 'scene':
        return `${base}/scenes/${e.id}`;
      case 'shot':
        return sceneOf.get(e.id) ? `${base}/scenes/${sceneOf.get(e.id)}?shot=${e.id}` : null;
      case 'project':
        return `${base}/settings`;
    }
  };

  const issues = data?.issues ?? [];
  const blocking = issues.filter((i) => i.blocking);
  const rest = issues.filter((i) => !i.blocking && levels.includes(i.level));

  return (
    <div>
      <PageHeader
        title="Continuité"
        description="Le contrôle déterministe de la bible et du découpage, recalculé à chaque visite, puis une lecture par l’IA de ce que seul le texte révèle."
        actions={
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? <Loader2 className="animate-spin" /> : <ShieldCheck />} Relancer le contrôle
          </Button>
        }
      />
      <div className="space-y-8 p-8">
        {isLoading || !data ? (
          <Skeleton className="h-64" />
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-6">
              {LEVELS.map((l) => {
                const L = LEVEL[l];
                return (
                  <div key={l} className="flex items-center gap-2">
                    <L.icon className={cn('size-5', L.className)} />
                    <span className="text-2xl font-semibold tabular-nums">{data.counts[l] ?? 0}</span>
                    <span className="text-sm text-muted-foreground">{GROUP_TITLES[l].toLowerCase()}</span>
                  </div>
                );
              })}
              <div className="flex items-center gap-2">
                <span className="text-2xl font-semibold tabular-nums">{data.blocking}</span>
                <span className="text-sm text-muted-foreground">bloquant{data.blocking > 1 ? 's' : ''}</span>
              </div>
              <span className="text-sm text-muted-foreground">Durée découpée : {fmtDuration(data.totalSeconds)}</span>
            </div>

            {blocking.length > 0 && (
              <section className="space-y-3 rounded-md border border-destructive/40 bg-destructive/5 p-4">
                <h2 className="flex items-center gap-2 font-medium text-destructive">
                  <ShieldAlert className="size-4" /> À régler avant de générer ({blocking.length})
                </h2>
                <IssueRows issues={blocking} hrefOf={hrefOf} />
              </section>
            )}

            <section className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-medium">Contrôle déterministe</h2>
                <ToggleGroup type="multiple" variant="outline" size="sm" value={levels} onValueChange={setLevels} aria-label="Filtrer par niveau">
                  {LEVELS.map((l) => (
                    <ToggleGroupItem key={l} value={l} className="px-3">
                      {GROUP_TITLES[l]} <span className="text-muted-foreground tabular-nums">{issues.filter((i) => !i.blocking && i.level === l).length}</span>
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>
              {!issues.length ? (
                <p className="rounded-md border px-4 py-6 text-sm text-muted-foreground">Rien à signaler : la bible et le découpage sont cohérents.</p>
              ) : (
                LEVELS.filter((l) => levels.includes(l)).map((l) => {
                  const list = rest.filter((i) => i.level === l);
                  if (!list.length) return null;
                  return (
                    <Panel key={l} title={`${GROUP_TITLES[l]} (${list.length})`}>
                      <IssueRows issues={list} hrefOf={hrefOf} />
                    </Panel>
                  );
                })
              )}
            </section>
          </>
        )}

        <section className="space-y-4 border-t pt-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="space-y-1">
              <h2 className="font-medium">Analyse IA</h2>
              <p className="max-w-3xl text-sm text-muted-foreground">Une lecture du scénario et du découpage par un modèle de langage : vêtements, blessures, coiffure, météo, chronologie. Ce sont des pistes à vérifier, pas des certitudes, et elles ne sont pas enregistrées.</p>
            </div>
            <Button variant="outline" onClick={() => ai.mutate({})} disabled={!canAi || ai.isPending}>
              {ai.isPending ? <Loader2 className="animate-spin" /> : <Sparkles />} {aiIssues ? 'Relancer l’analyse' : 'Lancer l’analyse'}
            </Button>
          </div>
          {!canAi ? (
            <p className="text-sm text-muted-foreground">Aucun modèle de texte configuré : ajoutez un provider dans les réglages pour lancer l’analyse.</p>
          ) : ai.isPending ? (
            <p className="text-sm text-muted-foreground">Lecture du projet en cours…</p>
          ) : aiIssues ? (
            <div className="rounded-md border border-dashed p-4">
              <IssueList issues={aiIssues} empty="Le modèle n’a relevé aucune incohérence." />
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}

function IssueRows({ issues, hrefOf }: { issues: Issue[]; hrefOf: (e?: Issue['entity']) => string | null }) {
  return (
    <ul className="divide-y">
      {issues.map((i, n) => {
        const L = LEVEL[i.level];
        const href = hrefOf(i.entity);
        return (
          <li key={`${i.code}-${i.where}-${n}`} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
            <L.icon className={cn('mt-0.5 size-4 shrink-0', L.className)} />
            <div className="min-w-0 flex-1 text-sm">
              <p>
                <span className="font-medium">{i.where}</span> — {i.message}
              </p>
              {i.fix && <p className="text-muted-foreground">{i.fix}</p>}
            </div>
            {href && (
              <Button size="xs" variant="ghost" asChild>
                <Link href={href}>
                  Ouvrir <ArrowRight />
                </Link>
              </Button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
