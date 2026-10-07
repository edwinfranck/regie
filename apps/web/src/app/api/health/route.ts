import { prisma } from '@regie/db';
import { redis } from '@regie/jobs';

export async function GET() {
  const checks = await Promise.allSettled([prisma.$queryRaw`SELECT 1`, redis().ping()]);
  const [db, queue] = checks.map((c) => c.status === 'fulfilled');
  return Response.json({ ok: db && queue, db, queue }, { status: db && queue ? 200 : 503 });
}
