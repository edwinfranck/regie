import { worldSchema } from '@regie/core';
import { prisma } from '@regie/db';
import { recordRevision } from '@regie/studio';
import { api, body, project } from '@/lib/api';

type P = { projectId: string };

export const GET = api<P>(async ({ params, user }) => {
  await project(params.projectId, user);
  return prisma.world.upsert({ where: { projectId: params.projectId }, create: { projectId: params.projectId }, update: {} });
});

export const PUT = api<P>(async ({ params, user, req }) => {
  await project(params.projectId, user, 'project.edit');
  const { sections } = await body(req, worldSchema);
  const row = await prisma.world.upsert({ where: { projectId: params.projectId }, create: { projectId: params.projectId, sections }, update: { sections, version: { increment: 1 } } });
  await recordRevision('world', row.id, params.projectId, row, user.id);
  return row;
});
