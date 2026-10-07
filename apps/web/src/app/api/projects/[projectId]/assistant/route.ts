import { prisma } from '@regie/db';
import { assistantStream } from '@regie/studio';
import { z } from 'zod';
import { api, body, errorResponse, project, rateLimit } from '@/lib/api';

type P = { projectId: string };

export const GET = api<P>(async ({ params, user }) => {
  await project(params.projectId, user);
  const thread = await prisma.assistantThread.findFirst({ where: { projectId: params.projectId, userId: user.id }, orderBy: { updatedAt: 'desc' }, include: { messages: { orderBy: { createdAt: 'asc' }, take: 200 } } });
  return thread ?? { messages: [] };
});

export const DELETE = api<P>(async ({ params, user }) => {
  await prisma.assistantThread.deleteMany({ where: { projectId: params.projectId, userId: user.id } });
  return { ok: true };
});

// Réponse en flux : des lignes JSON {delta} puis {done}.
export const POST = api<P>(async ({ params, user, req }) => {
  await project(params.projectId, user);
  await rateLimit(`assistant:${user.id}`, 20, 60);
  const { message, modelId } = await body(req, z.object({ message: z.string().trim().min(1).max(8000), modelId: z.string().optional() }));
  let thread = await prisma.assistantThread.findFirst({ where: { projectId: params.projectId, userId: user.id }, orderBy: { updatedAt: 'desc' } });
  thread ??= await prisma.assistantThread.create({ data: { projectId: params.projectId, userId: user.id, title: message.slice(0, 80) } });
  await prisma.assistantMessage.create({ data: { threadId: thread.id, role: 'user', content: message } });
  const history = await prisma.assistantMessage.findMany({ where: { threadId: thread.id }, orderBy: { createdAt: 'asc' }, take: 40 });
  const threadId = thread.id;

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (o: object) => controller.enqueue(enc.encode(JSON.stringify(o) + '\n'));
      try {
        for await (const chunk of assistantStream({ projectId: params.projectId, userId: user.id, modelId }, history.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })), req.signal)) {
          if ('delta' in chunk) send({ delta: chunk.delta });
          else {
            await prisma.assistantMessage.create({ data: { threadId, role: 'assistant', content: chunk.done.text } });
            await prisma.assistantThread.update({ where: { id: threadId }, data: { updatedAt: new Date() } });
            send({ done: { model: chunk.done.model, costUsd: chunk.done.costUsd } });
          }
        }
      } catch (e) {
        const res = errorResponse(e);
        send({ error: (await res.json()) });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-cache' } });
});
