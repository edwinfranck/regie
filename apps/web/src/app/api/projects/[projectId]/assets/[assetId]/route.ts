import { prisma } from '@regie/db';
import { deleteObject } from '@regie/storage';
import { z } from 'zod';
import { api, body, HttpError, project } from '@/lib/api';

type P = { projectId: string; assetId: string };

async function own(params: P) {
  const a = await prisma.asset.findFirst({ where: { id: params.assetId, projectId: params.projectId } });
  if (!a) throw new HttpError(404, 'Asset introuvable.');
  return a;
}

export const GET = api<P>(async ({ params, user }) => {
  await project(params.projectId, user);
  await own(params);
  return prisma.asset.findUniqueOrThrow({
    where: { id: params.assetId },
    include: {
      generation: { include: { model: { select: { label: true, modelId: true } }, provider: { select: { name: true } } } },
      links: { include: { character: { select: { code: true, name: true } }, location: { select: { code: true, name: true } }, shot: { select: { code: true } }, scene: { select: { number: true } } } },
      parent: { select: { id: true, name: true } },
      children: { select: { id: true, name: true, createdAt: true } },
    },
  });
});

const patchSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  tags: z.array(z.string().max(40)).max(20).optional(),
  isReference: z.boolean().optional(),
  referenceKind: z.enum(['character', 'location', 'costume', 'style', 'composition', 'prop']).nullish(),
  link: z.object({ characterId: z.string().optional(), locationId: z.string().optional(), shotId: z.string().optional(), sceneId: z.string().optional(), propId: z.string().optional() }).optional(),
  unlink: z.string().optional(),
});

export const PATCH = api<P>(async ({ params, user, req }) => {
  await project(params.projectId, user, 'project.edit');
  await own(params);
  const { link, unlink, ...data } = await body(req, patchSchema);
  if (link) await prisma.assetLink.create({ data: { assetId: params.assetId, ...link } });
  if (unlink) await prisma.assetLink.deleteMany({ where: { id: unlink, assetId: params.assetId } });
  return prisma.asset.update({ where: { id: params.assetId }, data, include: { links: true } });
});

export const DELETE = api<P>(async ({ params, user }) => {
  await project(params.projectId, user, 'project.edit');
  const a = await own(params);
  await prisma.asset.delete({ where: { id: a.id } });
  await deleteObject(a.storageKey).catch(() => {});
  return { ok: true };
});
