import { toEdl, toSrt } from '@regie/core';
import { prisma } from '@regie/db';
import { loadSequence } from '@regie/studio';
import { api, HttpError, project } from '@/lib/api';

// Échanges avec les logiciels de montage : sous-titres SRT, EDL CMX3600.
export const GET = api<{ projectId: string; timelineId: string }>(async ({ params, user, req }) => {
  await project(params.projectId, user);
  const t = await prisma.timeline.findFirst({ where: { id: params.timelineId, projectId: params.projectId }, select: { id: true } });
  if (!t) throw new HttpError(404, 'Séquence introuvable.');
  const { sequence, media } = await loadSequence(params.timelineId);
  const format = req.nextUrl.searchParams.get('format') === 'edl' ? 'edl' : 'srt';
  const body = format === 'edl' ? toEdl(sequence, media) : toSrt(sequence);
  const name = `${sequence.name.replace(/[^\w.-]+/g, '_')}.${format}`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Content-Disposition': `attachment; filename="${name}"` } });
});
