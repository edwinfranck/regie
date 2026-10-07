import { prisma } from '@regie/db';
import { api } from '@/lib/api';

// Suivi des coûts : par jour, par mois, par projet, par provider, par scène.
// Un utilisateur voit ses projets ; l'admin voit toute l'instance.
export const GET = api(async ({ user, req }) => {
  const sp = req.nextUrl.searchParams;
  const days = Math.min(Number(sp.get('days') ?? 30), 365);
  const projectId = sp.get('projectId');
  const since = new Date(Date.now() - days * 86400_000);
  const scope = user.isAdmin && sp.get('all') === '1' ? {} : { project: { OR: [{ ownerId: user.id }, { members: { some: { userId: user.id } } }, { workspace: { members: { some: { userId: user.id } } } }] } };
  const where = { createdAt: { gte: since }, ...(projectId ? { projectId } : scope) };

  const rows = await prisma.usage.findMany({ where, select: { createdAt: true, costUsd: true, providerName: true, modelId: true, capability: true, projectId: true, inputTokens: true, outputTokens: true, generation: { select: { shot: { select: { scene: { select: { id: true, number: true, title: true } } } } } } } });
  const sum = <K extends string>(key: (r: (typeof rows)[number]) => K | null) => {
    const m = new Map<K, { cost: number; count: number }>();
    for (const r of rows) {
      const k = key(r);
      if (k === null) continue;
      const cur = m.get(k) ?? { cost: 0, count: 0 };
      cur.cost += r.costUsd;
      cur.count++;
      m.set(k, cur);
    }
    return [...m.entries()].map(([key, v]) => ({ key, ...v, cost: Math.round(v.cost * 10000) / 10000 })).sort((a, b) => b.cost - a.cost);
  };
  const daily = sum((r) => r.createdAt.toISOString().slice(0, 10)).sort((a, b) => a.key.localeCompare(b.key));
  const projects = await prisma.project.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.projectId).filter(Boolean) as string[])] } }, select: { id: true, title: true } });
  const title = new Map(projects.map((p) => [p.id, p.title]));
  const month = new Date().toISOString().slice(0, 7);
  return {
    days,
    total: Math.round(rows.reduce((a, r) => a + r.costUsd, 0) * 10000) / 10000,
    thisMonth: Math.round(rows.filter((r) => r.createdAt.toISOString().startsWith(month)).reduce((a, r) => a + r.costUsd, 0) * 10000) / 10000,
    calls: rows.length,
    tokens: rows.reduce((a, r) => a + (r.inputTokens ?? 0) + (r.outputTokens ?? 0), 0),
    daily,
    byProvider: sum((r) => r.providerName),
    byModel: sum((r) => r.modelId),
    byCapability: sum((r) => r.capability),
    byProject: sum((r) => r.projectId).map((x) => ({ ...x, label: title.get(x.key) ?? 'Projet supprimé' })),
    byScene: sum((r) => (r.generation?.shot?.scene ? `${r.generation.shot.scene.number}` : null)).map((x) => ({ ...x, label: `Scène ${x.key}` })),
  };
});
