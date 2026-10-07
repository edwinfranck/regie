import { reorderSchema } from '@regie/core';
import { prisma } from '@regie/db';
import { renumberShots } from '@regie/studio';
import { z } from 'zod';
import { api, body, project } from '@/lib/api';

export const POST = api<{ projectId: string }>(async ({ params, user, req }) => {
  await project(params.projectId, user, 'project.edit');
  const { ids, sceneId } = await body(req, reorderSchema.extend({ sceneId: z.string() }));
  const owned = await prisma.shot.findMany({ where: { projectId: params.projectId, id: { in: ids } }, select: { sceneId: true } });
  if (owned.length !== ids.length) return Response.json({ error: 'Plan étranger au projet.' }, { status: 400 });
  const touched = new Set([sceneId, ...owned.map((o) => o.sceneId)]);
  await prisma.$transaction(ids.map((id, order) => prisma.shot.update({ where: { id }, data: { order, sceneId } })));
  for (const s of touched) await renumberShots(s);
  return { ok: true };
});
