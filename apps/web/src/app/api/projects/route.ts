import { projectCreateSchema } from '@regie/core';
import { prisma } from '@regie/db';
import { createProject } from '@regie/studio';
import { api, audit, body } from '@/lib/api';

export const GET = api(async ({ user, req }) => {
  const archived = req.nextUrl.searchParams.get('archived') === '1';
  const projects = await prisma.project.findMany({
    where: {
      archivedAt: archived ? { not: null } : null,
      OR: [{ ownerId: user.id }, { members: { some: { userId: user.id } } }, { workspace: { members: { some: { userId: user.id } } } }],
    },
    orderBy: { updatedAt: 'desc' },
    include: {
      favorites: { where: { userId: user.id }, select: { userId: true } },
      cover: { select: { storageKey: true } },
      concept: { select: { logline: true } },
      _count: { select: { characters: true, locations: true, scenes: true, shots: true, assets: true } },
    },
  });
  return projects.map(({ favorites, ...p }) => ({ ...p, favorite: favorites.length > 0 }));
});

export const POST = api(async ({ user, req }) => {
  const input = await body(req, projectCreateSchema);
  const p = await createProject(user.id, input);
  await audit(user.id, 'project.create', 'project', p.id);
  return p;
});
