'use client';

import { closestCenter, DndContext, type DragEndEvent, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { STRUCTURES, structureById } from '@regie/core';
import { useQueryClient } from '@tanstack/react-query';
import { Check, GripVertical, ListTree, Loader2, Plus, Sparkles, Trash2, Waypoints, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Choice } from '@/components/common/choice';
import { IconLabel } from '@/components/common/icon-label';
import { RichField } from '@/components/common/rich-field';
import { usable, useModels } from '@/components/common/model-picker';
import { EmptyState, PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAiTask } from '@/hooks/use-ai';
import { useAutosave } from '@/hooks/use-autosave';
import { useProjectData, useProjectId } from '@/hooks/use-project';
import { put, toastError } from '@/lib/client';
import { cn } from '@/lib/utils';

interface Beat {
  id?: string;
  key: string;
  title: string;
  description: string;
  sceneId: string | null;
}

const fromServer = (beats: any[] = []): Beat[] => beats.map((b) => ({ id: b.id, key: b.key, title: b.title, description: b.description ?? '', sceneId: b.sceneId ?? null }));
// Une clé unique côté client : elle permet de retrouver l'id attribué par le serveur.
const newKey = () => `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export default function StoryPage() {
  const projectId = useProjectId();
  const qc = useQueryClient();
  const key = ['project', projectId, 'story'];
  const { data: story, isLoading } = useProjectData('story');
  const { data: scenesData } = useProjectData('scenes');
  const { data: text = [] } = useModels('TEXT');
  const canDraft = text.some(usable);
  const [beats, setBeats] = useState<Beat[] | null>(null);
  const [proposal, setProposal] = useState<Record<string, string> | null>(null);
  const [switching, setSwitching] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    if (story && !loaded.current) {
      loaded.current = true;
      setBeats(fromServer(story.beats));
    }
  }, [story]);

  const { queue, flush } = useAutosave<{ beats: Beat[] }>(async (p) => {
    if (!p.beats) return;
    const saved: any[] = await put(`/api/projects/${projectId}/story/beats`, {
      beats: p.beats.map((b) => ({ id: b.id, key: b.key, title: b.title.trim() || 'Sans titre', description: b.description, sceneId: b.sceneId })),
    });
    // Les temps forts créés reçoivent leur id : sans lui, le prochain envoi les recréerait.
    const ids = new Map(saved.map((b) => [b.key, b.id]));
    setBeats((cur) => cur?.map((b) => (b.id ? b : { ...b, id: ids.get(b.key) })) ?? cur);
    qc.setQueryData(key, (old: any) => (old ? { ...old, beats: saved } : old));
    qc.invalidateQueries({ queryKey: ['project', projectId], exact: true });
  });

  const commit = (next: Beat[]) => {
    setBeats(next);
    queue({ beats: next });
  };
  const edit = (i: number, p: Partial<Beat>) => beats && commit(beats.map((b, j) => (j === i ? { ...b, ...p } : b)));

  const ai = useAiTask<{ beats: { key: string; description: string }[] }>('beats', {
    onSuccess: (d) => setProposal(Object.fromEntries((d?.beats ?? []).filter((b) => b?.key && b.description?.trim()).map((b) => [b.key, b.description]))),
  });

  async function changeStructure(structure: string) {
    setSwitching(true);
    try {
      await flush();
      const row = await put(`/api/projects/${projectId}/story`, { structure });
      qc.setQueryData(key, row);
      setBeats(fromServer(row.beats));
      setProposal(null);
    } catch (e) {
      toastError(e);
    } finally {
      setSwitching(false);
    }
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const onDragEnd = (e: DragEndEvent) => {
    if (!beats || !e.over || e.active.id === e.over.id) return;
    const from = beats.findIndex((b) => b.key === e.active.id);
    const to = beats.findIndex((b) => b.key === e.over!.id);
    if (from >= 0 && to >= 0) commit(arrayMove(beats, from, to));
  };

  if (isLoading || !story || !beats)
    return (
      <div className="space-y-4 p-8">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-16 max-w-xl" />
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-36 max-w-4xl" />
        ))}
      </div>
    );

  const tpl = structureById(story.structure);
  const hint = (k: string) => tpl.beats.find((b) => b.key === k)?.hint;
  const scenes: any[] = scenesData?.scenes ?? [];
  const sceneOptions = scenes.map((s) => ({ value: s.id, label: `Scène ${s.number}${s.title ? ` — ${s.title}` : ''}` }));
  const proposed = proposal ? beats.filter((b) => proposal[b.key]) : [];

  return (
    <div>
      <PageHeader
        title="Histoire"
        description="La charpente du récit : les temps forts, dans l’ordre, rattachés aux scènes qui les portent."
        actions={
          <Button onClick={() => ai.mutate({ structure: story.structure })} disabled={!canDraft || ai.isPending || !beats.length} title={canDraft ? undefined : 'Aucun modèle de texte configuré'}>
            {ai.isPending ? <Loader2 className="animate-spin" /> : <Sparkles />} {ai.isPending ? 'L’IA écrit…' : 'Proposer le contenu des temps forts'}
          </Button>
        }
      />

      <div className="max-w-4xl space-y-6 p-8">
        <div className="flex flex-wrap items-end gap-4">
          <Choice label={<IconLabel icon={Waypoints}>Structure</IconLabel>} value={story.structure} onChange={(v) => v && v !== story.structure && changeStructure(v)} options={STRUCTURES.map((s) => ({ value: s.id, label: s.label }))} className="w-64" disabled={switching} />
          <p className="pb-2 text-sm text-muted-foreground">
            {switching ? 'Changement de structure…' : tpl.description} {!switching && 'Changer de structure garde les temps forts déjà écrits.'}
          </p>
        </div>

        {proposal && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-foreground/30 bg-secondary/50 px-4 py-3">
            <p className="text-sm">
              <span className="font-medium">Proposition de l’IA.</span> {proposed.length ? `${proposed.length} temps fort${proposed.length > 1 ? 's' : ''} à relire.` : 'Tout a été appliqué ou écarté.'}
            </p>
            <div className="flex gap-2">
              {proposed.length > 0 && (
                <Button
                  size="sm"
                  onClick={() => {
                    commit(beats.map((b) => (proposal[b.key] ? { ...b, description: proposal[b.key] } : b)));
                    setProposal({});
                  }}
                >
                  <Check /> Tout appliquer
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => setProposal(null)}>
                <X /> Fermer
              </Button>
            </div>
          </div>
        )}

        {!beats.length ? (
          <EmptyState
            icon={ListTree}
            title="Aucun temps fort"
            description={story.structure === 'CUSTOM' ? 'Une structure personnalisée part de zéro : ajoutez vos temps forts.' : 'Choisissez une structure pour obtenir ses temps forts, ou ajoutez les vôtres.'}
            action={
              <Button onClick={() => commit([{ key: newKey(), title: 'Nouveau temps fort', description: '', sceneId: null }])}>
                <Plus /> Ajouter un temps fort
              </Button>
            }
          />
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={beats.map((b) => b.key)} strategy={verticalListSortingStrategy}>
              <ol className="relative space-y-3">
                {/* Le fil de la timeline, derrière les pastilles. */}
                <span aria-hidden className="absolute top-4 bottom-4 left-[15px] w-px bg-border" />
                {beats.map((b, i) => (
                  <BeatItem
                    key={b.key}
                    beat={b}
                    index={i}
                    hint={hint(b.key)}
                    sceneOptions={sceneOptions}
                    proposal={proposal?.[b.key]}
                    onChange={(p) => edit(i, p)}
                    onRemove={() => commit(beats.filter((_, j) => j !== i))}
                    onApply={() => {
                      edit(i, { description: proposal![b.key] });
                      setProposal((cur) => (cur ? { ...cur, [b.key]: '' } : cur));
                    }}
                    onDismiss={() => setProposal((cur) => (cur ? { ...cur, [b.key]: '' } : cur))}
                  />
                ))}
              </ol>
            </SortableContext>
          </DndContext>
        )}

        {beats.length > 0 && (
          <Button variant="outline" onClick={() => commit([...beats, { key: newKey(), title: 'Nouveau temps fort', description: '', sceneId: null }])} disabled={beats.length >= 60}>
            <Plus /> Ajouter un temps fort
          </Button>
        )}
      </div>
    </div>
  );
}

function BeatItem({
  beat,
  index,
  hint,
  sceneOptions,
  proposal,
  onChange,
  onRemove,
  onApply,
  onDismiss,
}: {
  beat: Beat;
  index: number;
  hint?: string;
  sceneOptions: { value: string; label: string }[];
  proposal?: string;
  onChange: (p: Partial<Beat>) => void;
  onRemove: () => void;
  onApply: () => void;
  onDismiss: () => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: beat.key });
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition }} className={cn('relative flex gap-4', isDragging && 'z-10 opacity-80')}>
      <span className={cn('relative z-[1] mt-3 flex size-8 shrink-0 items-center justify-center rounded-full border bg-background text-sm font-medium tabular-nums', beat.description.trim() && 'border-foreground bg-foreground text-background')}>{index + 1}</span>
      <div className="min-w-0 flex-1 space-y-3 rounded-md border bg-card p-4">
        <div className="flex items-center gap-2">
          <button ref={setActivatorNodeRef} {...attributes} {...listeners} className="cursor-grab text-muted-foreground hover:text-foreground active:cursor-grabbing" aria-label="Déplacer">
            <GripVertical className="size-4" />
          </button>
          <input value={beat.title} onChange={(e) => onChange({ title: e.target.value })} className="min-w-0 flex-1 bg-transparent font-medium outline-none" aria-label="Titre du temps fort" placeholder="Titre" />
          <Choice value={beat.sceneId} onChange={(v) => onChange({ sceneId: v })} options={sceneOptions} allowNone noneLabel="Aucune scène" placeholder="Rattacher à une scène" className="w-56" disabled={!sceneOptions.length} />
          <Button variant="ghost" size="icon-sm" onClick={onRemove} aria-label="Supprimer le temps fort" className="text-muted-foreground hover:text-destructive">
            <Trash2 />
          </Button>
        </div>
        <RichField value={beat.description} onChange={(v) => onChange({ description: v })} placeholder={hint || 'Ce qui se passe à ce moment du récit.'} minHeight={70} />
        {proposal && (
          <div className="space-y-1.5 rounded-md border border-dashed bg-secondary/40 p-3">
            <div className="flex items-center justify-between">
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
            <p className="text-sm whitespace-pre-wrap">{proposal}</p>
          </div>
        )}
      </div>
    </li>
  );
}
