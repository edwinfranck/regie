import type { RoleName } from '@regie/core';
import { prisma } from '@regie/db';
import { StudioError } from './errors';

// RBAC. Le rôle effectif d'un utilisateur sur un projet est le plus élevé
// entre son rôle dans le projet et son rôle dans l'espace de travail ; le
// propriétaire du projet est OWNER.

export type Action =
  | 'project.read'
  | 'project.edit' // bible, histoire, scènes, plans
  | 'script.edit'
  | 'art.edit' // styles, références, génération d'images
  | 'generate'
  | 'timeline.edit'
  | 'project.admin' // membres, suppression, réglages
  | 'comment';

const RANK: Record<RoleName, number> = { VIEWER: 0, EDITOR: 1, ART_DIRECTOR: 1, WRITER: 1, DIRECTOR: 2, ADMIN: 3, OWNER: 4 };

const ALLOWED: Record<Action, RoleName[]> = {
  'project.read': ['VIEWER', 'EDITOR', 'ART_DIRECTOR', 'WRITER', 'DIRECTOR', 'ADMIN', 'OWNER'],
  comment: ['VIEWER', 'EDITOR', 'ART_DIRECTOR', 'WRITER', 'DIRECTOR', 'ADMIN', 'OWNER'],
  'script.edit': ['WRITER', 'DIRECTOR', 'ADMIN', 'OWNER'],
  'project.edit': ['WRITER', 'ART_DIRECTOR', 'DIRECTOR', 'ADMIN', 'OWNER'],
  'art.edit': ['ART_DIRECTOR', 'DIRECTOR', 'ADMIN', 'OWNER'],
  generate: ['ART_DIRECTOR', 'EDITOR', 'DIRECTOR', 'ADMIN', 'OWNER'],
  'timeline.edit': ['EDITOR', 'DIRECTOR', 'ADMIN', 'OWNER'],
  'project.admin': ['ADMIN', 'OWNER'],
};

export async function roleOn(projectId: string, userId: string): Promise<RoleName | null> {
  const p = await prisma.project.findUnique({
    where: { id: projectId },
    select: { ownerId: true, members: { where: { userId }, select: { role: true } }, workspace: { select: { members: { where: { userId }, select: { role: true } } } } },
  });
  if (!p) return null;
  if (p.ownerId === userId) return 'OWNER';
  const roles = [p.members[0]?.role, p.workspace.members[0]?.role].filter(Boolean) as RoleName[];
  if (!roles.length) return null;
  return roles.sort((a, b) => RANK[b] - RANK[a])[0];
}

export const can = (role: RoleName | null, action: Action) => !!role && ALLOWED[action].includes(role);

/** Lève 404 (pas 403) quand le projet n'est pas visible : on ne révèle pas son existence. */
export async function requireProject(projectId: string, userId: string, action: Action = 'project.read') {
  const role = await roleOn(projectId, userId);
  if (!role) throw new StudioError('not_found', 'Projet introuvable.');
  if (!can(role, action)) throw new StudioError('forbidden', 'Votre rôle sur ce projet ne permet pas cette action.');
  return role;
}
