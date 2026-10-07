import { shotSchema } from '@regie/core';
import { prisma, type Prisma } from '@regie/db';
import { recordRevision, renumberShots } from '@regie/studio';
import { z } from 'zod';
import { api, body, HttpError, project } from '@/lib/api';

type P = { projectId: string };

export const shotInclude = {
  characters: { select: { characterId: true } },
  props: { select: { propId: true } },
  frameAsset: { select: { id: true, storageKey: true, width: true, height: true } },
} satisfies Prisma.ShotInclude;

export const GET = api<P>(async ({ params, user, req }) => {
  await project(params.projectId, user);
  const sceneId = req.nextUrl.searchParams.get('sceneId');
  return prisma.shot.findMany({ where: { projectId: params.projectId, ...(sceneId ? { sceneId } : {}) }, orderBy: [{ scene: { order: 'asc' } }, { order: 'asc' }], include: shotInclude });
});

// Création d'un plan, ou de plusieurs d'un coup (découpage proposé par l'IA).
// Les personnages peuvent être donnés par id ou par code (CH1).
const draft = shotSchema.extend({ characters: z.array(z.string()).optional() });
// La forme groupée d'abord : `draft` accepterait {sceneId, shots} en ignorant `shots`.
const payload = z.union([z.object({ sceneId: z.string(), shots: z.array(draft).min(1).max(60), replace: z.boolean().optional() }), draft.strict()]);

export const POST = api<P>(async ({ params, user, req }) => {
  await project(params.projectId, user, 'project.edit');
  const input = await body(req, payload);
  const list = 'shots' in input ? input.shots.map((s) => ({ ...s, sceneId: input.sceneId })) : [input];
  const sceneId = list[0].sceneId;
  if (!sceneId) throw new HttpError(400, 'sceneId requis.');
  const scene = await prisma.scene.findFirst({ where: { id: sceneId, projectId: params.projectId } });
  if (!scene) throw new HttpError(404, 'Scène introuvable.');
  if ('replace' in input && input.replace) await prisma.shot.deleteMany({ where: { sceneId } });

  const chars = await prisma.character.findMany({ where: { projectId: params.projectId }, select: { id: true, code: true } });
  const resolve = (keys: string[] = []) => [...new Set(keys.map((k) => chars.find((c) => c.id === k || c.code === k.toUpperCase())?.id).filter(Boolean) as string[])];
  let order = await prisma.shot.count({ where: { sceneId } });
  const created = [];
  for (const s of list) {
    const { characterIds, characters, propIds, overrides, sceneId: _s, ...rest } = s;
    const row = await prisma.shot.create({
      data: {
        ...rest,
        projectId: params.projectId,
        sceneId,
        order,
        code: `~${Date.now()}-${order}`,
        overrides: (overrides ?? {}) as Prisma.InputJsonValue,
        characters: { create: resolve([...(characterIds ?? []), ...(characters ?? [])]).map((characterId) => ({ characterId })) },
        props: { create: (propIds ?? []).map((propId) => ({ propId })) },
      },
    });
    created.push(row.id);
    order++;
  }
  await renumberShots(sceneId);
  const rows = await prisma.shot.findMany({ where: { id: { in: created } }, include: shotInclude, orderBy: { order: 'asc' } });
  for (const r of rows) await recordRevision('shot', r.id, params.projectId, r, user.id, 'Création');
  return 'shots' in input ? rows : rows[0];
});
