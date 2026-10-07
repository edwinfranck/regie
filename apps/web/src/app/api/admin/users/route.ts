import { prisma } from '@regie/db';
import { z } from 'zod';
import { api, audit, body, HttpError } from '@/lib/api';

export const PATCH = api(
  async ({ user, req }) => {
    const { userId, isAdmin, disabled } = await body(req, z.object({ userId: z.string(), isAdmin: z.boolean().optional(), disabled: z.boolean().optional() }));
    if (userId === user.id && (isAdmin === false || disabled)) throw new HttpError(400, 'Vous ne pouvez pas retirer vos propres droits.');
    const u = await prisma.user.update({ where: { id: userId }, data: { isAdmin, disabled }, select: { id: true, isAdmin: true, disabled: true } });
    await audit(user.id, 'admin.user', 'user', userId, { isAdmin, disabled });
    return u;
  },
  { admin: true },
);
