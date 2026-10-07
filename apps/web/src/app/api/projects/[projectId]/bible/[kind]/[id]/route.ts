import { prisma } from '@regie/db';
import { recordRevision } from '@regie/studio';
import { api, body, HttpError, project } from '@/lib/api';
import { kind } from '@/lib/server/bible';

type P = { projectId: string; kind: string; id: string };

async function find(params: P) {
  const k = kind(params.kind);
  const row = await k.delegate.findFirst({ where: { id: params.id, projectId: params.projectId }, include: k.include });
  if (!row) throw new HttpError(404, 'Élément introuvable.', 'not_found');
  return { k, row };
}

export const GET = api<P>(async ({ params, user }) => {
  await project(params.projectId, user);
  const { row } = await find(params);
  // Les assets liés : références, feuilles générées, plans où il apparaît.
  const field = { characters: 'characterId', locations: 'locationId', props: 'propId' }[params.kind];
  const assets = field
    ? await prisma.asset.findMany({ where: { projectId: params.projectId, links: { some: { [field]: params.id } } }, orderBy: { createdAt: 'desc' }, take: 60, select: { id: true, type: true, name: true, storageKey: true, width: true, height: true, isReference: true, createdAt: true } })
    : [];
  return { ...row, assets };
});

export const PATCH = api<P>(async ({ params, user, req }) => {
  const { k } = await find(params);
  await project(params.projectId, user, k.action);
  const input = await body(req, k.schema.partial());
  if (input.code) input.code = String(input.code).toUpperCase();
  if (k.exclusive && (input as any)[k.exclusive]) await k.delegate.updateMany({ where: { projectId: params.projectId, id: { not: params.id } }, data: { [k.exclusive]: false } });
  const row = await k.delegate.update({ where: { id: params.id }, data: { ...input, ...(k.revision ? { version: { increment: 1 } } : {}) }, include: k.include });
  if (k.revision) await recordRevision(k.revision, row.id, params.projectId, row, user.id);
  return row;
});

export const DELETE = api<P>(async ({ params, user }) => {
  const { k } = await find(params);
  await project(params.projectId, user, k.action);
  await k.delegate.delete({ where: { id: params.id } });
  return { ok: true };
});
