import { reorderSchema } from '@regie/core';
import { prisma } from '@regie/db';
import { renumberScenes } from '@regie/studio';
import { z } from 'zod';
import { api, body, project } from '@/lib/api';

// Déplacement sur la story map : nouvel ordre, acte éventuel, renumérotation.
export const POST = api<{ projectId: string }>(async ({ params, user, req }) => {
  await project(params.projectId, user, 'project.edit');
  const { ids, acts } = await body(req, reorderSchema.extend({ acts: z.record(z.string(), z.string().nullable()).optional() }));
  const owned = await prisma.scene.count({ where: { projectId: params.projectId, id: { in: ids } } });
  if (owned !== ids.length) return Response.json({ error: 'Scène étrangère au projet.' }, { status: 400 });
  await prisma.$transaction(ids.map((id, order) => prisma.scene.update({ where: { id }, data: { order, ...(acts && id in acts ? { actId: acts[id] } : {}) } })));
  await renumberScenes(params.projectId);
  return { ok: true };
});
