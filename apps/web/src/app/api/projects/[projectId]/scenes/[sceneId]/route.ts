import { sceneSchema } from '@regie/core';
import { prisma, type Prisma } from '@regie/db';
import { recordRevision, renumberScenes, renumberShots } from '@regie/studio';
import { api, body, HttpError, project } from '@/lib/api';
import { sceneInclude } from '../route';

type P = { projectId: string; sceneId: string };

async function own(params: P) {
  const s = await prisma.scene.findFirst({ where: { id: params.sceneId, projectId: params.projectId }, select: { id: true, number: true } });
  if (!s) throw new HttpError(404, 'Scène introuvable.');
  return s;
}

export const GET = api<P>(async ({ params, user }) => {
  await project(params.projectId, user);
  await own(params);
  return prisma.scene.findUniqueOrThrow({ where: { id: params.sceneId }, include: sceneInclude });
});

export const PATCH = api<P>(async ({ params, user, req }) => {
  await project(params.projectId, user, 'project.edit');
  const before = await own(params);
  const { characterIds, breakdown, direction, ...input } = await body(req, sceneSchema.partial());
  const scene = await prisma.scene.update({
    where: { id: params.sceneId },
    data: {
      ...input,
      ...(breakdown ? { breakdown: breakdown as Prisma.InputJsonValue } : {}),
      ...(direction ? { direction: direction as Prisma.InputJsonValue } : {}),
      ...(characterIds ? { characters: { deleteMany: {}, create: characterIds.map((characterId) => ({ characterId })) } } : {}),
      version: { increment: 1 },
    },
    include: sceneInclude,
  });
  // Le numéro de scène fait partie du code des plans (12A) : on le propage.
  if (input.number !== undefined && input.number !== before.number) await renumberShots(scene.id);
  await recordRevision('scene', scene.id, params.projectId, { ...scene, shots: undefined, characterIds: scene.characters.map((c) => c.characterId) }, user.id);
  return prisma.scene.findUniqueOrThrow({ where: { id: params.sceneId }, include: sceneInclude });
});

export const DELETE = api<P>(async ({ params, user }) => {
  await project(params.projectId, user, 'project.edit');
  await own(params);
  await prisma.scene.delete({ where: { id: params.sceneId } });
  await renumberScenes(params.projectId);
  return { ok: true };
});
