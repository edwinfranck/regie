import { modelSchema } from '@regie/core';
import { prisma, type Prisma } from '@regie/db';
import { getAdapter, toProviderError } from '@regie/providers';
import { providerConfig } from '@regie/studio';
import { api, body, HttpError } from '@/lib/api';
import { assertCanManage } from '@/lib/server/providers';

type P = { providerId: string };

// Découvre les modèles exposés (Ollama, ComfyUI, OpenAI-compatible).
export const GET = api<P>(async ({ params, user }) => {
  const p = await assertCanManage(user, params.providerId);
  const adapter = getAdapter(p.adapter);
  if (!adapter.listModels) return { models: adapter.meta.presets, discovered: false };
  try {
    return { models: await adapter.listModels(providerConfig(p)), discovered: true };
  } catch (e) {
    throw new HttpError(502, toProviderError(e).message, 'upstream');
  }
});

export const POST = api<P>(async ({ params, user, req }) => {
  await assertCanManage(user, params.providerId);
  const m = await body(req, modelSchema);
  return prisma.model.upsert({
    where: { providerId_modelId: { providerId: params.providerId, modelId: m.modelId } },
    create: { ...m, pricing: (m.pricing ?? {}) as Prisma.InputJsonValue, aspectRatios: m.aspectRatios ?? [], providerId: params.providerId },
    update: { ...m, pricing: (m.pricing ?? {}) as Prisma.InputJsonValue },
  });
});
