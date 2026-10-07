'use client';

import { PROP_KIND_LABELS, PROP_KINDS } from '@regie/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, Image, Loader2, Package, PanelRightClose, PanelRightOpen, Plus, Ruler, ScanEye, Shapes, Text, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { Choice } from '@/components/common/choice';
import { AreaField, TagInput, TextField } from '@/components/common/fields';
import { IconLabel } from '@/components/common/icon-label';
import { AssetThumb } from '@/components/common/media';
import { EmptyState, PageHeader } from '@/components/common/page-header';
import { Code } from '@/components/common/status';
import { type GenerateRequest, QuickGenerate } from '@/components/generation/quick-generate';
import { ReferencePanel } from '@/components/project/reference-panel';
import { RevisionsButton } from '@/components/project/revisions';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useAutosave } from '@/hooks/use-autosave';
import { useBible, useBibleMutations, useProjectId } from '@/hooks/use-project';
import { get, patch, post, toastError } from '@/lib/client';
import { cn } from '@/lib/utils';

type PropKind = (typeof PROP_KINDS)[number];
const KIND_OPTIONS = PROP_KINDS.map((k) => ({ value: k, label: PROP_KIND_LABELS[k] }));

export default function PropsPage() {
  const projectId = useProjectId();
  const { data: props, isLoading } = useBible('props');
  const { create } = useBibleMutations('props');
  const [selected, setSelected] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<PropKind>('PROP');
  const [request, setRequest] = useState<GenerateRequest | null>(null);
  const [compiling, setCompiling] = useState<string | null>(null);

  async function submit() {
    if (!name.trim()) return;
    try {
      const row = await create.mutateAsync({ name: name.trim(), kind });
      setOpen(false);
      setName('');
      setSelected(row.id);
      setCollapsed(false);
    } catch {
      // toastError déjà affiché par la mutation.
    }
  }

  // Planche et échelle se compilent côté serveur depuis la bible, puis passent par le dialogue de génération.
  async function sheet(which: 'props_sheet' | 'lineup') {
    setCompiling(which);
    try {
      const prompt = await post(`/api/projects/${projectId}/prompts`, { kind: which });
      setRequest({ capability: 'IMAGE', mode: 'text-to-image', prompt, title: which === 'props_sheet' ? 'Planche d’objets' : 'Échelle des tailles', aspectRatio: '16:9' });
    } catch (e) {
      toastError(e);
    } finally {
      setCompiling(null);
    }
  }

  const groups = PROP_KINDS.map((k) => ({ kind: k, items: (props ?? []).filter((p: any) => (p.kind ?? 'PROP') === k) })).filter((g) => g.items.length);
  const current = props?.find((p: any) => p.id === selected);

  return (
    <div className="flex min-h-[calc(100vh-3rem)]">
      <div className="min-w-0 flex-1">
        <PageHeader
          title="Objets et costumes"
          description="Accessoires, costumes, véhicules, animaux : tout ce qui doit rester identique d’un plan à l’autre."
          actions={
            <>
              <Button variant="outline" onClick={() => sheet('props_sheet')} disabled={!!compiling || !props?.length}>
                {compiling === 'props_sheet' ? <Loader2 className="animate-spin" /> : <Package />} Planche d’objets
              </Button>
              <Button variant="outline" onClick={() => sheet('lineup')} disabled={!!compiling}>
                {compiling === 'lineup' ? <Loader2 className="animate-spin" /> : <Ruler />} Échelle des tailles
              </Button>
              <Button onClick={() => setOpen(true)}>
                <Plus /> Nouvel objet
              </Button>
            </>
          }
        />
        <div className="space-y-8 p-8">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          ) : !props?.length ? (
            <EmptyState icon={Package} title="Aucun objet ni costume" description="Ajoutez ce qui revient à l’image : l’arme du héros, sa veste, la voiture. Leur description rejoint les plans où ils apparaissent." action={<Button onClick={() => setOpen(true)}>Ajouter un objet</Button>} />
          ) : (
            groups.map((g) => (
              <section key={g.kind} className="space-y-2">
                <h2 className="flex items-baseline gap-2 font-medium">
                  {PROP_KIND_LABELS[g.kind]} <span className="text-sm text-muted-foreground">{g.items.length}</span>
                </h2>
                <ul className="divide-y rounded-md border bg-card">
                  {g.items.map((p: any) => (
                    <li key={p.id}>
                      <button
                        onClick={() => {
                          setSelected(p.id);
                          setCollapsed(false);
                        }}
                        className={cn('flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-accent', selected === p.id && 'bg-secondary')}
                      >
                        <AssetThumb asset={p.refAssetId ? { id: p.refAssetId, type: 'IMAGE' } : null} ratio="1:1" className="w-12 shrink-0 rounded-sm border" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <Code>{p.code}</Code>
                            <span className="truncate font-medium">{p.name}</span>
                          </div>
                          <p className="truncate text-sm text-muted-foreground">{p.short || p.block || 'Description à écrire'}</p>
                        </div>
                        {!p.refAssetId && <span className="shrink-0 rounded-sm bg-warning/15 px-1.5 py-0.5 text-xs text-warning">sans référence</span>}
                        <span className="shrink-0 rounded-sm bg-secondary px-1.5 py-0.5 text-xs">{p._count?.shots ?? 0} plans</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </div>
      </div>

      {current && (
        <aside className={cn('shrink-0 border-l bg-background transition-[width]', collapsed ? 'w-12' : 'w-[420px]')}>
          <div className="sticky top-12 max-h-[calc(100vh-3rem)] overflow-y-auto">
            {collapsed ? (
              <div className="flex flex-col items-center gap-2 py-3">
                <Button variant="ghost" size="icon-sm" onClick={() => setCollapsed(false)} aria-label="Déplier le panneau">
                  <PanelRightOpen />
                </Button>
                <Code>{current.code}</Code>
              </div>
            ) : (
              <PropEditor key={current.id} id={current.id} onCollapse={() => setCollapsed(true)} onClose={() => setSelected(null)} />
            )}
          </div>
        </aside>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvel objet</DialogTitle>
            <DialogDescription>Un nom et un type. La description se complète ensuite dans le panneau.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nom</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus onKeyDown={(e) => e.key === 'Enter' && submit()} />
            </div>
            <Choice label="Type" value={kind} onChange={(v) => v && setKind(v as PropKind)} options={KIND_OPTIONS} />
          </div>
          <DialogFooter>
            <Button onClick={submit} disabled={create.isPending || !name.trim()}>
              {create.isPending ? 'Création…' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <QuickGenerate request={request} open={!!request} onOpenChange={(o) => !o && setRequest(null)} />
    </div>
  );
}

// Monté par objet (key) : l'autosave en cours part vers le bon objet même si l'on change de sélection.
function PropEditor({ id, onCollapse, onClose }: { id: string; onCollapse: () => void; onClose: () => void }) {
  const projectId = useProjectId();
  const qc = useQueryClient();
  const key = ['project', projectId, `bible/props/${id}`];
  const listKey = ['project', projectId, 'bible/props'];
  const { data: p, isLoading } = useQuery({ queryKey: key, queryFn: () => get(`/api/projects/${projectId}/bible/props/${id}`) });
  const { remove } = useBibleMutations('props');

  const { queue } = useAutosave<Record<string, unknown>>(async (patchData) => {
    const row = await patch(`/api/projects/${projectId}/bible/props/${id}`, patchData);
    qc.setQueryData(key, (old: any) => ({ ...old, ...row, assets: old?.assets }));
    qc.invalidateQueries({ queryKey: listKey, exact: true });
  });
  const set = (v: Record<string, unknown>) => {
    qc.setQueryData(key, (old: any) => ({ ...old, ...v }));
    // La liste suit immédiatement (nom, type, forme courte).
    qc.setQueryData(listKey, (old: any[] | undefined) => old?.map((x) => (x.id === id ? { ...x, ...v } : x)));
    queue(v);
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          {p && <Code>{p.code}</Code>}
          <span className="truncate font-medium">{p?.name ?? '…'}</span>
        </div>
        <div className="flex shrink-0 items-center">
          <Button variant="ghost" size="icon-sm" onClick={onCollapse} aria-label="Replier le panneau">
            <PanelRightClose />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Fermer">
            <X />
          </Button>
        </div>
      </div>
      {isLoading || !p ? (
        <div className="space-y-3 p-4">
          <Skeleton className="h-9" />
          <Skeleton className="h-32" />
          <Skeleton className="aspect-square" />
        </div>
      ) : (
        <div className="space-y-5 p-4">
          <div className="grid grid-cols-[1fr_160px] gap-3">
            <TextField label="Nom" value={p.name} onChange={(v) => v.trim() && set({ name: v })} />
            <Choice label={<IconLabel icon={Shapes}>Type</IconLabel>} value={p.kind} onChange={(v) => v && set({ kind: v })} options={KIND_OPTIONS} />
          </div>
          <TextField label={<IconLabel icon={Text}>Forme courte</IconLabel>} hint="Une phrase, pour les moteurs vidéo." value={p.short} onChange={(v) => set({ short: v })} mono />
          <AreaField label={<IconLabel icon={ScanEye}>Description</IconLabel>} hint="En anglais, concrète : matière, couleur, taille, usure. Elle part telle quelle dans les prompts." value={p.block} onChange={(v) => set({ block: v })} rows={6} mono />
          <TagInput label={<IconLabel icon={Ban}>Jamais</IconLabel>} hint="Ce que le modèle ne doit jamais lui donner." value={p.never ?? []} onChange={(v) => set({ never: v })} />
          <div className="space-y-2">
            <Label>
              <IconLabel icon={Image}>Référence</IconLabel>
            </Label>
            <ReferencePanel kind="prop" entity={p} assets={p.assets} ratio="1:1" />
          </div>
          <div className="flex items-center justify-between border-t pt-4">
            <RevisionsButton entityType="prop" entityId={p.id} onRestored={() => qc.invalidateQueries({ queryKey: key })} />
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="text-destructive">
                  <Trash2 /> Supprimer
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Supprimer {p.name} ?</AlertDialogTitle>
                  <AlertDialogDescription>L’objet sera retiré de tous les plans. Les images générées restent dans les assets.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction onClick={() => remove.mutate(p.id, { onSuccess: onClose })}>Supprimer</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      )}
    </div>
  );
}
