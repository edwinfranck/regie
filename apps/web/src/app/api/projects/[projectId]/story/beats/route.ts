import { prisma } from '@regie/db';
import { z } from 'zod';
import { api, body, project } from '@/lib/api';

type P = { projectId: string };

const beat = z.object({
  id: z.string().optional(),
  key: z.string().max(60).optional(),
  title: z.string().trim().min(1).max(200),
  description: z.string().max(8000).default(''),
  sceneId: z.string().nullish(),
});

// Enregistre la liste complète des temps forts, dans l'ordre donné.
export const PUT = api<P>(async ({ params, user, req }) => {
  await project(params.projectId, user, 'project.edit');
  const { beats } = await body(req, z.object({ beats: z.array(beat).max(60) }));
  const story = await prisma.story.findUniqueOrThrow({ where: { projectId: params.projectId }, include: { beats: true } });
  const keep = beats.map((b) => b.id).filter(Boolean) as string[];
  await prisma.$transaction([
    prisma.storyBeat.deleteMany({ where: { storyId: story.id, id: { notIn: keep } } }),
    ...beats.map((b, order) =>
      b.id && story.beats.some((x) => x.id === b.id)
        ? prisma.storyBeat.update({ where: { id: b.id }, data: { title: b.title, description: b.description, sceneId: b.sceneId ?? null, order } })
        : prisma.storyBeat.create({ data: { storyId: story.id, key: b.key ?? `custom-${Date.now()}-${order}`, title: b.title, description: b.description, sceneId: b.sceneId ?? null, order } }),
    ),
  ]);
  return prisma.storyBeat.findMany({ where: { storyId: story.id }, orderBy: { order: 'asc' } });
});
