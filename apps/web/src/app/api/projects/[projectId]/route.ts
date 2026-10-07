import { projectUpdateSchema } from '@regie/core';
import { prisma, type Prisma } from '@regie/db';
import { api, audit, body, project } from '@/lib/api';

type P = { projectId: string };

export const GET = api<P>(async ({ params, user }) => {
  const role = await project(params.projectId, user);
  const p = await prisma.project.findUniqueOrThrow({
    where: { id: params.projectId },
    include: {
      concept: true,
      favorites: { where: { userId: user.id }, select: { userId: true } },
      _count: { select: { characters: true, locations: true, props: true, scenes: true, shots: true, assets: true, generations: true } },
    },
  });
  // Compteurs exacts par type, pour la vue d'ensemble.
  const byType = await prisma.asset.groupBy({ by: ['type'], where: { projectId: params.projectId }, _count: true });
  const assetCounts = Object.fromEntries(byType.map((t) => [t.type, t._count]));
  return { ...p, favorite: p.favorites.length > 0, role, assetCounts };
});

export const PATCH = api<P>(async ({ params, user, req }) => {
  const input = await body(req, projectUpdateSchema);
  await project(params.projectId, user, input.rules || input.motion || input.archived !== undefined ? 'project.admin' : 'project.edit');
  const { archived, ...rest } = input;
  const p = await prisma.project.update({
    where: { id: params.projectId },
    data: { ...(rest as Prisma.ProjectUpdateInput), ...(archived !== undefined ? { archivedAt: archived ? new Date() : null } : {}) },
  });
  return p;
});

export const DELETE = api<P>(async ({ params, user }) => {
  await project(params.projectId, user, 'project.admin');
  await prisma.project.delete({ where: { id: params.projectId } });
  await audit(user.id, 'project.delete', 'project', params.projectId);
  return { ok: true };
});
