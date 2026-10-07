import { generationRequestSchema } from '@regie/core';
import { prisma, type Prisma } from '@regie/db';
import { createGeneration } from '@regie/studio';
import { api, audit, body, project, rateLimit } from '@/lib/api';

type P = { projectId: string };

export const generationInclude = {
  model: { select: { id: true, label: true, modelId: true } },
  provider: { select: { id: true, name: true, adapter: true } },
  outputs: { select: { id: true, type: true, width: true, height: true, mimeType: true } },
  shot: { select: { id: true, code: true } },
  user: { select: { name: true } },
} satisfies Prisma.GenerationInclude;

export const GET = api<P>(async ({ params, user, req }) => {
  await project(params.projectId, user);
  const sp = req.nextUrl.searchParams;
  const status = sp.get('status');
  const items = await prisma.generation.findMany({
    where: {
      projectId: params.projectId,
      ...(sp.get('capability') ? { capability: sp.get('capability') as any } : { capability: { in: ['IMAGE', 'VIDEO', 'AUDIO'] } }),
      ...(status === 'active' ? { status: { in: ['QUEUED', 'PROCESSING'] } } : status ? { status: status as any } : {}),
      ...(sp.get('shotId') ? { shotId: sp.get('shotId') } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: Math.min(Number(sp.get('take') ?? 50), 200),
    include: generationInclude,
  });
  return { items };
});

export const POST = api<P>(async ({ params, user, req }) => {
  await project(params.projectId, user, 'generate');
  await rateLimit(`gen:${user.id}`, 60, 60);
  const input = await body(req, generationRequestSchema);
  const gen = await createGeneration(input, { userId: user.id, projectId: params.projectId });
  await audit(user.id, 'generation.create', 'generation', gen.id, { model: gen.model?.modelId, provider: gen.provider?.name });
  return prisma.generation.findUniqueOrThrow({ where: { id: gen.id }, include: generationInclude });
});
