import { commentSchema } from '@regie/core';
import { prisma } from '@regie/db';
import { z } from 'zod';
import { api, body, HttpError, project } from '@/lib/api';

type P = { projectId: string };

const include = { author: { select: { id: true, name: true, email: true } } };

export const GET = api<P>(async ({ params, user, req }) => {
  await project(params.projectId, user);
  const sp = req.nextUrl.searchParams;
  return prisma.comment.findMany({
    where: { projectId: params.projectId, ...(sp.get('entityType') ? { entityType: sp.get('entityType')!, entityId: sp.get('entityId') ?? undefined } : {}) },
    orderBy: { createdAt: 'asc' },
    include,
    take: 500,
  });
});

// Un commentaire peut mentionner des membres (@nom ou @email) : ils sont notifiés.
export const POST = api<P>(async ({ params, user, req }) => {
  await project(params.projectId, user, 'comment');
  const input = await body(req, commentSchema);
  const handles = [...input.body.matchAll(/@([\w.+-]+(?:@[\w.-]+)?)/g)].map((m) => m[1].toLowerCase());
  const p = await prisma.project.findUniqueOrThrow({
    where: { id: params.projectId },
    select: { title: true, owner: { select: { id: true, name: true, email: true } }, members: { select: { user: { select: { id: true, name: true, email: true } } } } },
  });
  const people = [p.owner, ...p.members.map((m) => m.user)];
  const mentioned = people.filter((u) => u.id !== user.id && handles.some((h) => u.email.toLowerCase() === h || u.email.toLowerCase().startsWith(`${h}@`) || u.name?.toLowerCase().replace(/\s+/g, '') === h));
  const comment = await prisma.comment.create({ data: { ...input, parentId: input.parentId ?? null, projectId: params.projectId, authorId: user.id, mentions: mentioned.map((u) => u.id) }, include });
  if (mentioned.length)
    await prisma.notification.createMany({
      data: mentioned.map((u) => ({ userId: u.id, kind: 'mention', title: `${user.name ?? user.email} vous a mentionné dans « ${p.title} »`, body: input.body.slice(0, 280), href: `/projects/${params.projectId}` })),
    });
  return comment;
});

export const PATCH = api<P>(async ({ params, user, req }) => {
  await project(params.projectId, user, 'comment');
  const { id, resolved } = await body(req, z.object({ id: z.string(), resolved: z.boolean() }));
  const c = await prisma.comment.findFirst({ where: { id, projectId: params.projectId } });
  if (!c) throw new HttpError(404, 'Commentaire introuvable.');
  return prisma.comment.update({ where: { id }, data: { resolvedAt: resolved ? new Date() : null }, include });
});

export const DELETE = api<P>(async ({ params, user, req }) => {
  const role = await project(params.projectId, user, 'comment');
  const id = req.nextUrl.searchParams.get('id');
  const c = await prisma.comment.findFirst({ where: { id: id ?? '', projectId: params.projectId } });
  if (!c) throw new HttpError(404, 'Commentaire introuvable.');
  if (c.authorId !== user.id && role !== 'OWNER' && role !== 'ADMIN') throw new HttpError(403, 'Seul l’auteur peut supprimer ce commentaire.');
  await prisma.comment.delete({ where: { id: c.id } });
  return { ok: true };
});
