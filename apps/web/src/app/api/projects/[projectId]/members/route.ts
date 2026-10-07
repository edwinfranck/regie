import { ROLES } from '@regie/core';
import { prisma } from '@regie/db';
import { can } from '@regie/studio';
import { z } from 'zod';
import { api, audit, body, HttpError, project } from '@/lib/api';

type P = { projectId: string };

// Les membres d'un projet. Le propriétaire n'est pas un membre : il est porté
// par le projet et ne peut être ni retiré ni rétrogradé ici.
const assignable = z.enum(ROLES.filter((r) => r !== 'OWNER') as [Exclude<(typeof ROLES)[number], 'OWNER'>, ...Exclude<(typeof ROLES)[number], 'OWNER'>[]]);
const userSelect = { id: true, email: true, name: true, image: true } as const;

export const GET = api<P>(async ({ params, user }) => {
  const role = await project(params.projectId, user);
  const p = await prisma.project.findUniqueOrThrow({
    where: { id: params.projectId },
    select: { owner: { select: userSelect }, members: { orderBy: { createdAt: 'asc' }, select: { role: true, createdAt: true, user: { select: userSelect } } } },
  });
  return { owner: p.owner, members: p.members.filter((m) => m.user.id !== p.owner.id), role, canAdmin: can(role, 'project.admin') };
});

export const POST = api<P>(async ({ params, user, req }) => {
  await project(params.projectId, user, 'project.admin');
  const { email, role } = await body(req, z.object({ email: z.string().trim().toLowerCase().email('Email invalide.'), role: assignable }));
  const target = await prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } }, select: { id: true } });
  if (!target) throw new HttpError(404, 'Aucun compte avec cet email. La personne doit d’abord créer son compte sur cette instance.', 'not_found');
  const p = await prisma.project.findUniqueOrThrow({ where: { id: params.projectId }, select: { ownerId: true } });
  if (target.id === p.ownerId) throw new HttpError(400, 'Cette personne est déjà propriétaire du projet.', 'invalid');
  const m = await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId: params.projectId, userId: target.id } },
    create: { projectId: params.projectId, userId: target.id, role },
    update: { role },
    select: { role: true, createdAt: true, user: { select: userSelect } },
  });
  await audit(user.id, 'project.member.add', 'project', params.projectId, { userId: target.id, role });
  return m;
});

export const PATCH = api<P>(async ({ params, user, req }) => {
  await project(params.projectId, user, 'project.admin');
  const { userId, role } = await body(req, z.object({ userId: z.string(), role: assignable }));
  const m = await prisma.projectMember.update({
    where: { projectId_userId: { projectId: params.projectId, userId } },
    data: { role },
    select: { role: true, createdAt: true, user: { select: userSelect } },
  });
  await audit(user.id, 'project.member.role', 'project', params.projectId, { userId, role });
  return m;
});

export const DELETE = api<P>(async ({ params, user, req }) => {
  await project(params.projectId, user, 'project.admin');
  const userId = req.nextUrl.searchParams.get('userId');
  if (!userId) throw new HttpError(400, 'Paramètre userId manquant.', 'invalid');
  const p = await prisma.project.findUniqueOrThrow({ where: { id: params.projectId }, select: { ownerId: true } });
  if (userId === p.ownerId) throw new HttpError(400, 'On ne retire pas le propriétaire du projet.', 'invalid');
  await prisma.projectMember.deleteMany({ where: { projectId: params.projectId, userId } });
  await audit(user.id, 'project.member.remove', 'project', params.projectId, { userId });
  return { ok: true };
});
