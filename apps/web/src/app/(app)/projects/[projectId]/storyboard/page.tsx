'use client';

import { shotCode } from '@regie/core';
import { useQueryClient } from '@tanstack/react-query';
import { Download, Film, ImageIcon, LayoutGrid, Loader2, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AssetThumb } from '@/components/common/media';
import { EmptyState, PageHeader } from '@/components/common/page-header';
import { Code } from '@/components/common/status';
import { type GenerateRequest, QuickGenerate } from '@/components/generation/quick-generate';
import { ShotEditor } from '@/components/shots/shot-editor';
import { cameraLabel, sceneHeading, useShotImages } from '@/components/shots/shot-meta';
import { DragHandle, SortableItem, SortableList } from '@/components/shots/sortable';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useProject, useProjectData, useProjectId } from '@/hooks/use-project';
import { get, post, toastError } from '@/lib/client';
import { cn } from '@/lib/utils';

const RATIOS = ['16:9', '9:16', '4:3', '2.39:1', '1:1'];
const COLS: Record<string, string> = {
  '16:9': 'grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4',
  '4:3': 'grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4',
  '2.39:1': 'grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3',
  '1:1': 'grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5',
  '9:16': 'grid-cols-3 lg:grid-cols-5 2xl:grid-cols-6',
};
const MAX_SHEET = 12;

