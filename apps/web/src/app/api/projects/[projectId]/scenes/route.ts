import { sceneSchema } from '@regie/core';
import { prisma, type Prisma } from '@regie/db';
import { recordRevision } from '@regie/studio';
import { api, body, project } from '@/lib/api';

type P = { projectId: string };

export const sceneInclude = {
  characters: { select: { characterId: true } },
  location: { select: { id: true, code: true, name: true } },
  light: { select: { id: true, code: true, name: true } },
  shots: {
    orderBy: { order: 'asc' as const },
    include: { characters: { select: { characterId: true } }, props: { select: { propId: true } }, frameAsset: { select: { id: true, storageKey: true, width: true, height: true } } },
  },
} satisfies Prisma.SceneInclude;

export const GET = api<P>(async ({ params, user }) => {
  await project(params.projectId, user);
  const [scenes, acts] = await Promise.all([
    prisma.scene.findMany({ where: { projectId: params.projectId }, orderBy: [{ order: 'asc' }, { number: 'asc' }], include: sceneInclude }),
    prisma.act.findMany({ where: { projectId: params.projectId }, orderBy: { order: 'asc' } }),
  ]);
  return { scenes, acts };
});

export const POST = api<P>(async ({ params, user, req }) => {
  await project(params.projectId, user, 'project.edit');
  const { characterIds, breakdown, direction, ...input } = await body(req, sceneSchema);
  const count = await prisma.scene.count({ where: { projectId: params.projectId } });
  const scene = await prisma.scene.create({
    data: {
      ...input,
      projectId: params.projectId,
      number: input.number ?? count + 1,
      order: count,
      breakdown: (breakdown ?? {}) as Prisma.InputJsonValue,
      direction: (direction ?? {}) as Prisma.InputJsonValue,
      characters: { create: (characterIds ?? []).map((characterId) => ({ characterId })) },
    },
    include: sceneInclude,
  });
  await recordRevision('scene', scene.id, params.projectId, { ...scene, shots: undefined }, user.id, 'Création');
  return scene;
});
