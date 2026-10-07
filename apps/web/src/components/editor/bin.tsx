'use client';

import type { MediaRef } from '@regie/core';
import { Loader2, Music, Search, Upload } from 'lucide-react';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { type AssetRow, useAssets } from '@/components/assets/use-assets';
import { ACCEPT, useUpload } from '@/components/assets/upload';
import { fileUrl } from '@/components/common/media';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { actions, ASSET_MIME, dragState } from './actions';
import { probeDuration, useThumb } from './media-cache';
import { useEditor } from './store';
import { humanDuration } from './time';

// Le chutier : les médias du projet, à glisser sur la timeline.

const TABS = [
  { type: 'VIDEO', label: 'Vidéos' },
  { type: 'IMAGE', label: 'Images' },
  { type: 'AUDIO', label: 'Audio' },
] as const;

const toRef = (a: AssetRow): MediaRef => ({ id: a.id, type: a.type, name: a.name, mimeType: a.mimeType, durationSec: a.durationSec ?? null, width: a.width ?? null, height: a.height ?? null });

export function Bin({ projectId }: { projectId: string }) {
  const [type, setType] = useState<(typeof TABS)[number]['type']>('VIDEO');
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useAssets(projectId, { type, q: debounced || undefined }, 40);
  const items = useMemo(() => data?.pages.flatMap((p) => p.items) ?? [], [data]);
  const { upload, progress, errors, clearErrors } = useUpload(projectId);
  const used = useEditor((s) => {
    const ids = new Set<string>();
    s.doc?.tracks.forEach((t) => t.clips.forEach((c) => c.assetId && ids.add(c.assetId)));
    return [...ids].sort().join(',');
  });
  const usedSet = useMemo(() => new Set(used.split(',')), [used]);

  const onFiles = async (files: File[]) => {
    const created = await upload(files);
    const first = created.find((a) => a.type === 'VIDEO' || a.type === 'IMAGE' || a.type === 'AUDIO');
    if (first && first.type !== type) setType(first.type);
  };

  return (
    <div
      className={cn('relative flex h-full min-h-0 flex-col bg-background', over && 'ring-2 ring-signal ring-inset')}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes('Files')) return;
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setOver(false)}
      onDrop={(e) => {
        if (!e.dataTransfer.files.length) return;
        e.preventDefault();
        setOver(false);
        void onFiles([...e.dataTransfer.files]);
      }}
    >
      <div className="flex h-10 shrink-0 items-center justify-between border-b pr-1.5 pl-3">
        <span className="text-sm font-medium">Médias</span>
        <Button variant="ghost" size="sm" onClick={() => input.current?.click()} className="text-muted-foreground">
          <Upload /> Importer
        </Button>
        <input ref={input} type="file" multiple accept={ACCEPT} className="hidden" onChange={(e) => e.target.files && void onFiles([...e.target.files]).then(() => (e.target.value = ''))} />
      </div>
      <div className="space-y-2 border-b p-2.5">
        <div className="grid grid-cols-3 gap-0.5 rounded-md bg-muted p-0.5">
          {TABS.map((t) => (
            <button key={t.type} type="button" onClick={() => setType(t.type)} className={cn('rounded-[3px] py-1 text-xs font-medium transition-colors', type === t.type ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground')}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher" className="h-8 pl-8 text-sm" />
        </div>
      </div>
      {progress !== null && (
        <div className="space-y-1 border-b px-3 py-2 text-xs text-muted-foreground">
          Envoi… {progress} %
          <Progress value={progress} className="h-1" />
        </div>
      )}
      {errors.length > 0 && (
        <div className="space-y-1 border-b bg-destructive/5 px-3 py-2 text-xs text-destructive">
          {errors.map((e) => (
            <p key={e}>{e}</p>
          ))}
          <button type="button" className="underline underline-offset-2" onClick={clearErrors}>
            Fermer
          </button>
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto p-2.5">
        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-md border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
            <Upload className="size-5" />
            {debounced ? 'Aucun résultat.' : 'Aucun média de ce type. Déposez des fichiers ici ou importez-les.'}
          </div>
        ) : (
          <div className={cn('grid gap-2', type === 'AUDIO' ? 'grid-cols-1' : 'grid-cols-2')}>
            {items.map((a) => (
              <BinItem key={a.id} asset={a} used={usedSet.has(a.id)} />
            ))}
          </div>
        )}
        {hasNextPage && (
          <Button variant="ghost" size="sm" className="mt-2 w-full" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
            {isFetchingNextPage ? 'Chargement…' : 'Afficher plus'}
          </Button>
        )}
      </div>
      <p className="border-t px-3 py-2 text-[11px] leading-snug text-muted-foreground">Glissez un média sur une piste, ou double-cliquez pour l’ajouter à la tête de lecture.</p>
      {over && <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/80 text-sm font-medium">Déposer pour importer</div>}
    </div>
  );
}

const BinItem = memo(function BinItem({ asset, used }: { asset: AssetRow; used: boolean }) {
  const known = useEditor((s) => asset.durationSec || s.durations[asset.id] || null);
  const thumb = useThumb(asset.id, asset.type === 'VIDEO');
  useEffect(() => {
    if (asset.type === 'IMAGE' || known) return;
    let alive = true;
    probeDuration(asset.id, asset.type).then((d) => alive && d && useEditor.getState().setDuration(asset.id, d));
    return () => {
      alive = false;
    };
  }, [asset.id, asset.type, known]);

  const common = {
    draggable: true,
    onDragStart: (e: React.DragEvent) => {
      const ref = toRef(asset);
      dragState.asset = ref;
      e.dataTransfer.effectAllowed = 'copy';
      e.dataTransfer.setData(ASSET_MIME, JSON.stringify(ref));
    },
    onDragEnd: () => (dragState.asset = null),
    onDoubleClick: () => void actions.insertMedia(toRef(asset)),
    title: `${asset.name} — double-clic : ajouter à la tête de lecture`,
  };

  if (asset.type === 'AUDIO')
    return (
      <div {...common} className="flex cursor-grab items-center gap-2.5 rounded-md border px-2.5 py-2 hover:bg-accent active:cursor-grabbing">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-chart-3/15 text-chart-3">
          <Music className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm">{asset.name}</p>
          <p className="text-xs text-muted-foreground">{known ? humanDuration(known) : '…'}</p>
        </div>
        {used && <span className="size-1.5 shrink-0 rounded-full bg-signal" title="Utilisé dans la séquence" />}
      </div>
    );

  return (
    <div {...common} className="group cursor-grab active:cursor-grabbing">
      <div className="relative aspect-video overflow-hidden rounded-[3px] border bg-stage">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {asset.type === 'IMAGE' ? <img src={fileUrl(asset.id)} alt="" loading="lazy" draggable={false} className="size-full object-cover" /> : thumb ? <img src={thumb} alt="" draggable={false} className="size-full object-cover" /> : null}
        {asset.type === 'VIDEO' && known && <span className="absolute right-1 bottom-1 rounded-[2px] bg-background/90 px-1 font-mono text-[10px] tabular-nums">{humanDuration(known)}</span>}
        {used && <span className="absolute top-1 left-1 size-1.5 rounded-full bg-signal" title="Utilisé dans la séquence" />}
      </div>
      <p className="mt-1 truncate text-xs text-muted-foreground group-hover:text-foreground">{asset.name}</p>
    </div>
  );
});
