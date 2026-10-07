import { templateSchema, templateVariables } from '@regie/core';
import { prisma } from '@regie/db';
import type { CurrentUser } from '@/lib/auth';
import { api, audit, body, HttpError, project } from '@/lib/api';

type P = { id: string };

/** Mêmes droits qu'à la création : admin pour l'instance, 'project.edit' pour un projet. */
async function own(user: CurrentUser, id: string) {
  const t = await prisma.promptTemplate.findUnique({ where: { id } });
  if (!t) throw new HttpError(404, 'Template introuvable.', 'not_found');
  if (t.projectId) await project(t.projectId, user, 'project.edit');
  else if (!user.isAdmin) throw new HttpError(403, 'Seul l’administrateur modifie les templates de l’instance.', 'forbidden');
  return t;
}

export const PATCH = api<P>(async ({ params, user, req }) => {
  await own(user, params.id);
  const input = await body(req, templateSchema.partial());
  return prisma.promptTemplate.update({
    where: { id: params.id },
    data: { ...input, ...(input.body !== undefined ? { variables: templateVariables(input.body) } : {}) },
    include: { project: { select: { id: true, title: true } } },
  });
});

export const DELETE = api<P>(async ({ params, user }) => {
  await own(user, params.id);
  await prisma.promptTemplate.delete({ where: { id: params.id } });
  await audit(user.id, 'template.delete', 'template', params.id);
  return { ok: true };
});
