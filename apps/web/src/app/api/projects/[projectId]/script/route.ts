import { scriptSchema } from '@regie/core';
import { prisma, type Prisma } from '@regie/db';
import { recordRevision } from '@regie/studio';
import { api, body, project } from '@/lib/api';

type P = { projectId: string };

export const GET = api<P>(async ({ params, user }) => {
  await project(params.projectId, user);
  return prisma.script.upsert({ where: { projectId: params.projectId }, create: { projectId: params.projectId }, update: {} });
});

// L'autosave écrase ; la sauvegarde manuelle (snapshot) crée une version.
export const PUT = api<P>(async ({ params, user, req }) => {
  await project(params.projectId, user, 'script.edit');
  const input = await body(req, scriptSchema);
  const doc = (input.doc ?? undefined) as Prisma.InputJsonValue | undefined;
  const row = await prisma.script.upsert({
    where: { projectId: params.projectId },
    create: { projectId: params.projectId, fountain: input.fountain, doc },
    update: { fountain: input.fountain, doc, ...(input.snapshot ? { version: { increment: 1 } } : {}) },
  });
  if (input.snapshot) await recordRevision('script', row.id, params.projectId, { fountain: row.fountain }, user.id, input.message ?? undefined);
  return { id: row.id, version: row.version, updatedAt: row.updatedAt };
});
