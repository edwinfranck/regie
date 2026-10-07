import { conceptSchema } from '@regie/core';
import { prisma } from '@regie/db';
import { recordRevision } from '@regie/studio';
import { api, body, project } from '@/lib/api';

type P = { projectId: string };

export const GET = api<P>(async ({ params, user }) => {
  await project(params.projectId, user);
  return prisma.concept.upsert({ where: { projectId: params.projectId }, create: { projectId: params.projectId }, update: {} });
});

export const PUT = api<P>(async ({ params, user, req }) => {
  await project(params.projectId, user, 'project.edit');
  const data = await body(req, conceptSchema);
  const row = await prisma.concept.upsert({ where: { projectId: params.projectId }, create: { projectId: params.projectId, ...data }, update: data });
  await recordRevision('concept', row.id, params.projectId, row, user.id);
  await prisma.project.update({ where: { id: params.projectId }, data: { updatedAt: new Date() } });
  return row;
});
