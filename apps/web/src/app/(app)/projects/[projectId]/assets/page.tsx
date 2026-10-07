'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Boxes, Check, ChevronDown, Download, FileText, Loader2, Search, Trash2, Upload, X } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { AssetDetail, REFERENCE_KINDS, SOURCE_LABELS, TYPE_LABELS } from '@/components/assets/asset-detail';
import { ACCEPT, MAX_MB, useUpload } from '@/components/assets/upload';
import { type AssetRow, useAssets } from '@/components/assets/use-assets';
import { Choice } from '@/components/common/choice';
import { AssetThumb, TypeIcon } from '@/components/common/media';
import { useModels } from '@/components/common/model-picker';
import { EmptyState, PageHeader } from '@/components/common/page-header';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { useBible, useProjectData, useProjectId } from '@/hooks/use-project';
import { del } from '@/lib/client';
import { cn } from '@/lib/utils';

const FILTER_KEYS = ['type', 'source', 'reference', 'referenceKind', 'characterId', 'locationId', 'sceneId', 'shotId', 'providerId', 'modelId', 'tag', 'q'] as const;
type Filters = Partial<Record<(typeof FILTER_KEYS)[number], string>>;

export default function AssetsPage() {
  const projectId = useProjectId();
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const qc = useQueryClient();
  const selectedId = search.get('asset');

  // Les filtres partent de l'URL (liens depuis le montage, les fiches…) puis vivent dans la page.
  const [filters, setFilters] = useState<Filters>(() => Object.fromEntries(FILTER_KEYS.map((k) => [k, search.get(k) ?? undefined]).filter(([, v]) => v)));
  const [q, setQ] = useState(filters.q ?? '');
  const [tag, setTag] = useState(filters.tag ?? '');
  const [more, setMore] = useState(() => FILTER_KEYS.slice(4, 11).some((k) => filters[k]));
  const [selection, setSelection] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const dragDepth = useRef(0);
  const set = (p: Filters) => setFilters((f) => ({ ...f, ...p }));

  useEffect(() => {
    const t = setTimeout(() => setFilters((f) => ({ ...f, q: q.trim() || undefined, tag: tag.trim().toLowerCase() || undefined })), 300);
    return () => clearTimeout(t);
  }, [q, tag]);

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useAssets(projectId, filters);
  const items = useMemo(() => data?.pages.flatMap((p) => p.items) ?? [], [data]);
  const { upload, progress, errors, clearErrors } = useUpload(projectId);

  const characters = useBible('characters').data ?? [];
  const locations = useBible('locations').data ?? [];
  const scenes = useProjectData<{ scenes: any[] }>('scenes').data?.scenes ?? [];
  const shots = scenes.filter((s) => !filters.sceneId || s.id === filters.sceneId).flatMap((s) => (s.shots ?? []).map((sh: any) => ({ ...sh, sceneNumber: s.number })));
  const { data: models = [] } = useModels();
  const providers = [...new Map(models.map((m) => [m.provider.id, m.provider])).values()];

  // Défilement infini : la page suivante se charge quand le bas de la grille approche.
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasNextPage) return;
    const obs = new IntersectionObserver((e) => e[0].isIntersecting && !isFetchingNextPage && fetchNextPage(), { rootMargin: '600px' });
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const openAsset = useCallback(
    (id: string | null) => {
      const sp = new URLSearchParams(search.toString());
      if (id) sp.set('asset', id);
      else sp.delete('asset');
      router.replace(`${pathname}${sp.size ? `?${sp}` : ''}`, { scroll: false });
    },
    [search, router, pathname],
  );

  const doUpload = (list: File[]) => {
    if (!list.length) return;
    // Envoyé depuis une vue filtrée : le fichier hérite du contexte (référence, personnage…).
    upload(list, {
      isReference: filters.reference === '1' ? 'true' : '',
      referenceKind: filters.reference === '1' ? (filters.referenceKind ?? '') : '',
      characterId: filters.characterId ?? '',
      locationId: filters.locationId ?? '',
      sceneId: filters.sceneId ?? '',
      shotId: filters.shotId ?? '',
    });
  };

  const toggle = (id: string) => setSelection((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  async function deleteSelection() {
    setDeleting(true);
    const results = await Promise.allSettled(selection.map((id) => del(`/api/projects/${projectId}/assets/${id}`)));
    const failed = results.filter((r) => r.status === 'rejected').length;
    setDeleting(false);
    if (failed) toast.error(`${failed} suppression(s) refusée(s)`);
    else toast.success(`${selection.length} asset(s) supprimé(s)`);
    if (selectedId && selection.includes(selectedId)) openAsset(null);
    setSelection([]);
    qc.invalidateQueries({ queryKey: ['assets'] });
  }

  function downloadSelection() {
    // Un lien par fichier : l'export ZIP ne sait pas (encore) filtrer par sélection.
    selection.forEach((id, i) =>
      setTimeout(() => {
        const a = document.createElement('a');
        a.href = `/api/files/${id}?download=1`;
        a.download = '';
        document.body.appendChild(a);
        a.click();
        a.remove();
      }, i * 300),
    );
  }

  const active = Object.entries(filters).filter(([, v]) => v).length;
  const zipHref = `/api/projects/${projectId}/export?format=assets${filters.type ? `&type=${filters.type}` : ''}`;

  return (
    <div
      className="relative flex min-h-[calc(100vh-3rem)]"
      onDragEnter={(e) => {
        if (!e.dataTransfer.types.includes('Files')) return;
        dragDepth.current++;
        setDragging(true);
      }}
      onDragOver={(e) => e.dataTransfer.types.includes('Files') && e.preventDefault()}
      onDragLeave={() => {
        dragDepth.current = Math.max(0, dragDepth.current - 1);
        if (!dragDepth.current) setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        dragDepth.current = 0;
        setDragging(false);
        doUpload([...e.dataTransfer.files]);
      }}
    >
      <div className="min-w-0 flex-1">
        <PageHeader
          title="Assets"
          description="Tous les fichiers du projet : envoyés, générés, importés. Les références alimentent la cohérence des personnages et des lieux."
          actions={
            <>
              <Button variant="outline" asChild>
                <a href={zipHref}>
                  <Download /> ZIP{filters.type ? ` (${TYPE_LABELS[filters.type]?.toLowerCase()}s)` : ''}
                </a>
              </Button>
              <Button onClick={() => file.current?.click()} disabled={progress !== null}>
                {progress !== null ? <Loader2 className="animate-spin" /> : <Upload />} Envoyer des fichiers
              </Button>
              <input
                ref={file}
                type="file"
                multiple
                accept={ACCEPT}
                className="hidden"
                onChange={(e) => {
                  doUpload([...(e.target.files ?? [])]);
                  e.target.value = '';
                }}
              />
            </>
          }
        />

        <div className="space-y-4 p-8">
          {/* Envoi en cours / erreurs */}
          {progress !== null && (
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Envoi… {progress} %</p>
              <Progress value={progress} className="h-1" />
            </div>
          )}
          {errors.length > 0 && (
            <div className="flex items-start justify-between gap-3 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm">
              <ul className="space-y-0.5 text-destructive">
                {errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
              <button onClick={clearErrors} className="text-muted-foreground hover:text-foreground" aria-label="Fermer">
                <X className="size-4" />
              </button>
            </div>
          )}

          {/* Filtres */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-end gap-2">
              <div className="relative min-w-56 flex-1">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher par nom, tag ou prompt" className="pl-8" aria-label="Recherche" />
              </div>
              <Choice value={filters.type} onChange={(v) => set({ type: v ?? undefined })} allowNone noneLabel="Tous les types" options={Object.entries(TYPE_LABELS).map(([value, label]) => ({ value, label }))} className="w-40" />
              <Choice value={filters.source} onChange={(v) => set({ source: v ?? undefined })} allowNone noneLabel="Toutes les sources" options={Object.entries(SOURCE_LABELS).map(([value, label]) => ({ value, label: `${label}s` }))} className="w-44" />
              <label className="flex h-9 items-center gap-2 rounded-md border px-3 text-sm">
                <Switch checked={filters.reference === '1'} onCheckedChange={(v) => set({ reference: v ? '1' : undefined, referenceKind: v ? filters.referenceKind : undefined })} />
                Références seulement
              </label>
              {filters.reference === '1' && <Choice value={filters.referenceKind} onChange={(v) => set({ referenceKind: v ?? undefined })} allowNone noneLabel="Toutes natures" options={Object.entries(REFERENCE_KINDS).map(([value, label]) => ({ value, label }))} className="w-40" />}
            </div>
            <Collapsible open={more} onOpenChange={setMore}>
              <div className="flex items-center gap-3">
                <CollapsibleTrigger className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                  <ChevronDown className={cn('size-4 transition-transform', !more && '-rotate-90')} /> Plus de filtres
                </CollapsibleTrigger>
                {active > 0 && (
                  <button
                    className="text-sm text-muted-foreground underline-offset-2 hover:underline"
                    onClick={() => {
                      setFilters({});
                      setQ('');
                      setTag('');
                    }}
                  >
                    Effacer les filtres ({active})
                  </button>
                )}
              </div>
              <CollapsibleContent className="grid gap-3 pt-3 sm:grid-cols-2 lg:grid-cols-4">
                <Choice label="Personnage" value={filters.characterId} onChange={(v) => set({ characterId: v ?? undefined })} allowNone noneLabel="Tous" options={characters.map((c: any) => ({ value: c.id, label: c.name, hint: c.code }))} />
                <Choice label="Lieu" value={filters.locationId} onChange={(v) => set({ locationId: v ?? undefined })} allowNone noneLabel="Tous" options={locations.map((l: any) => ({ value: l.id, label: l.name, hint: l.code }))} />
                <Choice label="Scène" value={filters.sceneId} onChange={(v) => set({ sceneId: v ?? undefined, shotId: undefined })} allowNone noneLabel="Toutes" options={scenes.map((s: any) => ({ value: s.id, label: `${s.number}. ${s.title || 'Sans titre'}` }))} />
                <Choice label="Plan" value={filters.shotId} onChange={(v) => set({ shotId: v ?? undefined })} allowNone noneLabel="Tous" options={shots.map((s: any) => ({ value: s.id, label: s.code, hint: `scène ${s.sceneNumber}` }))} />
                <Choice label="Provider" value={filters.providerId} onChange={(v) => set({ providerId: v ?? undefined })} allowNone noneLabel="Tous" options={providers.map((p) => ({ value: p.id, label: p.name }))} />
                <Choice label="Modèle" value={filters.modelId} onChange={(v) => set({ modelId: v ?? undefined })} allowNone noneLabel="Tous" options={models.filter((m) => !filters.providerId || m.provider.id === filters.providerId).map((m) => ({ value: m.id, label: m.label, hint: m.provider.name }))} />
                <div className="space-y-1.5">
                  <label htmlFor="tag" className="text-sm font-medium">
                    Tag
                  </label>
                  <Input id="tag" value={tag} onChange={(e) => setTag(e.target.value)} placeholder="ex. still" />
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>

          {/* Barre de sélection */}
          {selection.length > 0 && (
            <div className="sticky top-12 z-10 flex flex-wrap items-center gap-2 rounded-md border bg-background px-3 py-2">
              <span className="text-sm font-medium">
                {selection.length} sélectionné{selection.length > 1 ? 's' : ''}
              </span>
              <Button variant="ghost" size="sm" onClick={() => setSelection(items.map((a) => a.id))}>
                Tout sélectionner ({items.length})
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setSelection([])}>
                Désélectionner
              </Button>
              <div className="ml-auto flex gap-2">
                <Button variant="outline" size="sm" onClick={downloadSelection}>
                  <Download /> Télécharger
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" className="text-destructive" disabled={deleting}>
                      {deleting ? <Loader2 className="animate-spin" /> : <Trash2 />} Supprimer
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        Supprimer {selection.length} asset{selection.length > 1 ? 's' : ''} ?
                      </AlertDialogTitle>
                      <AlertDialogDescription>Les fichiers sont effacés du stockage. Les références de la bible qui les utilisent disparaissent aussi.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                      <AlertDialogAction onClick={deleteSelection}>Supprimer</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          )}

          {/* Grille */}
          {isLoading ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-3">
              {Array.from({ length: 12 }, (_, i) => (
                <Skeleton key={i} className="aspect-square" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              icon={Boxes}
              title={active ? 'Aucun asset ne correspond à ces filtres' : 'Aucun asset dans ce projet'}
              description={active ? 'Élargissez la recherche ou effacez les filtres.' : `Glissez-déposez des fichiers sur la page, ou envoyez-les avec le bouton. Images, vidéos, audio et PDF, jusqu’à ${MAX_MB} Mo. Les générations arrivent ici automatiquement.`}
              action={
                !active && (
                  <Button variant="outline" onClick={() => file.current?.click()}>
                    <Upload /> Envoyer des fichiers
                  </Button>
                )
              }
            />
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                {items.length}
                {hasNextPage ? '+' : ''} asset{items.length > 1 ? 's' : ''}, du plus récent au plus ancien.
              </p>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-3">
                {items.map((a) => (
                  <Tile key={a.id} a={a} selected={selection.includes(a.id)} selecting={selection.length > 0} current={a.id === selectedId} onToggle={() => toggle(a.id)} onOpen={() => openAsset(a.id)} />
                ))}
              </div>
              <div ref={sentinel} />
              {hasNextPage && (
                <div className="text-center">
                  <Button variant="outline" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
                    {isFetchingNextPage && <Loader2 className="animate-spin" />} Charger plus
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {selectedId && (
        <div className="sticky top-12 h-[calc(100vh-3rem)] w-[400px] shrink-0">
          <AssetDetail
            key={selectedId}
            assetId={selectedId}
            onClose={() => openAsset(null)}
            onDeleted={() => {
              setSelection((s) => s.filter((x) => x !== selectedId));
              openAsset(null);
            }}
          />
        </div>
      )}

      {dragging && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center border-2 border-dashed border-foreground bg-background/85">
          <div className="text-center">
            <Upload className="mx-auto size-8" />
            <p className="mt-2 font-medium">Déposez pour ajouter aux assets</p>
            <p className="text-sm text-muted-foreground">Images, vidéos, audio, PDF — {MAX_MB} Mo maximum par fichier</p>
          </div>
        </div>
      )}
    </div>
  );
}

function Tile({ a, selected, selecting, current, onToggle, onOpen }: { a: AssetRow; selected: boolean; selecting: boolean; current: boolean; onToggle: () => void; onOpen: () => void }) {
  return (
    <div className={cn('group relative overflow-hidden rounded-sm border bg-card', current ? 'border-signal ring-1 ring-signal' : selected ? 'border-foreground ring-1 ring-foreground' : 'hover:border-foreground/40')}>
      <button type="button" className="block w-full text-left" onClick={(e) => (e.shiftKey || e.metaKey || e.ctrlKey || selecting ? onToggle() : onOpen())}>
        {a.type === 'DOCUMENT' ? (
          <div className="flex aspect-square items-center justify-center bg-stage">
            <FileText className="size-8 text-muted-foreground" />
          </div>
        ) : a.type === 'AUDIO' ? (
          <div className="flex aspect-square items-center justify-center bg-stage">
            <TypeIcon type="AUDIO" className="size-8 text-muted-foreground" />
          </div>
        ) : (
          <AssetThumb asset={a} ratio="1:1" />
        )}
        <div className="flex items-center gap-1.5 px-2 py-1.5">
          <TypeIcon type={a.type} className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate text-sm">{a.name}</span>
          {a.isReference && <span className="rounded-sm bg-secondary px-1 text-[11px]">Réf.</span>}
        </div>
      </button>
      <button
        type="button"
        onClick={onToggle}
        aria-label={selected ? 'Retirer de la sélection' : 'Sélectionner'}
        className={cn(
          'absolute top-1.5 left-1.5 flex size-5 items-center justify-center rounded-sm border bg-background transition-opacity',
          selected ? 'border-foreground bg-foreground text-background opacity-100' : selecting ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100',
        )}
      >
        {selected && <Check className="size-3.5" />}
      </button>
      {a.source === 'GENERATED' && <span className="absolute top-1.5 right-1.5 rounded-sm bg-background/90 px-1 text-[11px] text-muted-foreground">généré</span>}
    </div>
  );
}
