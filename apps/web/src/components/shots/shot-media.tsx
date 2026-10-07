'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Download, ImageIcon } from 'lucide-react';
import { EmptyState } from '@/components/common/page-header';
import { AssetThumb, fileUrl } from '@/components/common/media';
import { StatusPill } from '@/components/common/status';
import { Button } from '@/components/ui/button';
import { useProjectId } from '@/hooks/use-project';
import { get, patch, toastError } from '@/lib/client';
import { cn } from '@/lib/utils';

export interface ShotAsset {
  id: string;
  type: 'IMAGE' | 'VIDEO' | 'AUDIO' | string;
  name?: string;
  mimeType?: string;
  createdAt: string;
  generation?: { id: string; prompt?: string; mode?: string; model?: { label: string } | null; provider?: { name: string } | null } | null;
}

/** Les fichiers liés à un plan, du plus récent au plus ancien. */
export function useShotAssets(shotId: string) {
  const projectId = useProjectId();
  return useQuery({
    queryKey: ['assets', projectId, 'shot', shotId],
    queryFn: () => get<{ items: ShotAsset[] }>(`/api/projects/${projectId}/assets?shotId=${shotId}&take=60`),
    select: (d) => d.items,
  });
}

/** Les générations en cours pour ce plan, pour ne pas relancer à l'aveugle. */
export function useShotGenerations(shotId: string) {
  const projectId = useProjectId();
  return useQuery({
    queryKey: ['generations', projectId, 'shot', shotId],
    queryFn: () => get<{ items: any[] }>(`/api/projects/${projectId}/generations?status=active&shotId=${shotId}`),
    select: (d) => d.items ?? [],
  });
}

export function ShotMedia({ shot, ratio }: { shot: { id: string; sceneId: string; frameAssetId?: string | null }; ratio: string }) {
  const projectId = useProjectId();
  const qc = useQueryClient();
  const { data: assets = [], isLoading } = useShotAssets(shot.id);
  const { data: running = [] } = useShotGenerations(shot.id);
  const visual = assets.filter((a) => a.type === 'IMAGE' || a.type === 'VIDEO');

  const useAsFrame = useMutation({
    mutationFn: (frameAssetId: string | null) => patch(`/api/projects/${projectId}/shots/${shot.id}`, { frameAssetId }),
    onSuccess: (row: any) => {
      qc.setQueryData(['project', projectId, `shots/${shot.id}`], (old: any) => ({ ...old, frameAssetId: row.frameAssetId, frameAsset: row.frameAsset }));
      qc.invalidateQueries({ queryKey: ['project', projectId, `scenes/${shot.sceneId}`] });
      qc.invalidateQueries({ queryKey: ['project', projectId, 'scenes'] });
    },
    onError: (e) => toastError(e),
  });

  return (
    <div className="space-y-3">
      {running.length > 0 && (
        <ul className="space-y-1 rounded-md border px-3 py-2 text-sm">
          {running.map((g) => (
            <li key={g.id} className="flex items-center justify-between gap-2">
              <span className="truncate">{g.capability === 'VIDEO' ? 'Vidéo' : 'Image'} · {g.model?.label ?? 'AUTO'}</span>
              <StatusPill status={g.status} progress={g.progress} />
            </li>
          ))}
        </ul>
      )}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : !visual.length ? (
        <EmptyState icon={ImageIcon} title="Aucune image ni vidéo" description="Les générations lancées depuis ce plan y sont rattachées automatiquement." className="py-8" />
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {visual.map((a) => {
            const isFrame = shot.frameAssetId === a.id;
            return (
              <figure key={a.id} className={cn('overflow-hidden rounded-md border', isFrame && 'border-foreground')}>
                <AssetThumb asset={a} ratio={ratio} controls={a.type === 'VIDEO'} />
                <figcaption className="space-y-1.5 p-2 text-xs">
                  <p className="truncate text-muted-foreground">
                    {a.generation?.model?.label ?? (a.generation ? 'Génération' : 'Import')} · {new Date(a.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <div className="flex items-center gap-1">
                    {a.type === 'IMAGE' &&
                      (isFrame ? (
                        <Button size="xs" variant="secondary" onClick={() => useAsFrame.mutate(null)} title="Ne plus imposer cette image : la case montrera la plus récente.">
                          <Check /> Case du storyboard
                        </Button>
                      ) : (
                        <Button size="xs" variant="outline" onClick={() => useAsFrame.mutate(a.id)} disabled={useAsFrame.isPending}>
                          Utiliser comme case
                        </Button>
                      ))}
                    <Button size="icon-xs" variant="ghost" asChild>
                      <a href={fileUrl(a.id, true)} aria-label="Télécharger">
                        <Download />
                      </a>
                    </Button>
                  </div>
                </figcaption>
              </figure>
            );
          })}
        </div>
      )}
    </div>
  );
}
