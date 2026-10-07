import { encryptSecret, getAdapter, secretHint } from '@regie/providers';
import { prisma, type Prisma } from '@regie/db';

// Branche un provider avec les modèles proposés par son adapter. Utilisé par
// l'interface (bouton « Ajouter ») et par le seed à partir des variables SEED_*.
export async function addProvider(input: { adapter: string; name?: string; apiKey?: string | null; baseUrl?: string | null; config?: Record<string, unknown>; workspaceId?: string | null; createdById?: string | null }) {
  const adapter = getAdapter(input.adapter);
  const key = input.apiKey?.trim() || null;
  const provider = await prisma.provider.create({
    data: {
      name: input.name || adapter.meta.label,
      adapter: adapter.meta.id,
      baseUrl: input.baseUrl || adapter.meta.defaultBaseUrl || null,
      apiKeyEnc: key ? encryptSecret(key) : null,
      apiKeyHint: key ? secretHint(key) : null,
      config: (input.config ?? {}) as Prisma.InputJsonValue,
      isLocal: !!adapter.meta.local,
      workspaceId: input.workspaceId ?? null,
      createdById: input.createdById ?? null,
      models: {
        create: adapter.meta.presets.map((m) => ({
          modelId: m.modelId,
          label: m.label,
          capability: m.capability,
          modes: m.modes,
          pricing: (m.pricing ?? {}) as Prisma.InputJsonValue,
          quality: m.quality ?? 3,
          speed: m.speed ?? 3,
          maxDuration: m.maxDuration,
          aspectRatios: m.aspectRatios ?? [],
        })),
      },
    },
    include: { models: true },
  });
  return provider;
}
