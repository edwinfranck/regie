'use client';

import type { RoleName } from '@regie/core';
import { useQueryClient } from '@tanstack/react-query';
import { useAutosave } from '@/hooks/use-autosave';
import { useProjectId } from '@/hooks/use-project';
import { patch } from '@/lib/client';

export const ROLE_LABELS: Record<RoleName, string> = {
  OWNER: 'Propriétaire',
  ADMIN: 'Administrateur',
  DIRECTOR: 'Réalisateur',
  WRITER: 'Scénariste',
  ART_DIRECTOR: 'Directeur artistique',
  EDITOR: 'Monteur',
  VIEWER: 'Lecteur',
};

export const ROLE_HINTS: Record<RoleName, string> = {
  OWNER: 'tous les droits',
  ADMIN: 'membres, règles, suppression',
  DIRECTOR: 'tout le contenu, génération, montage',
  WRITER: 'scénario, bible, histoire',
  ART_DIRECTOR: 'bible, styles, références, génération',
  EDITOR: 'génération, montage',
  VIEWER: 'lecture et commentaires',
};

const RANK: Record<RoleName, number> = { VIEWER: 0, EDITOR: 1, ART_DIRECTOR: 1, WRITER: 1, DIRECTOR: 2, ADMIN: 3, OWNER: 4 };
export const isProjectAdmin = (role?: RoleName | null) => !!role && RANK[role] >= 3;
export const canArt = (role?: RoleName | null) => !!role && ['ART_DIRECTOR', 'DIRECTOR', 'ADMIN', 'OWNER'].includes(role);
export const canEditProject = (role?: RoleName | null) => !!role && ['WRITER', 'ART_DIRECTOR', 'DIRECTOR', 'ADMIN', 'OWNER'].includes(role);

/**
 * Modifications du projet : cache mis à jour tout de suite, PATCH différé.
 * `rules` et `motion` partent toujours en objets complets.
 */
export function useProjectPatch() {
  const projectId = useProjectId();
  const qc = useQueryClient();
  const { queue, flush } = useAutosave<Record<string, unknown>>(async (p) => {
    const row = await patch(`/api/projects/${projectId}`, p);
    qc.setQueryData(['project', projectId], (old: any) => (old ? { ...old, ...row } : old));
    qc.invalidateQueries({ queryKey: ['project', projectId, 'lint'] });
  });
  const set = (p: Record<string, unknown>) => {
    qc.setQueryData(['project', projectId], (old: any) => (old ? { ...old, ...p } : old));
    queue(p);
  };
  return { set, flush };
}
