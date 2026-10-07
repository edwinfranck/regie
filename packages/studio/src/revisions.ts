import { prisma, type Prisma } from '@regie/db';

// Historique : un instantané JSON par modification significative. Restaurer
// réécrit l'entité avec l'instantané et crée à son tour une révision — on ne
// perd jamais rien, pas même une restauration.

export type Versioned = 'character' | 'location' | 'prop' | 'style' | 'world' | 'script' | 'scene' | 'shot' | 'concept';

// Les champs qu'un instantané conserve (pas les relations ni les horodatages).
const OMIT = new Set(['id', 'projectId', 'createdAt', 'updatedAt', 'version', 'ref', 'project', '_count', 'assets', 'characters', 'props', 'location', 'light', 'scene', 'frameAsset']);
export const snapshotOf = (row: Record<string, unknown>) => Object.fromEntries(Object.entries(row).filter(([k]) => !OMIT.has(k))) as Prisma.InputJsonValue;

export async function recordRevision(entityType: Versioned, entityId: string, projectId: string, row: Record<string, unknown>, authorId?: string | null, message?: string) {
  const last = await prisma.revision.findFirst({ where: { entityType, entityId }, orderBy: { version: 'desc' }, select: { version: true, data: true } });
  const data = snapshotOf(row);
  // Rien n'a changé depuis la dernière révision : on n'empile pas de doublon.
  if (last && JSON.stringify(last.data) === JSON.stringify(data)) return null;
  return prisma.revision.create({ data: { entityType, entityId, projectId, version: (last?.version ?? 0) + 1, data, authorId: authorId ?? null, message: message ?? null } });
}

export async function listRevisions(entityType: string, entityId: string) {
  return prisma.revision.findMany({ where: { entityType, entityId }, orderBy: { version: 'desc' }, include: { author: { select: { name: true, email: true } } }, take: 100 });
}

/** Différences champ par champ entre deux instantanés. */
export function diffSnapshots(a: Record<string, unknown>, b: Record<string, unknown>) {
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])];
  return keys
    .filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]))
    .map((k) => ({ field: k, before: a[k] ?? null, after: b[k] ?? null }));
}
