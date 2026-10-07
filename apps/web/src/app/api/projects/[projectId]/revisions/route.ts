import { Prisma, prisma } from '@regie/db';
import { diffSnapshots, listRevisions, recordRevision, type Versioned } from '@regie/studio';
import { z } from 'zod';
import { api, body, HttpError, project } from '@/lib/api';

type P = { projectId: string };

export const GET = api<P>(async ({ params, user, req }) => {
  await project(params.projectId, user);
  const sp = req.nextUrl.searchParams;
  const type = sp.get('entityType');
  const id = sp.get('entityId');
  if (type && id) {
    const revs = await listRevisions(type, id);
    return revs.map((r, i) => ({ ...r, changes: revs[i + 1] ? diffSnapshots(revs[i + 1].data as any, r.data as any) : [] }));
  }
  return prisma.revision.findMany({ where: { projectId: params.projectId }, orderBy: { createdAt: 'desc' }, take: 50, include: { author: { select: { name: true } } } });
});

const DELEGATES: Record<string, any> = { character: prisma.character, location: prisma.location, prop: prisma.prop, style: prisma.style, world: prisma.world, script: prisma.script, scene: prisma.scene, shot: prisma.shot, concept: prisma.concept };

// Restaurer : réécrit l'entité avec l'instantané, et crée une nouvelle révision.
export const POST = api<P>(async ({ params, user, req }) => {
  await project(params.projectId, user, 'project.edit');
  const { revisionId } = await body(req, z.object({ revisionId: z.string() }));
  const rev = await prisma.revision.findFirst({ where: { id: revisionId, projectId: params.projectId } });
  if (!rev) throw new HttpError(404, 'Révision introuvable.');
  const delegate = DELEGATES[rev.entityType];
  if (!delegate) throw new HttpError(400, 'Type non restaurable.');
  // Le code et l'ordre d'un plan dépendent de sa place actuelle : on ne les restaure pas.
  const { refAssetId, frameAssetId, characterIds, propIds, code, order, number, ...data } = rev.data as Record<string, any>;
  if (rev.entityType !== 'shot' && code !== undefined) data.code = code;
  if (rev.entityType !== 'shot' && rev.entityType !== 'scene' && order !== undefined) data.order = order;
  // Une référence vers un asset supprimé depuis n'est pas restaurée.
  const exists = async (id: string | null | undefined) => !!id && !!(await prisma.asset.findUnique({ where: { id }, select: { id: true } }));
  if (await exists(refAssetId)) data.refAssetId = refAssetId;
  if (await exists(frameAssetId)) data.frameAssetId = frameAssetId;
  // Les distributions sont des relations, pas des colonnes.
  if (Array.isArray(characterIds)) {
    const alive = await prisma.character.findMany({ where: { id: { in: characterIds }, projectId: params.projectId }, select: { id: true } });
    data.characters = { deleteMany: {}, create: alive.map((c) => ({ characterId: c.id })) };
  }
  if (Array.isArray(propIds)) {
    const alive = await prisma.prop.findMany({ where: { id: { in: propIds }, projectId: params.projectId }, select: { id: true } });
    data.props = { deleteMany: {}, create: alive.map((p) => ({ propId: p.id })) };
  }
  // L'état de l'éditeur ne correspond plus au texte restauré : il repartira du Fountain.
  if (rev.entityType === 'script') data.doc = Prisma.DbNull;
  const row = await delegate.update({ where: { id: rev.entityId }, data });
  await recordRevision(rev.entityType as Versioned, rev.entityId, params.projectId, row, user.id, `Restauration de la v${rev.version}`);
  return row;
});
