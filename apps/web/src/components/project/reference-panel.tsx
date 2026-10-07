'use client';

import { CHARACTER_VIEWS, LOCATION_VIEWS } from '@regie/core';
import { useQueryClient } from '@tanstack/react-query';
import { Check, Loader2, Sparkles, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useProjectId } from '@/hooks/use-project';
import { patch, post, toastError } from '@/lib/client';
import { cn } from '@/lib/utils';
import { AssetThumb } from '../common/media';
import { type GenerateRequest, QuickGenerate } from '../generation/quick-generate';

type Kind = 'character' | 'location' | 'prop' | 'style';
const PLURAL: Record<Kind, string> = { character: 'characters', location: 'locations', prop: 'props', style: 'styles' };
const LINK: Record<Kind, string> = { character: 'characterId', location: 'locationId', prop: 'propId', style: '' };

/**
 * Le moteur de cohérence côté interface : l'image de référence d'une entité,
 * les vues à générer pour la fixer, et toutes les images qui la montrent.
 * La référence est ensuite chargée automatiquement dans chaque plan où
 * l'entité apparaît.
 */
export function ReferencePanel({ kind, entity, assets = [], ratio = '1:1' }: { kind: Kind; entity: { id: string; name: string; code: string; refAssetId?: string | null }; assets?: { id: string; type: string; isReference?: boolean }[]; ratio?: string }) {
  const projectId = useProjectId();
  const qc = useQueryClient();
  const file = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [request, setRequest] = useState<GenerateRequest | null>(null);
  const [loadingView, setLoadingView] = useState<string | null>(null);
  const views: Record<string, string> = kind === 'character' ? CHARACTER_VIEWS : kind === 'location' ? LOCATION_VIEWS : {};
  const primaryView = kind === 'character' ? 'sheet' : kind === 'location' ? 'establishing' : null;
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['project', projectId] });
  };

  async function setRef(assetId: string) {
    try {
      await patch(`/api/projects/${projectId}/bible/${PLURAL[kind]}/${entity.id}`, { refAssetId: assetId });
      toast.success('Référence mise à jour', { description: 'Elle sera chargée dans chaque plan où apparaît cet élément.' });
      refresh();
    } catch (e) {
      toastError(e);
    }
  }

  async function openView(view: string) {
    setLoadingView(view);
    try {
      const prompt = await post(`/api/projects/${projectId}/prompts`, { kind, id: entity.id, view });
      setRequest({
        capability: 'IMAGE',
        mode: 'text-to-image',
        prompt,
        title: `${entity.code} ${entity.name} — ${views[view]}`,
        aspectRatio: view === 'sheet' || view === 'expressions' || view === 'poses' || view === 'angles' ? '16:9' : kind === 'location' ? '16:9' : '1:1',
        // Les vues secondaires partent de la feuille existante pour rester fidèles.
        inputs: view !== primaryView && entity.refAssetId ? [{ assetId: entity.refAssetId, role: 'reference' }] : [],
        links: { ...(kind === 'character' ? { characterIds: [entity.id] } : kind === 'location' ? { locationId: entity.id } : {}), ...(view === primaryView ? { setAsRefOf: { type: kind, id: entity.id } } : {}) },
      });
    } catch (e) {
      toastError(e);
    } finally {
      setLoadingView(null);
    }
  }

  const images = assets.filter((a) => a.type === 'IMAGE');
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <AssetThumb asset={entity.refAssetId ? { id: entity.refAssetId, type: 'IMAGE' } : null} ratio={ratio} fit="contain" className="rounded-md border" />
        {!entity.refAssetId && <p className="text-sm text-warning">Pas encore de référence : chaque génération réinventera cet élément.</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        {primaryView && (
          <Button size="sm" onClick={() => openView(primaryView)} disabled={!!loadingView} className="bg-signal text-signal-foreground hover:bg-signal/90">
            {loadingView === primaryView ? <Loader2 className="animate-spin" /> : <Sparkles />} {kind === 'character' ? 'Générer la feuille' : 'Générer la plaque'}
          </Button>
        )}
        {Object.keys(views).length > 1 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" disabled={!!loadingView}>
                Autres vues
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {Object.entries(views)
                .filter(([k]) => k !== primaryView)
                .map(([k, label]) => (
                  <DropdownMenuItem key={k} onClick={() => openView(k)}>
                    {label}
                  </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <input
          ref={file}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            setUploading(true);
            try {
              const fd = new FormData();
              fd.append('file', f);
              fd.append('isReference', 'true');
              fd.append('referenceKind', kind);
              if (LINK[kind]) fd.append(LINK[kind], entity.id);
              const res = await fetch(`/api/projects/${projectId}/assets`, { method: 'POST', body: fd });
              const data = await res.json();
              if (!res.ok) throw new Error(data.error);
              await setRef(data[0].id);
            } catch (err) {
              toastError(err, 'Import impossible');
            } finally {
              setUploading(false);
              e.target.value = '';
            }
          }}
        />
        <Button size="sm" variant="outline" onClick={() => file.current?.click()} disabled={uploading}>
          {uploading ? <Loader2 className="animate-spin" /> : <Upload />} Importer
        </Button>
      </div>
      {images.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-sm font-medium">Images liées ({images.length})</p>
          <div className="grid grid-cols-3 gap-1.5">
            {images.map((a) => (
              <button key={a.id} onClick={() => a.id !== entity.refAssetId && setRef(a.id)} title={a.id === entity.refAssetId ? 'Référence actuelle' : 'Définir comme référence'} className={cn('group relative overflow-hidden rounded-sm border', a.id === entity.refAssetId && 'ring-2 ring-signal')}>
                <AssetThumb asset={a} ratio="1:1" />
                {a.id === entity.refAssetId && (
                  <span className="absolute top-1 right-1 rounded-full bg-signal p-0.5 text-signal-foreground">
                    <Check className="size-3" />
                  </span>
                )}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Cliquer une image pour en faire la référence.</p>
        </div>
      )}
      <QuickGenerate request={request} open={!!request} onOpenChange={(o) => !o && setRequest(null)} />
    </div>
  );
}
