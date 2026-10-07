import { prisma } from '@regie/db';
import type { CurrentUser } from '@/lib/auth';
import { HttpError } from '@/lib/api';

/** Les espaces de travail où l'utilisateur peut gérer des providers. */
export async function managedWorkspaces(user: CurrentUser) {
  const rows = await prisma.workspaceMember.findMany({ where: { userId: user.id, role: { in: ['OWNER', 'ADMIN'] } }, select: { workspaceId: true } });
  return rows.map((r) => r.workspaceId);
}

export async function visibleWorkspaces(user: CurrentUser) {
  const rows = await prisma.workspaceMember.findMany({ where: { userId: user.id }, select: { workspaceId: true } });
  return rows.map((r) => r.workspaceId);
}

/** Un provider d'instance se gère par l'admin ; un provider d'espace par ses OWNER/ADMIN. */
export async function assertCanManage(user: CurrentUser, providerId: string) {
  const p = await prisma.provider.findUnique({ where: { id: providerId } });
  if (!p) throw new HttpError(404, 'Provider introuvable.');
  if (p.workspaceId === null ? !user.isAdmin : !(await managedWorkspaces(user)).includes(p.workspaceId)) throw new HttpError(403, 'Vous ne pouvez pas modifier ce provider.');
  return p;
}

// Ce que l'interface voit d'un provider : jamais la clé, seulement son indice.
export const publicProvider = <T extends { apiKeyEnc: string | null }>({ apiKeyEnc, ...p }: T) => ({ ...p, hasKey: !!apiKeyEnc });
