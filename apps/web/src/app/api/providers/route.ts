import { providerSchema } from '@regie/core';
import { prisma } from '@regie/db';
import { listAdapters } from '@regie/providers';
import { addProvider, isConfigured, personalWorkspace } from '@regie/studio';
import { api, audit, body, HttpError } from '@/lib/api';
import { managedWorkspaces, publicProvider, visibleWorkspaces } from '@/lib/server/providers';

export const GET = api(async ({ user }) => {
  const ws = await visibleWorkspaces(user);
  const managed = await managedWorkspaces(user);
  const [providers, routes] = await Promise.all([
    prisma.provider.findMany({ where: { OR: [{ workspaceId: null }, { workspaceId: { in: ws } }] }, include: { models: { orderBy: [{ capability: 'asc' }, { label: 'asc' }] } }, orderBy: { createdAt: 'asc' } }),
    prisma.modelRoute.findMany({ where: { OR: [{ workspaceId: null }, { workspaceId: { in: ws } }] }, orderBy: { priority: 'asc' } }),
  ]);
  return {
    adapters: listAdapters(),
    providers: providers.map((p) => ({ ...publicProvider(p), configured: isConfigured(p), canManage: p.workspaceId === null ? user.isAdmin : managed.includes(p.workspaceId) })),
    routes,
    isAdmin: user.isAdmin,
  };
});

export const POST = api(async ({ user, req }) => {
  const input = await body(req, providerSchema);
  const scope = input.scope ?? (user.isAdmin ? 'instance' : 'workspace');
  if (scope === 'instance' && !user.isAdmin) throw new HttpError(403, 'Seul l’administrateur ajoute des providers pour toute l’instance.');
  const workspaceId = scope === 'workspace' ? (await managedWorkspaces(user))[0] ?? (await personalWorkspace(user.id)).id : null;
  const p = await addProvider({ adapter: input.adapter, name: input.name, apiKey: input.apiKey, baseUrl: input.baseUrl || null, config: input.config, workspaceId, createdById: user.id });
  await audit(user.id, 'provider.create', 'provider', p.id, { adapter: p.adapter, scope });
  return publicProvider(p);
});
