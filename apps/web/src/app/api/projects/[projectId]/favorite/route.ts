import { prisma } from '@regie/db';
import { api, project } from '@/lib/api';

export const POST = api<{ projectId: string }>(async ({ params, user }) => {
  await project(params.projectId, user);
  const key = { userId_projectId: { userId: user.id, projectId: params.projectId } };
  const existing = await prisma.projectFavorite.findUnique({ where: key });
  if (existing) await prisma.projectFavorite.delete({ where: key });
  else await prisma.projectFavorite.create({ data: { userId: user.id, projectId: params.projectId } });
  return { favorite: !existing };
});
