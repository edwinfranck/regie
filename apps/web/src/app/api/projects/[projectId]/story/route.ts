import { structureById } from '@regie/core';
import { prisma } from '@regie/db';
import { z } from 'zod';
import { api, body, project } from '@/lib/api';

type P = { projectId: string };

const include = { beats: { orderBy: { order: 'asc' as const }, include: { scene: { select: { id: true, number: true, title: true } } } } };

export const GET = api<P>(async ({ params, user }) => {
  await project(params.projectId, user);
  return prisma.story.upsert({ where: { projectId: params.projectId }, create: { projectId: params.projectId }, update: {}, include });
});

// Changer de structure remplace les temps forts vides et garde ceux qui ont
// déjà du contenu, pour ne rien perdre de ce que l'auteur a écrit.
export const PUT = api<P>(async ({ params, user, req }) => {
  await project(params.projectId, user, 'project.edit');
  const { structure } = await body(req, z.object({ structure: z.string().max(40) }));
  const tpl = structureById(structure);
  const story = await prisma.story.upsert({ where: { projectId: params.projectId }, create: { projectId: params.projectId, structure: tpl.id }, update: { structure: tpl.id }, include: { beats: true } });
  const kept = story.beats.filter((b) => b.description.trim() || b.sceneId);
  await prisma.storyBeat.deleteMany({ where: { storyId: story.id, id: { notIn: kept.map((b) => b.id) } } });
  const fresh = tpl.beats.filter((b) => !kept.some((k) => k.key === b.key));
  await prisma.storyBeat.createMany({ data: fresh.map((b) => ({ storyId: story.id, key: b.key, title: b.title, order: 0 })) });
  const all = await prisma.storyBeat.findMany({ where: { storyId: story.id } });
  const pos = (key: string, order: number) => tpl.beats.find((b) => b.key === key)?.at ?? 2 + order;
  await prisma.$transaction(all.sort((a, b) => pos(a.key, a.order) - pos(b.key, b.order)).map((b, i) => prisma.storyBeat.update({ where: { id: b.id }, data: { order: i } })));
  return prisma.story.findUniqueOrThrow({ where: { id: story.id }, include });
});
