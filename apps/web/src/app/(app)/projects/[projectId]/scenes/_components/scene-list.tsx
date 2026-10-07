'use client';

import { STAGE_LABELS, toPlain } from '@regie/core';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Code } from '@/components/common/status';
import { DragHandle } from '@/components/shots/sortable';
import { IMPORTANCE_LABELS, fmtDuration, sceneHeading, shotsSeconds } from '@/components/shots/shot-meta';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useProjectId } from '@/hooks/use-project';
import { cn } from '@/lib/utils';

/** Trois crans, pleins selon l'importance. */
export function Importance({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" title={`Importance : ${IMPORTANCE_LABELS[value] ?? value}`}>
      {[1, 2, 3].map((n) => (
        <span key={n} className={cn('h-2.5 w-1.5 rounded-[1px]', n <= value ? 'bg-foreground' : 'bg-border')} />
      ))}
    </span>
  );
}

export function StageBadge({ status }: { status: string }) {
  return <span className={cn('rounded-sm px-1.5 py-0.5 text-xs', status === 'COMPLETED' ? 'bg-success/15 text-success' : status === 'IDEA' ? 'bg-secondary' : 'bg-foreground text-background')}>{STAGE_LABELS[status as keyof typeof STAGE_LABELS] ?? status}</span>;
}

function castOf(scene: any, codeOf: Map<string, string>) {
  return scene.characters.map((c: any) => codeOf.get(c.characterId)).filter(Boolean) as string[];
}

export function SceneRow({ scene, codeOf }: { scene: any; codeOf: Map<string, string> }) {
  const projectId = useProjectId();
  const cast = castOf(scene, codeOf);
  const shotsSec = shotsSeconds(scene.shots);
  return (
    <div className="flex items-stretch rounded-md border bg-card transition-colors hover:border-foreground/40">
      <div className="flex items-center px-2">
        <DragHandle />
      </div>
      <Link href={`/projects/${projectId}/scenes/${scene.id}`} className="grid min-w-0 flex-1 grid-cols-[3rem_1fr_auto] items-center gap-4 py-3 pr-4">
        <span className="text-2xl font-semibold tabular-nums">{scene.number}</span>
        <div className="min-w-0 space-y-1">
          <p className="truncate font-mono text-xs text-muted-foreground">{sceneHeading(scene)}</p>
          <p className="truncate font-medium">{scene.title || 'Scène sans titre'}</p>
          {scene.description && <p className="line-clamp-1 text-sm text-muted-foreground">{toPlain(scene.description)}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-5 text-sm">
          <div className="flex max-w-48 flex-wrap justify-end gap-1">
            {cast.length ? cast.map((c) => <Code key={c}>{c}</Code>) : <span className="text-xs text-muted-foreground">sans distribution</span>}
          </div>
          <div className="w-20 text-right">
            <p className="tabular-nums">{scene.shots.length} plan{scene.shots.length > 1 ? 's' : ''}</p>
            <p className="text-xs text-muted-foreground tabular-nums" title={shotsSec ? `Somme des plans : ${fmtDuration(shotsSec)}` : undefined}>
              {fmtDuration(scene.estSeconds ?? (shotsSec || null))}
            </p>
          </div>
          <Importance value={scene.importance} />
          <div className="w-28 text-right">
            <StageBadge status={scene.status} />
          </div>
        </div>
      </Link>
    </div>
  );
}

export function SceneTable({ scenes, codeOf }: { scenes: any[]; codeOf: Map<string, string> }) {
  const projectId = useProjectId();
  const router = useRouter();
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">N°</TableHead>
            <TableHead>En-tête</TableHead>
            <TableHead>Titre</TableHead>
            <TableHead>Personnages</TableHead>
            <TableHead className="text-right">Plans</TableHead>
            <TableHead className="text-right">Durée estimée</TableHead>
            <TableHead className="text-right">Somme des plans</TableHead>
            <TableHead>Importance</TableHead>
            <TableHead>Statut</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {scenes.map((s) => (
            <TableRow key={s.id} className="cursor-pointer" onClick={() => router.push(`/projects/${projectId}/scenes/${s.id}`)}>
              <TableCell className="font-medium tabular-nums">{s.number}</TableCell>
              <TableCell className="font-mono text-xs">{sceneHeading(s)}</TableCell>
              <TableCell className="max-w-64 truncate">{s.title || '—'}</TableCell>
              <TableCell className="font-mono text-xs">{castOf(s, codeOf).join(', ') || '—'}</TableCell>
              <TableCell className="text-right tabular-nums">{s.shots.length}</TableCell>
              <TableCell className="text-right tabular-nums">{fmtDuration(s.estSeconds)}</TableCell>
              <TableCell className="text-right tabular-nums">{fmtDuration(shotsSeconds(s.shots))}</TableCell>
              <TableCell>
                <Importance value={s.importance} />
              </TableCell>
              <TableCell>
                <StageBadge status={s.status} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
