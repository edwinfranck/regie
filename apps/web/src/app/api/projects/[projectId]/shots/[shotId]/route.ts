import { shotSchema } from '@regie/core';
import { prisma, type Prisma } from '@regie/db';
import { recordRevision, renumberShots } from '@regie/studio';
import { z } from 'zod';
import { api, body, HttpError, project } from '@/lib/api';
import { shotInclude } from '../route';

type P = { projectId: string; shotId: string };

async function own(params: P) {
  const s = await prisma.shot.findFirst({ where: { id: params.shotId, projectId: params.projectId } });
  if (!s) throw new HttpError(404, 'Plan introuvable.');
  return s;
}

export const GET = api<P>(async ({ params, user }) => {
  await project(params.projectId, user);
  await own(params);
  return prisma.shot.findUniqueOrThrow({ where: { id: params.shotId }, include: { ...shotInclude, scene: { select: { id: true, number: true, title: true } } } });
});

export const PATCH = api<P>(async ({ params, user, req }) => {
  await project(params.projectId, user, 'project.edit');
  const before = await own(params);
  const { characterIds, propIds, overrides, sceneId, ...rest } = await body(req, shotSchema.extend({ frameAssetId: z.string().nullish() }).partial());
  if (rest.frameAssetId && !(await prisma.asset.findFirst({ where: { id: rest.frameAssetId, projectId: params.projectId } }))) throw new HttpError(400, 'Image étrangère au projet.');
  const moved = sceneId && sceneId !== before.sceneId;
  const row = await prisma.shot.update({
    where: { id: params.shotId },
    data: {
      ...rest,
      ...(overrides ? { overrides: overrides as Prisma.InputJsonValue } : {}),
      ...(moved ? { sceneId, order: await prisma.shot.count({ where: { sceneId } }) } : {}),
      ...(characterIds ? { characters: { deleteMany: {}, create: characterIds.map((characterId) => ({ characterId })) } } : {}),
      ...(propIds ? { props: { deleteMany: {}, create: propIds.map((propId) => ({ propId })) } } : {}),
      version: { increment: 1 },
    },
    include: shotInclude,
  });
  if (moved) {
    await renumberShots(before.sceneId);
    await renumberShots(sceneId!);
  }
  await recordRevision('shot', row.id, params.projectId, { ...row, characterIds: row.characters.map((c) => c.characterId), propIds: row.props.map((p) => p.propId) }, user.id);
  return moved ? prisma.shot.findUniqueOrThrow({ where: { id: row.id }, include: shotInclude }) : row;
});

export const DELETE = api<P>(async ({ params, user }) => {
  await project(params.projectId, user, 'project.edit');
  const s = await own(params);
  await prisma.shot.delete({ where: { id: params.shotId } });
  await renumberShots(s.sceneId);
  return { ok: true };
});
