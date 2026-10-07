import { prisma } from '@regie/db';
import { queueCounts } from '@regie/jobs';
import { api } from '@/lib/api';

export const GET = api(
  async () => {
    const since = new Date(Date.now() - 30 * 86400_000);
    const [users, projects, storage, jobs, errors, cost, logs, providers] = await Promise.all([
      prisma.user.findMany({ orderBy: { createdAt: 'asc' }, select: { id: true, email: true, name: true, isAdmin: true, disabled: true, createdAt: true, _count: { select: { ownedProjects: true, generations: true } } } }),
      prisma.project.count(),
      prisma.asset.aggregate({ _sum: { sizeBytes: true }, _count: true }),
      queueCounts().catch(() => null),
      prisma.generation.findMany({ where: { status: 'FAILED', createdAt: { gte: since } }, orderBy: { createdAt: 'desc' }, take: 30, select: { id: true, error: true, errorCode: true, createdAt: true, provider: { select: { name: true } }, model: { select: { label: true } }, project: { select: { title: true } } } }),
      prisma.usage.aggregate({ where: { createdAt: { gte: since } }, _sum: { costUsd: true } }),
      prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 50, include: { user: { select: { email: true } } } }),
      prisma.provider.count(),
    ]);
    return { users, projects, storage: { bytes: storage._sum.sizeBytes ?? 0, files: storage._count }, jobs, errors, cost30d: cost._sum.costUsd ?? 0, logs, providers };
  },
  { admin: true },
);
