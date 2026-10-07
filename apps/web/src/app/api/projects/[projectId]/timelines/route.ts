import { prisma } from '@regie/db';
import { createTimeline } from '@regie/studio';
import { z } from 'zod';
import { api, body, project } from '@/lib/api';

type P = { projectId: string };

export const GET = api<P>(async ({ params, user }) => {
  await project(params.projectId, user);
  const rows = await prisma.timeline.findMany({
    where: { projectId: params.projectId },
    orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    include: { tracks: { select: { clips: { select: { startSec: true, inSec: true, outSec: true } } } }, renders: { orderBy: { createdAt: 'desc' }, take: 1, select: { status: true, assetId: true, createdAt: true } } },
  });
  return rows.map(({ tracks, renders, ...t }) => ({
    ...t,
    clipCount: tracks.reduce((n, tr) => n + tr.clips.length, 0),
    durationSec: tracks.reduce((m, tr) => Math.max(m, ...tr.clips.map((c) => c.startSec + c.outSec - c.inSec), 0), 0),
    lastRender: renders[0] ?? null,
  }));
});

export const POST = api<P>(async ({ params, user, req }) => {
  await project(params.projectId, user, 'timeline.edit');
  const input = await body(req, z.object({ name: z.string().trim().min(1).max(160).default('Séquence 1'), assemble: z.boolean().default(true), aspectRatio: z.string().max(12).nullish() }));
  const { timeline, missing } = await createTimeline(params.projectId, input);
  return { ...timeline, missing };
});
