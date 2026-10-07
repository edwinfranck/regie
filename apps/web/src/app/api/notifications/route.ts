import { prisma } from '@regie/db';
import { z } from 'zod';
import { api, body } from '@/lib/api';

export const GET = api(async ({ user }) => {
  const items = await prisma.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 50 });
  return { items, unread: items.filter((n) => !n.readAt).length };
});

export const PATCH = api(async ({ user, req }) => {
  const { ids } = await body(req, z.object({ ids: z.array(z.string()).max(200).optional() }));
  await prisma.notification.updateMany({ where: { userId: user.id, readAt: null, ...(ids ? { id: { in: ids } } : {}) }, data: { readAt: new Date() } });
  return { ok: true };
});
