'use client';

import { shotCode } from '@regie/core';
import { useQueryClient } from '@tanstack/react-query';
import { Clapperboard, Loader2, Plus, Sparkles, X } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { NumberField, TextField } from '@/components/common/fields';
import { AssetThumb } from '@/components/common/media';
import { useModels, usable } from '@/components/common/model-picker';
import { EmptyState, Panel } from '@/components/common/page-header';
import { Code } from '@/components/common/status';
import { ShotEditor } from '@/components/shots/shot-editor';
import { type ShotDraft, ShotDrafts } from '@/components/shots/shot-drafts';
import { cameraLabel, fmtDuration, shotsSeconds, useShotImages } from '@/components/shots/shot-meta';
import { DragHandle, SortableItem, SortableList } from '@/components/shots/sortable';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useAiTask } from '@/hooks/use-ai';
import { useBible, useProject, useProjectId } from '@/hooks/use-project';
import { post, toastError } from '@/lib/client';
import { cn } from '@/lib/utils';

/** Le découpage : la liste des plans de la scène et l'éditeur du plan ouvert. */
export function ShotsTab({ scene }: { scene: any }) {
  const projectId = useProjectId();
  const qc = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const selected = search.get('shot');
  const { data: characters } = useBible('characters');
  const { data: project } = useProject();
  const { imageOf } = useShotImages();
  const { data: text = [] } = useModels('TEXT');
  const canAi = text.some(usable);
  const [adding, setAdding] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  const [intention, setIntention] = useState('');
  const [replace, setReplace] = useState(false);
  const [drafts, setDrafts] = useState<{ shots: ShotDraft[]; rationale: string } | null>(null);
  const ai = useAiTask<{ shots: ShotDraft[]; rationale: string }>('shots', { onSuccess: setDrafts });
  const key = ['project', projectId, `scenes/${scene.id}`];
  const codeOf = new Map((characters ?? []).map((c: any) => [c.id, c.code as string]));
  const shots: any[] = scene.shots;
  const ratio = project?.aspectRatio ?? '16:9';

  // Le plan ouvert vit dans l'URL : un lien vers un plan (continuité, storyboard) l'ouvre directement.
  const select = (id: string | null) => {
    const sp = new URLSearchParams(search.toString());
    if (id) sp.set('shot', id);
    else sp.delete('shot');
    router.replace(`${pathname}${sp.size ? `?${sp}` : ''}`, { scroll: false });
  };

  async function addShot() {
    setAdding(true);
    try {
      const row = await post(`/api/projects/${projectId}/shots`, { sceneId: scene.id, characterIds: scene.characters.map((c: any) => c.characterId) });
      await qc.invalidateQueries({ queryKey: key });
      qc.invalidateQueries({ queryKey: ['project', projectId, 'scenes'] });
      select(row.id);
    } catch (e) {
      toastError(e, 'Ajout impossible');
    } finally {
      setAdding(false);
    }
  }

  async function reorder(next: any[]) {
    const prev = qc.getQueryData(key);
    // Codes recalculés localement comme le fera l'API (12A, 12B…).
    const renumbered = next.map((s, i) => ({ ...s, code: shotCode(scene.number, i) }));
    qc.setQueryData(key, (old: any) => ({ ...old, shots: renumbered }));
    renumbered.forEach((s) => qc.setQueryData(['project', projectId, `shots/${s.id}`], (old: any) => (old ? { ...old, code: s.code } : old)));
    try {
      await post(`/api/projects/${projectId}/shots/reorder`, { ids: next.map((s) => s.id), sceneId: scene.id });
      qc.invalidateQueries({ queryKey: key });
      qc.invalidateQueries({ queryKey: ['project', projectId, 'scenes'] });
      next.forEach((s) => qc.invalidateQueries({ queryKey: ['project', projectId, `shots/${s.id}`] }));
    } catch (e) {
      qc.setQueryData(key, prev);
      toastError(e, 'Déplacement refusé');
    }
  }

  const open = selected && shots.some((s) => s.id === selected) ? selected : null;

  return (
    <div className={cn('grid items-start', open && 'lg:grid-cols-[minmax(0,1fr)_minmax(440px,540px)]')}>
      <div className="min-w-0 space-y-4 p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {shots.length} plan{shots.length > 1 ? 's' : ''} · {fmtDuration(shotsSeconds(shots))}
            {scene.estSeconds ? ` pour ${fmtDuration(scene.estSeconds)} estimées` : ''}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setAiOpen(!aiOpen)} disabled={!canAi} title={canAi ? undefined : 'Aucun modèle de texte configuré'}>
              <Sparkles /> Proposer un découpage
            </Button>
            <Button onClick={addShot} disabled={adding}>
              {adding ? <Loader2 className="animate-spin" /> : <Plus />} Ajouter un plan
            </Button>
          </div>
        </div>

        {aiOpen && (
          <Panel
            title="Découpage proposé par l’IA"
            description="À partir de la description, de la mise en scène et de la bible. Le linter vérifiera ensuite chaque plan."
            actions={
              <Button size="icon-sm" variant="ghost" onClick={() => setAiOpen(false)} aria-label="Fermer">
                <X />
              </Button>
            }
          >
            <div className="space-y-4">
              <div className="grid items-end gap-3 md:grid-cols-[140px_1fr_auto]">
                <NumberField label="Nombre de plans" hint="Vide : selon la scène." value={count} onChange={(v) => setCount(v === null ? null : Math.round(v))} min={1} max={40} />
                <TextField label="Intention" hint="Facultatif : ce que le découpage doit servir." value={intention} onChange={setIntention} placeholder="Tension qui monte, plans de plus en plus serrés…" />
                <Button onClick={() => ai.mutate({ sceneId: scene.id, count: count && count > 0 ? Math.min(40, count) : undefined, intention: intention.trim() || undefined })} disabled={ai.isPending} className="mb-5">
                  {ai.isPending ? <Loader2 className="animate-spin" /> : <Sparkles />} Proposer
                </Button>
              </div>
              {drafts && (
                <div className="space-y-3">
                  {drafts.rationale && <p className="text-sm text-muted-foreground">{drafts.rationale}</p>}
                  {shots.length > 0 && (
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox checked={replace} onCheckedChange={(v) => setReplace(!!v)} /> Remplacer les {shots.length} plans existants
                    </label>
                  )}
                  <ShotDrafts
                    sceneId={scene.id}
                    drafts={drafts.shots ?? []}
                    replace={replace}
                    onAdded={() => {
                      setDrafts(null);
                      setAiOpen(false);
                      setReplace(false);
                      if (replace) select(null);
                    }}
                  />
                </div>
              )}
            </div>
          </Panel>
        )}

        {!shots.length ? (
          <EmptyState icon={Clapperboard} title="Aucun plan" description="Découpez la scène plan par plan, ou demandez une proposition à l’IA puis gardez ce qui vous convient." action={<Button onClick={addShot}>Ajouter un plan</Button>} />
        ) : (
          <SortableList items={shots} onReorder={reorder}>
            <ol className="space-y-1.5">
              {shots.map((s) => {
                const img = imageOf(s);
                const cast = s.characters.map((c: any) => codeOf.get(c.characterId)).filter(Boolean);
                return (
                  <SortableItem key={s.id} id={s.id}>
                    <li className={cn('flex items-stretch rounded-md border bg-card transition-colors', open === s.id ? 'border-foreground' : 'hover:border-foreground/40')}>
                      <div className="flex items-center px-2">
                        <DragHandle />
                      </div>
                      <button type="button" onClick={() => select(open === s.id ? null : s.id)} className="grid min-w-0 flex-1 grid-cols-[auto_3.5rem_1fr_auto] items-center gap-3 py-2 pr-3 text-left">
                        <AssetThumb asset={img ? { id: img, type: 'IMAGE' } : null} ratio={s.aspectRatio || ratio} className="w-24 rounded-sm" />
                        <Code className="justify-self-start text-sm">{s.code}</Code>
                        <div className="min-w-0">
                          <p className="truncate text-sm">{s.description || s.action || <span className="text-muted-foreground">Plan à décrire</span>}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {cameraLabel(s) || 'Cadre à définir'}
                            {s.dialogue ? ` · « ${s.dialogue} »` : ''}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-3 text-xs">
                          {cast.length > 0 && <span className="font-mono text-muted-foreground">{cast.join(' ')}</span>}
                          <span className="w-10 text-right tabular-nums">{s.durationSec} s</span>
                        </div>
                      </button>
                    </li>
                  </SortableItem>
                );
              })}
            </ol>
          </SortableList>
        )}
      </div>

      {open && (
        <aside className="bg-background max-lg:border-t lg:sticky lg:top-12 lg:h-[calc(100vh-3rem)] lg:border-l">
          <ShotEditor shotId={open} onClose={() => select(null)} onDeleted={() => select(null)} className="h-full" />
        </aside>
      )}
    </div>
  );
}
