import { routeSchema } from '@regie/core';
import { prisma } from '@regie/db';
import { api, body, HttpError } from '@/lib/api';
import { managedWorkspaces } from '@/lib/server/providers';

// Routage : pour une tâche, la liste ordonnée des modèles à essayer en AUTO.
// L'admin règle l'instance ; un espace de travail peut surcharger.
export const PUT = api(async ({ user, req }) => {
  const { task, modelIds } = await body(req, routeSchema);
  const workspaceId = user.isAdmin ? null : (await managedWorkspaces(user))[0];
  if (workspaceId === undefined) throw new HttpError(403, 'Aucun espace de travail à administrer.');
  await prisma.$transaction([
    prisma.modelRoute.deleteMany({ where: { task, workspaceId } }),
    prisma.modelRoute.createMany({ data: modelIds.map((modelId, priority) => ({ task, modelId, priority, workspaceId })) }),
  ]);
  return prisma.modelRoute.findMany({ where: { task, workspaceId }, orderBy: { priority: 'asc' } });
});
