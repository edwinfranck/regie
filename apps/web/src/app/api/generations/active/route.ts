import { prisma } from '@regie/db';
import { api } from '@/lib/api';

export const GET = api(async ({ user }) => {
  const active = await prisma.generation.findMany({ where: { userId: user.id, status: { in: ['QUEUED', 'PROCESSING'] } }, select: { projectId: true, capability: true }, take: 100 });
  const first = active[0];
  return { count: active.length, href: first ? `/projects/${first.projectId}/${first.capability === 'VIDEO' ? 'videos' : first.capability === 'AUDIO' ? 'audio' : 'images'}` : null };
});
