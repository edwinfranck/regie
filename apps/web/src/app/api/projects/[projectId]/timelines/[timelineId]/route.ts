import { prisma } from '@regie/db';
import { duplicateTimeline, loadSequence, reassemble, saveSequence } from '@regie/studio';
import { z } from 'zod';
import { api, body, HttpError, project } from '@/lib/api';

type P = { projectId: string; timelineId: string };

async function own(params: P) {
  const t = await prisma.timeline.findFirst({ where: { id: params.timelineId, projectId: params.projectId }, select: { id: true } });
  if (!t) throw new HttpError(404, 'Séquence introuvable.');
}

// La séquence complète : pistes, clips, et les médias qu'ils utilisent.
export const GET = api<P>(async ({ params, user }) => {
  await project(params.projectId, user);
  await own(params);
  const { timeline, sequence, media } = await loadSequence(params.timelineId);
  return { id: timeline.id, name: timeline.name, fps: timeline.fps, aspectRatio: timeline.aspectRatio, updatedAt: timeline.updatedAt, sequence, media: [...media.values()].map(({ storageKey: _k, ...m }) => m) };
});

const clip = z.object({
  id: z.string().min(1).max(60),
  assetId: z.string().nullish(),
  shotId: z.string().nullish(),
  name: z.string().max(200).nullish(),
  startSec: z.number().min(0).max(36000),
  inSec: z.number().min(0).max(36000),
  outSec: z.number().min(0).max(36000),
  volume: z.number().min(0).max(4).default(1),
  opacity: z.number().min(0).max(1).default(1),
  fadeInSec: z.number().min(0).max(60).default(0),
  fadeOutSec: z.number().min(0).max(60).default(0),
  text: z.string().max(2000).nullish(),
});
const track = z.object({
  id: z.string().min(1).max(60),
  kind: z.enum(['VIDEO', 'AUDIO', 'DIALOGUE', 'MUSIC', 'SFX', 'SUBTITLE']),
  name: z.string().trim().min(1).max(60),
  order: z.number().int().min(0).max(100),
  muted: z.boolean().default(false),
  locked: z.boolean().default(false),
  volume: z.number().min(0).max(4).default(1),
  clips: z.array(clip).max(2000),
});

// Enregistrement de l'état complet (autosave de l'éditeur).
export const PUT = api<P>(async ({ params, user, req }) => {
  await project(params.projectId, user, 'timeline.edit');
  await own(params);
  const input = await body(req, z.object({ name: z.string().trim().min(1).max(160).optional(), fps: z.number().int().min(1).max(120).optional(), aspectRatio: z.string().max(12).nullish(), tracks: z.array(track).max(30) }));
  const bad = input.tracks.flatMap((t) => t.clips).find((c) => c.outSec <= c.inSec);
  if (bad) throw new HttpError(400, `Clip ${bad.name ?? bad.id} de durée nulle.`);
  await saveSequence(params.timelineId, params.projectId, input as any);
  const t = await prisma.timeline.findUniqueOrThrow({ where: { id: params.timelineId }, select: { updatedAt: true } });
  return { ok: true, updatedAt: t.updatedAt };
});

// Actions : renommer, dupliquer, réassembler depuis le découpage.
export const POST = api<P>(async ({ params, user, req }) => {
  await project(params.projectId, user, 'timeline.edit');
  await own(params);
  const input = await body(req, z.discriminatedUnion('action', [z.object({ action: z.literal('duplicate') }), z.object({ action: z.literal('reassemble') }), z.object({ action: z.literal('rename'), name: z.string().trim().min(1).max(160) })]));
  if (input.action === 'duplicate') return duplicateTimeline(params.timelineId, params.projectId);
  if (input.action === 'reassemble') return reassemble(params.timelineId, params.projectId);
  return prisma.timeline.update({ where: { id: params.timelineId }, data: { name: input.name } });
});

export const DELETE = api<P>(async ({ params, user }) => {
  await project(params.projectId, user, 'timeline.edit');
  await own(params);
  await prisma.timeline.delete({ where: { id: params.timelineId } });
  return { ok: true };
});
