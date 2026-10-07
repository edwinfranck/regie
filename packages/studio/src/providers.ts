import { type Capability, type Candidate, type ProviderConfig, decryptSecret, getAdapter, route } from '@regie/providers';
import { prisma, type Model, type Provider } from '@regie/db';
import { StudioError, notConfigured } from './errors';

// Les providers vus depuis un projet : ceux de l'instance plus ceux de son
// espace de travail. La clé n'est déchiffrée qu'ici, côté serveur, au moment
// de l'appel.

export const TASK_FOR: Record<Capability, string> = {
  TEXT: 'TEXT',
  IMAGE: 'IMAGE_GENERATION',
  VIDEO: 'VIDEO_GENERATION',
  AUDIO: 'AUDIO_GENERATION',
  EMBEDDING: 'EMBEDDING',
};

export function providerConfig(p: Provider): ProviderConfig {
  return {
    id: p.id,
    name: p.name,
    adapter: p.adapter,
    baseUrl: p.baseUrl,
    apiKey: p.apiKeyEnc ? decryptSecret(p.apiKeyEnc) : null,
    config: (p.config ?? {}) as Record<string, unknown>,
  };
}

/** Un provider est utilisable si sa clé est posée, ou si l'adapter n'en demande pas. */
export function isConfigured(p: Pick<Provider, 'adapter' | 'apiKeyEnc' | 'baseUrl'>) {
  try {
    const meta = getAdapter(p.adapter).meta;
    if (meta.needsApiKey && !p.apiKeyEnc) return false;
    if (meta.needsBaseUrl && !p.baseUrl && !meta.defaultBaseUrl) return false;
    return true;
  } catch {
    return false;
  }
}

export const visibleProviders = (workspaceId: string) => ({ OR: [{ workspaceId: null }, { workspaceId }] });

export async function candidates(workspaceId: string, capability: Capability): Promise<Candidate[]> {
  const [models, routes] = await Promise.all([
    prisma.model.findMany({ where: { capability, provider: visibleProviders(workspaceId) }, include: { provider: true } }),
    prisma.modelRoute.findMany({ where: { task: TASK_FOR[capability], OR: [{ workspaceId: null }, { workspaceId }] }, orderBy: { priority: 'asc' } }),
  ]);
  const prio = new Map<string, number>();
  // Les routes de l'espace de travail passent avant celles de l'instance.
  routes.sort((a, b) => Number(!!b.workspaceId) - Number(!!a.workspaceId) || a.priority - b.priority).forEach((r, i) => prio.has(r.modelId) || prio.set(r.modelId, i));
  return models.map((m) => toCandidate(m, prio.get(m.id)));
}

export function toCandidate(m: Model & { provider: Provider }, routePriority?: number): Candidate {
  return {
    id: m.id,
    providerId: m.providerId,
    providerName: m.provider.name,
    adapter: m.provider.adapter,
    capability: m.capability,
    modes: m.modes,
    quality: m.quality,
    speed: m.speed,
    pricing: (m.pricing ?? {}) as Candidate['pricing'],
    aspectRatios: m.aspectRatios,
    maxDuration: m.maxDuration,
    enabled: m.enabled,
    providerEnabled: m.provider.enabled,
    configured: isConfigured(m.provider),
    routePriority,
  };
}

export interface ResolveQuery {
  workspaceId: string;
  capability: Capability;
  mode: string;
  modelId: string;
  aspectRatio?: string;
  durationSec?: number;
  prefer?: 'quality' | 'cost' | 'speed';
}

/** AUTO → le meilleur modèle disponible ; sinon le modèle forcé, après contrôle. */
export async function resolveModel(q: ResolveQuery) {
  if (q.modelId && q.modelId !== 'auto') {
    const m = await prisma.model.findUnique({ where: { id: q.modelId }, include: { provider: true } });
    if (!m || (m.provider.workspaceId && m.provider.workspaceId !== q.workspaceId)) throw new StudioError('not_found', 'Modèle introuvable.');
    if (m.capability !== q.capability) throw new StudioError('invalid', `${m.label} ne génère pas ce type de contenu.`);
    if (!m.enabled || !m.provider.enabled) throw new StudioError('unsupported', `${m.label} est désactivé.`, { label: 'Réglages des providers', href: '/settings/providers' });
    if (!isConfigured(m.provider)) throw notConfigured(`${m.provider.name} (clé API manquante)`);
    if (m.modes.length && !m.modes.includes(q.mode)) throw new StudioError('unsupported', `${m.label} ne fait pas « ${q.mode} ».`);
    return { model: m, decision: null };
  }
  const decision = route(await candidates(q.workspaceId, q.capability), q);
  if (!decision.chosen) {
    const label = { TEXT: 'de texte', IMAGE: 'd’image', VIDEO: 'vidéo', AUDIO: 'audio', EMBEDDING: 'd’embedding' }[q.capability];
    throw notConfigured(`${label} pour « ${q.mode} »`);
  }
  const model = await prisma.model.findUniqueOrThrow({ where: { id: decision.chosen.id }, include: { provider: true } });
  return { model, decision };
}
