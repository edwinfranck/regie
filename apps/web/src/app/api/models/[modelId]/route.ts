import { modelSchema } from '@regie/core';
import { prisma, type Prisma } from '@regie/db';
import { api, body, HttpError } from '@/lib/api';
import { assertCanManage } from '@/lib/server/providers';

type P = { modelId: string };

async function own(user: any, id: string) {
  const m = await prisma.model.findUnique({ where: { id } });
  if (!m) throw new HttpError(404, 'Modèle introuvable.');
  await assertCanManage(user, m.providerId);
  return m;
}

export const PATCH = api<P>(async ({ params, user, req }) => {
  await own(user, params.modelId);
  const { pricing, ...m } = await body(req, modelSchema.partial());
  return prisma.model.update({ where: { id: params.modelId }, data: { ...m, ...(pricing ? { pricing: pricing as Prisma.InputJsonValue } : {}) } });
});

export const DELETE = api<P>(async ({ params, user }) => {
  await own(user, params.modelId);
  await prisma.model.delete({ where: { id: params.modelId } });
  return { ok: true };
});
