import { prisma } from '@regie/db';
import { subscribe } from '@regie/jobs';
import { currentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// Flux Server-Sent Events : progression des générations et modifications,
// pour tous les projets auxquels l'utilisateur a accès.
export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) return new Response('Non connecté.', { status: 401 });
  const projects = await prisma.project.findMany({
    where: { OR: [{ ownerId: user.id }, { members: { some: { userId: user.id } } }, { workspace: { members: { some: { userId: user.id } } } }] },
    select: { id: true },
  });
  const ids = projects.map((p) => p.id);
  const enc = new TextEncoder();
  let unsubscribe = () => {};
  let ping: ReturnType<typeof setInterval>;
  const stream = new ReadableStream({
    start(controller) {
      const send = (data: string) => {
        try {
          controller.enqueue(enc.encode(data));
        } catch {}
      };
      send(': connecté\n\n');
      if (ids.length) unsubscribe = subscribe(ids, (ev) => send(`data: ${JSON.stringify(ev)}\n\n`));
      ping = setInterval(() => send(': ping\n\n'), 25_000);
      req.signal.addEventListener('abort', () => {
        clearInterval(ping);
        unsubscribe();
        try {
          controller.close();
        } catch {}
      });
    },
    cancel() {
      clearInterval(ping);
      unsubscribe();
    },
  });
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' } });
}
