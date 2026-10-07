'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { get } from '@/lib/client';

export interface AssetRow {
  id: string;
  type: 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT';
  source: 'UPLOAD' | 'GENERATED' | 'IMPORTED';
  name: string;
  mimeType: string;
  sizeBytes: number;
  width?: number | null;
  height?: number | null;
  durationSec?: number | null;
  isReference: boolean;
  referenceKind?: string | null;
  tags: string[];
  createdAt: string;
  generation?: { id: string; prompt: string; mode: string; costUsd: number | null; model?: { label: string } | null; provider?: { name: string } | null } | null;
  links: { characterId?: string | null; locationId?: string | null; sceneId?: string | null; shotId?: string | null; propId?: string | null }[];
}

export type AssetFilters = Record<string, string | undefined>;

/**
 * Assets du projet par pages (curseur). La clé commence par ['assets'] :
 * l'arrivée d'une génération la rafraîchit automatiquement.
 */
export function useAssets(projectId: string, filters: AssetFilters, take = 48) {
  const clean = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== undefined && v !== ''));
  return useInfiniteQuery({
    queryKey: ['assets', projectId, clean],
    queryFn: ({ pageParam }) => {
      const qs = new URLSearchParams({ ...(clean as Record<string, string>), take: String(take), ...(pageParam ? { cursor: pageParam } : {}) });
      return get<{ items: AssetRow[]; nextCursor: string | null }>(`/api/projects/${projectId}/assets?${qs}`);
    },
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    enabled: !!projectId,
  });
}
