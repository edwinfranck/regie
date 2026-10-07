import { recordRevision } from '@regie/studio';
import { api, body, project } from '@/lib/api';
import { assignCode, kind } from '@/lib/server/bible';

type P = { projectId: string; kind: string };

export const GET = api<P>(async ({ params, user }) => {
  await project(params.projectId, user);
  const k = kind(params.kind);
  return k.delegate.findMany({ where: { projectId: params.projectId }, include: k.include, orderBy: k.ordered ? [{ order: 'asc' }, { code: 'asc' }] : [{ code: 'asc' }] });
});

export const POST = api<P>(async ({ params, user, req }) => {
  const k = kind(params.kind);
  await project(params.projectId, user, k.action);
  const input = await body(req, k.schema);
  const code = await assignCode(k, params.projectId, input as any);
  const count = await k.delegate.count({ where: { projectId: params.projectId } });
  if (k.exclusive && (input as any)[k.exclusive]) await k.delegate.updateMany({ where: { projectId: params.projectId }, data: { [k.exclusive]: false } });
  const row = await k.delegate.create({
    data: {
      ...input,
      code,
      projectId: params.projectId,
      // Le premier style est actif, la première lumière est celle par défaut.
      ...(k.exclusive && count === 0 ? { [k.exclusive]: true } : {}),
      ...(k.ordered ? { order: (input as any).order ?? count } : {}),
    },
    include: k.include,
  });
  if (k.revision) await recordRevision(k.revision, row.id, params.projectId, row, user.id, 'Création');
  return row;
});
