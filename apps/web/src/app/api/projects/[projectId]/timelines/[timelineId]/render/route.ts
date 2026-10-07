import { prisma } from '@regie/db';
import { requestRender } from '@regie/studio';
import { z } from 'zod';
import { api, body, HttpError, project, rateLimit } from '@/lib/api';

type P = { projectId: string; timelineId: string };

export const GET = api<P>(async ({ params, user }) => {
  await project(params.projectId, user);
  return prisma.render.findMany({ where: { timelineId: params.timelineId, projectId: params.projectId }, orderBy: { createdAt: 'desc' }, take: 20, select: { id: true, format: true, status: true, progress: true, assetId: true, error: true, durationSec: true, createdAt: true, finishedAt: true } });
});

// Lance le rendu de la séquence telle qu'enregistrée.
export const POST = api<P>(async ({ params, user, req }) => {
  await project(params.projectId, user, 'timeline.edit');
  await rateLimit(`render:${user.id}`, 10, 600);
  const t = await prisma.timeline.findFirst({ where: { id: params.timelineId, projectId: params.projectId }, select: { id: true } });
  if (!t) throw new HttpError(404, 'Séquence introuvable.');
  const input = await body(req, z.object({ format: z.enum(['mp4', 'mov']).default('mp4'), quality: z.enum(['draft', 'standard', 'high']).default('standard'), burnSubtitles: z.boolean().default(true) }));
  return requestRender(params.timelineId, user.id, input.format, input.quality, input.burnSubtitles);
});