export default function StoryboardPage() {
  const projectId = useProjectId();
  const qc = useQueryClient();
  const { data: project } = useProject();
  const { data, isLoading } = useProjectData<{ scenes: any[] }>('scenes');
  const { imageOf } = useShotImages();
  const [ratio, setRatio] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [request, setRequest] = useState<GenerateRequest | null>(null);
  const [genOpen, setGenOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const scenes = data?.scenes ?? [];
  const shown = ratio ?? (RATIOS.includes(project?.aspectRatio) ? project.aspectRatio : '16:9');

  // Les cases sélectionnées disparues (plan supprimé) sortent de la sélection.
  useEffect(() => {
    const ids = new Set(scenes.flatMap((s) => s.shots.map((sh: any) => sh.id)));
    setSelected((sel) => (sel.every((id) => ids.has(id)) ? sel : sel.filter((id) => ids.has(id))));
  }, [scenes]);

  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= MAX_SHEET ? s : [...s, id]));

  async function generateShot(shotId: string) {
    setBusy(shotId);
    try {
      const d = await get(`/api/projects/${projectId}/shots/${shotId}/prompts`);
      setRequest({
        capability: 'IMAGE',
        mode: 'text-to-image',
        prompt: d.prompts.still,
        shotId,
        inputs: d.spec.refs.filter((r: any) => r.assetId).map((r: any) => ({ assetId: r.assetId, role: 'reference' })),
        aspectRatio: d.spec.format.ratio,
        title: `Image du plan ${d.spec.code}`,
      });
      setGenOpen(true);
    } catch (e) {
      toastError(e, 'Prompt impossible à compiler');
    } finally {
      setBusy(null);
    }
  }

  async function generateSheet() {
    // Dans l'ordre du film, pas dans l'ordre des clics.
    const order = scenes.flatMap((s) => s.shots.map((sh: any) => sh.id));
    const shotIds = order.filter((id) => selected.includes(id));
    const sceneIds = [...new Set(scenes.filter((s) => s.shots.some((sh: any) => shotIds.includes(sh.id))).map((s) => s.id))];
    const numbers = scenes.filter((s) => sceneIds.includes(s.id)).map((s) => s.number);
    setBusy('sheet');
    try {
      const title = `S${numbers.join('-')}`.slice(0, 40);
      const prompt = await post(`/api/projects/${projectId}/prompts`, { kind: 'sheet', shotIds, title });
      setRequest({ capability: 'IMAGE', mode: 'text-to-image', prompt, aspectRatio: shown, links: sceneIds.length === 1 ? { sceneId: sceneIds[0] } : {}, title: `Planche ${shotIds.length} cases` });
      setGenOpen(true);
    } catch (e) {
      toastError(e, 'Planche impossible à compiler');
    } finally {
      setBusy(null);
    }
  }

  async function reorder(sceneId: string, next: any[]) {
    const key = ['project', projectId, 'scenes'];
    const prev = qc.getQueryData(key);
    qc.setQueryData(key, (old: any) => ({ ...old, scenes: old.scenes.map((s: any) => (s.id === sceneId ? { ...s, shots: next.map((sh, i) => ({ ...sh, code: shotCode(s.number, i) })) } : s)) }));
    try {
      await post(`/api/projects/${projectId}/shots/reorder`, { ids: next.map((s) => s.id), sceneId });
      qc.invalidateQueries({ queryKey: ['project', projectId] });
    } catch (e) {
      qc.setQueryData(key, prev);
      toastError(e, 'Déplacement refusé');
    }
  }

  const totalShots = scenes.reduce((a, s) => a + s.shots.length, 0);

  return (
    <div className="pb-20">
      <PageHeader
        title="Storyboard"
        description="Une case par plan, dans l’ordre du film. Cliquez une case pour ouvrir le plan ; glissez-la pour la déplacer dans sa scène."
        actions={
          <>
            <ToggleGroup type="single" variant="outline" size="sm" value={shown} onValueChange={(v) => v && setRatio(v)} aria-label="Format des cases">
              {RATIOS.map((r) => (
                <ToggleGroupItem key={r} value={r} className="px-2.5 tabular-nums">
                  {r}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <Button variant="outline" asChild>
              <a href={`/api/projects/${projectId}/export?format=storyboard`} target="_blank" rel="noreferrer">
                <Download /> Export PDF
              </a>
            </Button>
          </>
        }
      />
      <div className="space-y-10 p-8">
        {isLoading ? (
          <div className="grid grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="aspect-video" />
            ))}
          </div>
        ) : !totalShots ? (
          <EmptyState
            icon={LayoutGrid}
            title="Aucun plan à montrer"
            description={scenes.length ? 'Découpez vos scènes en plans : chaque plan devient une case.' : 'Créez d’abord les scènes, puis découpez-les en plans.'}
            action={
              <Button asChild variant="outline">
                <Link href={`/projects/${projectId}/scenes`}>Aller aux scènes</Link>
              </Button>
            }
          />
        ) : (
          scenes.map((scene) => (
            <section key={scene.id} className="space-y-3">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h2 className="text-lg font-semibold">
                  <Link href={`/projects/${projectId}/scenes/${scene.id}`} className="hover:underline">
                    Scène {scene.number}
                    {scene.title ? ` · ${scene.title}` : ''}
                  </Link>
                </h2>
                <span className="font-mono text-xs text-muted-foreground">{sceneHeading(scene)}</span>
              </div>
              {!scene.shots.length ? (
                <p className="rounded-md border border-dashed px-4 py-6 text-sm text-muted-foreground">
                  Pas encore découpée.{' '}
                  <Link href={`/projects/${projectId}/scenes/${scene.id}`} className="underline underline-offset-2">
                    Ouvrir la scène
                  </Link>
                </p>
              ) : (
                <SortableList items={scene.shots} onReorder={(next) => reorder(scene.id, next)} layout="grid">
                  <div className={cn('grid gap-4', COLS[shown])}>
                    {scene.shots.map((shot: any) => {
                      const img = imageOf(shot);
                      const on = selected.includes(shot.id);
                      return (
                        <SortableItem key={shot.id} id={shot.id}>
                          <article className={cn('group overflow-hidden rounded-md border bg-card', on ? 'border-foreground ring-1 ring-foreground' : 'hover:border-foreground/40')}>
                            <div className="relative">
                              <button type="button" className="block w-full" onClick={() => setEditing(shot.id)} aria-label={`Ouvrir le plan ${shot.code}`}>
                                <AssetThumb asset={img ? { id: img, type: 'IMAGE' } : null} ratio={shown} />
                              </button>
                              <label className={cn('absolute top-2 left-2 flex items-center rounded-sm bg-background/90 p-1', !on && !selected.length && 'opacity-0 group-hover:opacity-100 focus-within:opacity-100')} title="Sélectionner pour une planche multi-cases">
                                <Checkbox checked={on} onCheckedChange={() => toggle(shot.id)} disabled={!on && selected.length >= MAX_SHEET} aria-label={`Sélectionner ${shot.code}`} />
                              </label>
                              <span className="absolute top-2 right-2 flex rounded-sm bg-background/90 p-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100">
                                <DragHandle />
                              </span>
                              <Button
                                size="xs"
                                className="absolute right-2 bottom-2 bg-signal text-signal-foreground opacity-0 group-hover:opacity-100 hover:bg-signal/90 focus-visible:opacity-100"
                                onClick={() => generateShot(shot.id)}
                                disabled={busy === shot.id}
                              >
                                {busy === shot.id ? <Loader2 className="animate-spin" /> : <ImageIcon />} Générer l’image
                              </Button>
                            </div>
                            <button type="button" onClick={() => setEditing(shot.id)} className="block w-full space-y-1 p-2.5 text-left">
                              <div className="flex items-center gap-2 text-xs">
                                <Code>{shot.code}</Code>
                                <span className="min-w-0 flex-1 truncate text-muted-foreground">{cameraLabel(shot) || 'Cadre à définir'}</span>
                                <span className="tabular-nums">{shot.durationSec} s</span>
                              </div>
                              <p className="line-clamp-2 min-h-10 text-sm">{shot.action || shot.description || <span className="text-muted-foreground">Action à décrire</span>}</p>
                              {shot.dialogue && <p className="line-clamp-2 text-xs italic">« {shot.dialogue} »</p>}
                            </button>
                          </article>
                        </SortableItem>
                      );
                    })}
                  </div>
                </SortableList>
              )}
            </section>
          ))
        )}
      </div>

      {selected.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-20 flex justify-center px-4 pb-4">
          <div className="flex max-w-3xl flex-wrap items-center gap-3 rounded-md border bg-background px-4 py-3 shadow-sm">
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-medium">
                {selected.length} case{selected.length > 1 ? 's' : ''} sélectionnée{selected.length > 1 ? 's' : ''}
                {selected.length >= MAX_SHEET ? ` (maximum ${MAX_SHEET})` : ''}
              </p>
              <p className="text-muted-foreground">Une planche se génère en un seul passage : le modèle garde alors les mêmes visages et costumes d’une case à l’autre, ce que des images générées séparément ne garantissent pas.</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setSelected([])}>
              <X /> Vider
            </Button>
            <Button onClick={generateSheet} disabled={busy === 'sheet'} className="bg-signal text-signal-foreground hover:bg-signal/90">
              {busy === 'sheet' ? <Loader2 className="animate-spin" /> : <Film />} Planche multi-cases
            </Button>
          </div>
        </div>
      )}

      <Sheet open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <SheetContent side="right" showCloseButton={false} className="w-full gap-0 p-0 sm:max-w-xl">
          <SheetHeader className="sr-only">
            <SheetTitle>Plan</SheetTitle>
            <SheetDescription>Édition du plan, prompts et générations.</SheetDescription>
          </SheetHeader>
          {editing && <ShotEditor shotId={editing} onClose={() => setEditing(null)} onDeleted={() => setEditing(null)} className="h-full" />}
        </SheetContent>
      </Sheet>

      <QuickGenerate request={request} open={genOpen} onOpenChange={setGenOpen} />
    </div>
  );
}
