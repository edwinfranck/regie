'use client';

import { DndContext, type DragEndEvent, DragOverlay, type DragStartEvent, KeyboardSensor, PointerSensor, useDraggable, useDroppable, useSensor, useSensors } from '@dnd-kit/core';
import { STAGE_LABELS, STAGES } from '@regie/core';
import { useQueryClient } from '@tanstack/react-query';
import { SquareKanban } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { EmptyState, PageHeader } from '@/components/common/page-header';
import { useShotImages } from '@/components/shots/shot-meta';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useProjectData, useProjectId } from '@/hooks/use-project';
import { patch, toastError } from '@/lib/client';
import { cn } from '@/lib/utils';

type Stage = (typeof STAGES)[number];

export default function ProductionPage() {
  const projectId = useProjectId();
  const qc = useQueryClient();
  const key = ['project', projectId, 'scenes'];
  const { data, isLoading } = useProjectData<{ scenes: any[] }>('scenes');
  const { imageOf } = useShotImages();
  const [dragging, setDragging] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor));
  const scenes = data?.scenes ?? [];

  async function move(sceneId: string, status: Stage) {
    const scene = scenes.find((s) => s.id === sceneId);
    if (!scene || scene.status === status) return;
    const prev = data;
    qc.setQueryData(key, (old: any) => ({ ...old, scenes: old.scenes.map((s: any) => (s.id === sceneId ? { ...s, status } : s)) }));
    try {
      await patch(`/api/projects/${projectId}/scenes/${sceneId}`, { status });
      qc.invalidateQueries({ queryKey: ['project', projectId, `scenes/${sceneId}`] });
    } catch (e) {
      qc.setQueryData(key, prev);
      toastError(e, 'Changement de statut refusé');
    }
  }

  const onDragStart = (e: DragStartEvent) => setDragging(String(e.active.id));
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setDragging(null);
    if (over) void move(String(active.id), over.id as Stage);
  };
  const active = scenes.find((s) => s.id === dragging);

  return (
    <div>
      <PageHeader title="Tableau de production" description="Les scènes par étape de fabrication. Glissez une carte d’une colonne à l’autre pour changer son statut." />
      <div className="p-8">
        {isLoading ? (
          <div className="grid grid-cols-6 gap-3">
            {STAGES.map((s) => (
              <Skeleton key={s} className="h-80" />
            ))}
          </div>
        ) : !scenes.length ? (
          <EmptyState
            icon={SquareKanban}
            title="Aucune scène"
            description="Le tableau suit l’avancement des scènes : créez-les d’abord."
            action={
              <Button asChild variant="outline">
                <Link href={`/projects/${projectId}/scenes`}>Aller aux scènes</Link>
              </Button>
            }
          />
        ) : (
          <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
            <div className="grid auto-cols-[minmax(170px,1fr)] grid-flow-col gap-3 overflow-x-auto pb-2">
              {STAGES.map((stage) => {
                const list = scenes.filter((s) => s.status === stage);
                return (
                  <Column key={stage} stage={stage} count={list.length}>
                    {list.map((s) => (
                      <SceneCard key={s.id} scene={s} imageOf={imageOf} ghost={dragging === s.id} />
                    ))}
                  </Column>
                );
              })}
            </div>
            <DragOverlay>{active && <CardBody scene={active} imageOf={imageOf} lifted />}</DragOverlay>
          </DndContext>
        )}
      </div>
    </div>
  );
}

function Column({ stage, count, children }: { stage: Stage; count: number; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  return (
    <section ref={setNodeRef} className={cn('flex min-h-[60vh] flex-col rounded-md border bg-muted/40 transition-colors', isOver && 'border-foreground bg-accent')}>
      <header className="flex items-center justify-between border-b px-3 py-2.5">
        <h2 className="text-sm font-medium">{STAGE_LABELS[stage]}</h2>
        <span className="text-xs text-muted-foreground tabular-nums">{count}</span>
      </header>
      <div className="flex-1 space-y-2 p-2">{children}</div>
    </section>
  );
}

function SceneCard({ scene, imageOf, ghost }: { scene: any; imageOf: (s: any) => string | null; ghost: boolean }) {
  const { attributes, listeners, setNodeRef } = useDraggable({ id: scene.id });
  return (
    <div ref={setNodeRef} {...attributes} {...listeners} className={cn('cursor-grab touch-none active:cursor-grabbing', ghost && 'opacity-30')}>
      <CardBody scene={scene} imageOf={imageOf} />
    </div>
  );
}

function CardBody({ scene, imageOf, lifted }: { scene: any; imageOf: (s: any) => string | null; lifted?: boolean }) {
  const projectId = useProjectId();
  const total = scene.shots.length;
  const done = scene.shots.filter((s: any) => imageOf(s)).length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className={cn('space-y-2 rounded-md border bg-card p-3', lifted && 'shadow-md')}>
      <div className="flex items-baseline gap-2">
        <span className="font-semibold tabular-nums">{scene.number}</span>
        <Link href={`/projects/${projectId}/scenes/${scene.id}`} className="min-w-0 flex-1 truncate text-sm hover:underline" onPointerDown={(e) => e.stopPropagation()}>
          {scene.title || 'Scène sans titre'}
        </Link>
      </div>
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>
            {total} plan{total > 1 ? 's' : ''}
          </span>
          <span className="tabular-nums" title="Plans qui ont une image">
            {total ? `${done}/${total} images` : 'à découper'}
          </span>
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-border">
          <div className={cn('h-full', pct === 100 ? 'bg-success' : 'bg-foreground')} style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}
