'use client';

import { Check, Loader2, Search, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useProjectId } from '@/hooks/use-project';
import { cn } from '@/lib/utils';
import { ACCEPT, useUpload } from '../assets/upload';
import { type AssetRow, useAssets } from '../assets/use-assets';
import { AssetThumb } from '../common/media';

export interface PickedAsset {
  id: string;
  type: string;
  name?: string;
}

/**
 * Choisir des assets du projet comme entrées d'une génération : grille
 * filtrable, onglet « Références » (bibliothèque), envoi direct d'un fichier.
 */
export function AssetPicker({
  open,
  onOpenChange,
  onPick,
  type = 'IMAGE',
  max = 6,
  title = 'Choisir des images',
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onPick: (assets: PickedAsset[]) => void;
  type?: string;
  max?: number;
  title?: string;
}) {
  const projectId = useProjectId();
  const [tab, setTab] = useState<'all' | 'refs'>('all');
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [picked, setPicked] = useState<PickedAsset[]>([]);
  const file = useRef<HTMLInputElement>(null);
  const { upload, progress, errors } = useUpload(projectId);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => {
    if (open) setPicked([]);
  }, [open]);

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useAssets(projectId, { type, q: debounced, reference: tab === 'refs' ? '1' : undefined }, 36);
  const items = data?.pages.flatMap((p) => p.items) ?? [];

  const toggle = (a: AssetRow) => {
    const on = picked.some((p) => p.id === a.id);
    if (on) setPicked(picked.filter((p) => p.id !== a.id));
    else if (max === 1) setPicked([{ id: a.id, type: a.type, name: a.name }]);
    else if (picked.length < max) setPicked([...picked, { id: a.id, type: a.type, name: a.name }]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{max === 1 ? 'Une seule image.' : `Jusqu’à ${max} fichiers.`} Les références de la bible sont dans l’onglet « Références ».</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Tabs value={tab} onValueChange={(v) => setTab(v as 'all' | 'refs')}>
            <TabsList>
              <TabsTrigger value="all">Tous les assets</TabsTrigger>
              <TabsTrigger value="refs">Références</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative min-w-48 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nom, tag ou prompt" className="pl-8" />
          </div>
          <input
            ref={file}
            type="file"
            multiple={max > 1}
            accept={type === 'IMAGE' ? 'image/png,image/jpeg,image/webp,image/gif' : ACCEPT}
            className="hidden"
            onChange={async (e) => {
              const list = [...(e.target.files ?? [])];
              e.target.value = '';
              const created = await upload(list, tab === 'refs' ? { isReference: 'true' } : {});
              if (created.length) setPicked((prev) => [...prev, ...created.map((a) => ({ id: a.id, type: a.type, name: a.name }))].slice(-max));
            }}
          />
          <Button variant="outline" onClick={() => file.current?.click()} disabled={progress !== null}>
            {progress !== null ? <Loader2 className="animate-spin" /> : <Upload />} Envoyer un fichier
          </Button>
        </div>
        {progress !== null && <Progress value={progress} className="h-1" />}
        {errors.length > 0 && (
          <ul className="space-y-0.5 text-sm text-destructive">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}

        <div className="min-h-64 flex-1 overflow-y-auto">
          {isLoading ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Chargement…</p>
          ) : items.length === 0 ? (
            <div className="rounded-md border border-dashed px-6 py-12 text-center text-sm text-muted-foreground">
              {tab === 'refs' ? 'Aucune référence dans ce projet. Marquez un asset comme référence, ou envoyez un fichier ici.' : debounced ? 'Aucun asset ne correspond.' : 'Aucun asset dans ce projet pour l’instant.'}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
              {items.map((a) => {
                const on = picked.some((p) => p.id === a.id);
                return (
                  <button key={a.id} type="button" onClick={() => toggle(a)} className={cn('group relative overflow-hidden rounded-sm border text-left', on ? 'border-foreground ring-2 ring-foreground' : 'hover:border-foreground/50')}>
                    <AssetThumb asset={a} ratio="1:1" />
                    <span className="block truncate px-1.5 py-1 text-xs">{a.name}</span>
                    {on && (
                      <span className="absolute top-1 right-1 flex size-5 items-center justify-center rounded-sm bg-foreground text-background">
                        <Check className="size-3.5" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
          {hasNextPage && (
            <div className="pt-3 text-center">
              <Button variant="ghost" size="sm" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
                {isFetchingNextPage ? <Loader2 className="animate-spin" /> : null} Charger plus
              </Button>
            </div>
          )}
        </div>

        <DialogFooter className="items-center sm:justify-between">
          <span className="text-sm text-muted-foreground">{picked.length ? `${picked.length} sélectionné${picked.length > 1 ? 's' : ''}` : 'Rien de sélectionné'}</span>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button
              disabled={!picked.length}
              onClick={() => {
                onPick(picked);
                onOpenChange(false);
              }}
            >
              Ajouter
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
