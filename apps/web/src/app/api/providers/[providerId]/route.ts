import { providerSchema } from '@regie/core';
import { prisma, type Prisma } from '@regie/db';
import { encryptSecret, secretHint } from '@regie/providers';
import { api, audit, body } from '@/lib/api';
import { assertCanManage, publicProvider } from '@/lib/server/providers';

type P = { providerId: string };

export const PATCH = api<P>(async ({ params, user, req }) => {
  await assertCanManage(user, params.providerId);
  const { apiKey, scope: _scope, adapter: _adapter, config, baseUrl, ...rest } = await body(req, providerSchema.partial());
  const data: Prisma.ProviderUpdateInput = { ...rest };
  if (baseUrl !== undefined) data.baseUrl = baseUrl || null;
  if (config !== undefined) data.config = config as Prisma.InputJsonValue;
  // La clé n'est jamais renvoyée : absente = inchangée, vide = effacée.
  if (apiKey !== undefined) {
    data.apiKeyEnc = apiKey ? encryptSecret(apiKey.trim()) : null;
    data.apiKeyHint = apiKey ? secretHint(apiKey.trim()) : null;
  }
  const p = await prisma.provider.update({ where: { id: params.providerId }, data, include: { models: true } });
  await audit(user.id, apiKey !== undefined ? 'provider.key' : 'provider.update', 'provider', p.id);
  return publicProvider(p);
});

export const DELETE = api<P>(async ({ params, user }) => {
  await assertCanManage(user, params.providerId);
  await prisma.provider.delete({ where: { id: params.providerId } });
  await audit(user.id, 'provider.delete', 'provider', params.providerId);
  return { ok: true };
});
