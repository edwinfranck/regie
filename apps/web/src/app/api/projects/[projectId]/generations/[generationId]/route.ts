import { prisma, type Prisma } from '@regie/db';
import { cancelGeneration, enqueueGeneration, queue } from '@regie/jobs';
import { createGeneration } from '@regie/studio';
import { z } from 'zod';
import { api, body, HttpError, project } from '@/lib/api';
import { generationInclude } from '../route';

type P = { projectId: string; generationId: string };

async function own(params: P) {
  const g = await prisma.generation.findFirst({ where: { id: params.generationId, projectId: params.projectId }, include: { ...generationInclude, jobs: { orderBy: { createdAt: 'asc' } } } });
  if (!g) throw new HttpError(404, 'Génération introuvable.');
  return g;
}

export const GET = api<P>(async ({ params, user }) => {
  await project(params.projectId, user);
  return own(params);
});

// Relancer (même demande), ou relancer avec un autre modèle.
export const POST = api<P>(async ({ params, user, req }) => {
  await project(params.projectId, user, 'generate');
  const g = await own(params);
  const { modelId } = await body(req, z.object({ modelId: z.string().optional() }));
  if (!modelId && (g.status === 'FAILED' || g.status === 'CANCELED')) {
    // Même modèle : on remet la même génération en file.
    const old = await queue().getJob(g.id);
    if (old) await old.remove().catch(() => {});
    await prisma.generation.update({ where: { id: g.id }, data: { status: 'QUEUED', error: null, errorCode: null, progress: 0, finishedAt: null } });
    const job = await enqueueGeneration(g.id);
    await prisma.generationJob.create({ data: { generationId: g.id, queueJobId: String(job.id) } });
    return own(params);
  }
  const p = g.params as Record<string, any>;
  const { links, inputRoles, ...rest } = p;
  const created = await createGeneration(
    { capability: g.capability as any, mode: g.mode as any, modelId: modelId ?? 'auto', prompt: g.prompt, negative: g.negative ?? undefined, shotId: g.shotId, target: g.target, inputAssetIds: g.inputAssetIds, inputRoles: inputRoles ?? [], links: links ?? {}, params: rest },
    { userId: user.id, projectId: params.projectId },
  );
  return prisma.generation.findUniqueOrThrow({ where: { id: created.id }, include: generationInclude as Prisma.GenerationInclude });
});

export const DELETE = api<P>(async ({ params, user }) => {
  await project(params.projectId, user, 'generate');
  const g = await own(params);
  if (g.status === 'QUEUED' || g.status === 'PROCESSING') {
    await cancelGeneration(g.id);
    await prisma.generation.update({ where: { id: g.id }, data: { status: 'CANCELED', finishedAt: new Date() } });
  }
  return { ok: true };
});
