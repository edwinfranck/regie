import { getAdapter, toProviderError } from '@regie/providers';
import { providerConfig } from '@regie/studio';
import { api, rateLimit } from '@/lib/api';
import { assertCanManage } from '@/lib/server/providers';

// Vérifie la connexion sans rien générer de facturable.
export const POST = api<{ providerId: string }>(async ({ params, user }) => {
  const p = await assertCanManage(user, params.providerId);
  await rateLimit(`ptest:${user.id}`, 20, 60);
  const adapter = getAdapter(p.adapter);
  if (!adapter.test) return { ok: true, message: 'Cet adapter n’a pas de test de connexion : lancer une petite génération pour vérifier.' };
  try {
    return await adapter.test(providerConfig(p));
  } catch (e) {
    return { ok: false, message: toProviderError(e).message };
  }
});
