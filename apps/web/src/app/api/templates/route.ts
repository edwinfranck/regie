import { templateSchema, templateVariables } from '@regie/core';
import { prisma } from '@regie/db';
import { z } from 'zod';
import { api, audit, body, HttpError, project } from '@/lib/api';

// Templates de prompts : ceux de l'instance (projectId null, gérés par
// l'admin) et ceux d'un projet (gérés par qui peut éditer le projet).

export const GET = api(async ({ user, req }) => {
  const projectId = req.nextUrl.searchParams.get('projectId');
  if (projectId) await project(projectId, user);
  return prisma.promptTemplate.findMany({
    where: { OR: [{ projectId: null }, ...(projectId ? [{ projectId }] : [])] },
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
    include: { project: { select: { id: true, title: true } } },
  });
});

export const POST = api(async ({ user, req }) => {
  const input = await body(req, templateSchema.extend({ projectId: z.string().nullish() }));
  if (input.projectId) await project(input.projectId, user, 'project.edit');
  else if (!user.isAdmin) throw new HttpError(403, 'Seul l’administrateur crée des templates pour toute l’instance.', 'forbidden');
  const t = await prisma.promptTemplate.create({
    data: { category: input.category, name: input.name, body: input.body, projectId: input.projectId ?? null, variables: templateVariables(input.body) },
    include: { project: { select: { id: true, title: true } } },
  });
  await audit(user.id, 'template.create', 'template', t.id);
  return t;
});
