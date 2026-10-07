import type { GenerationRequest } from '@regie/core';
import { prisma, type Prisma } from '@regie/db';
import { enqueueGeneration, publish, queuePosition } from '@regie/jobs';
import {
  type Capability,
  type ChatMessage,
  type GenerationResult,
  type InputFile,
  type OutputFile,
  type RunContext,
  ProviderError,
  estimateCost,
  getAdapter,
  toProviderError,
} from '@regie/providers';
import { getObject, keyFor, publicUrl, putObject } from '@regie/storage';
import { imageSize } from 'image-size';
import { StudioError } from './errors';
import { providerConfig, resolveModel } from './providers';

// Le pipeline de génération.
//
//   createGeneration  (API)    : valide, route, enregistre, met en file.
//   runGeneration     (worker) : charge les entrées, appelle l'adapter,
//                                stocke les sorties, rattache, facture.
//
// Jamais de résultat simulé : sans provider configuré, la demande échoue
// avant d'entrer en file, avec l'action qui débloque.

interface Links {
  characterIds?: string[];
  locationId?: string | null;
  propId?: string | null;
  sceneId?: string | null;
  setAsRefOf?: { type: 'character' | 'location' | 'prop' | 'style'; id: string } | null;
}

export async function createGeneration(req: GenerationRequest, { userId, projectId }: { userId: string; projectId: string }) {
  if (req.capability === 'TEXT' || req.capability === 'EMBEDDING') throw new StudioError('invalid', 'Le texte passe par runText, pas par la file.');
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId }, select: { workspaceId: true, aspectRatio: true } });

  const { model, decision } = await resolveModel({
    workspaceId: project.workspaceId,
    capability: req.capability,
    mode: req.mode,
    modelId: req.modelId,
    aspectRatio: req.params.aspectRatio ?? project.aspectRatio,
    durationSec: req.params.durationSec,
    prefer: req.params.prefer,
  });

  // Les entrées doivent appartenir au projet.
  if (req.inputAssetIds.length) {
    const n = await prisma.asset.count({ where: { id: { in: req.inputAssetIds }, projectId } });
    if (n !== new Set(req.inputAssetIds).size) throw new StudioError('forbidden', 'Une image d’entrée n’appartient pas à ce projet.');
  }
  if (req.shotId) await assertIn('shot', req.shotId, projectId);
  const links = req.links as Links;
  if (links.setAsRefOf) await assertIn(links.setAsRefOf.type, links.setAsRefOf.id, projectId);
  if ((req.mode === 'image-to-video' || req.mode === 'first-last-frame') && !req.inputAssetIds.length)
    throw new StudioError('invalid', 'Ce mode part d’une image : choisir une première image.');

  const gen = await prisma.generation.create({
    data: {
      projectId,
      userId,
      capability: req.capability,
      mode: req.mode,
      providerId: model.providerId,
      modelId: model.id,
      shotId: req.shotId ?? null,
      target: req.target ?? null,
      prompt: req.prompt,
      negative: req.negative || null,
      params: { ...req.params, aspectRatio: req.params.aspectRatio ?? project.aspectRatio, links, inputRoles: req.inputRoles } as unknown as Prisma.InputJsonValue,
      inputAssetIds: req.inputAssetIds,
      context: decision ? ({ routed: decision.ranked.slice(0, 3).map((r) => ({ id: r.candidate.id, score: r.score, reasons: r.reasons })) } as Prisma.InputJsonValue) : undefined,
    },
    include: { model: true, provider: true },
  });

  const job = await enqueueGeneration(gen.id);
  await prisma.generationJob.create({ data: { generationId: gen.id, queueJobId: String(job.id) } });
  await publish({ type: 'generation.queued', generationId: gen.id, projectId, position: (await queuePosition(gen.id)) ?? undefined });
  return gen;
}

async function assertIn(type: string, id: string, projectId: string) {
  const table = { shot: prisma.shot, character: prisma.character, location: prisma.location, prop: prisma.prop, style: prisma.style }[type] as any;
  const row = await table?.findFirst({ where: { id, projectId }, select: { id: true } });
  if (!row) throw new StudioError('not_found', `${type} introuvable dans ce projet.`);
}

// ─────────────────────────────── Worker ───────────────────────────────

export interface RunOptions {
  signal?: AbortSignal;
  attempt: number;
  maxAttempts: number;
}

export async function runGeneration(generationId: string, opts: RunOptions) {
  const gen = await prisma.generation.findUniqueOrThrow({ where: { id: generationId }, include: { model: true, provider: true } });
  if (gen.status === 'COMPLETED' || gen.status === 'CANCELED') return gen;
  if (!gen.model || !gen.provider) throw new ProviderError('not_configured', 'Le modèle ou le provider a été supprimé depuis la demande.');

  const started = Date.now();
  await prisma.generation.update({ where: { id: gen.id }, data: { status: 'PROCESSING', startedAt: gen.startedAt ?? new Date(), progress: 0, error: null, errorCode: null } });
  let lastPush = 0;
  const ctx: RunContext = {
    signal: opts.signal,
    onProgress: (progress, message) => {
      // Pas plus d'un événement par seconde : l'interface n'en demande pas plus.
      if (Date.now() - lastPush < 1000) return;
      lastPush = Date.now();
      void prisma.generation.update({ where: { id: gen.id }, data: { progress } }).catch(() => {});
      void publish({ type: 'generation.progress', generationId: gen.id, projectId: gen.projectId, progress, message });
    },
    onExternalId: (id) => void prisma.generation.update({ where: { id: gen.id }, data: { externalId: id } }).catch(() => {}),
  };

  try {
    const adapter = getAdapter(gen.provider.adapter);
    const cfg = providerConfig(gen.provider);
    const params = (gen.params ?? {}) as Record<string, any>;
    const inputs = await loadInputs(gen.inputAssetIds, params.inputRoles ?? [], !!adapter.meta.needsPublicInputUrls);
    ctx.onProgress?.(5, 'Envoi au provider');

    let result: GenerationResult;
    const modelId = gen.model.modelId;
    switch (gen.capability) {
      case 'IMAGE':
        if (!adapter.image) throw new ProviderError('unsupported');
        result = await adapter.image.generate(cfg, { model: modelId, mode: gen.mode as any, prompt: gen.prompt, negative: gen.negative ?? undefined, params, inputs }, ctx);
        break;
      case 'VIDEO':
        if (!adapter.video) throw new ProviderError('unsupported');
        result = await adapter.video.generate(cfg, { model: modelId, mode: gen.mode as any, prompt: gen.prompt, negative: gen.negative ?? undefined, params, inputs }, ctx);
        break;
      case 'AUDIO':
        if (!adapter.audio) throw new ProviderError('unsupported');
        result = await adapter.audio.generate(cfg, { model: modelId, mode: gen.mode as any, prompt: gen.prompt, params, inputs }, ctx);
        break;
      default:
        throw new ProviderError('unsupported', `Capacité ${gen.capability} hors file.`);
    }
    if (!result.outputs.length) throw new ProviderError('upstream', 'Le provider n’a rien renvoyé.');

    // Une panne de stockage n'est pas une erreur du provider : on le dit.
    const assetIds = await storeOutputs(gen, result.outputs, params.links ?? {}).catch((e) => {
      throw e instanceof ProviderError ? e : new ProviderError('internal', e instanceof Error ? e.message : String(e));
    });
    const cost = result.costUsd ?? estimateCost(gen.model.pricing as any, result.usage);
    await prisma.$transaction([
      prisma.generation.update({
        where: { id: gen.id },
        data: { status: 'COMPLETED', progress: 100, finishedAt: new Date(), durationMs: Date.now() - started, costUsd: cost, externalId: result.externalId ?? gen.externalId },
      }),
      prisma.usage.create({
        data: {
          projectId: gen.projectId,
          generationId: gen.id,
          userId: gen.userId,
          providerName: gen.provider.name,
          modelId: modelId,
          capability: gen.capability,
          inputTokens: result.usage?.inputTokens,
          outputTokens: result.usage?.outputTokens,
          units: result.usage?.units,
          unit: result.usage?.unit,
          costUsd: cost ?? 0,
        },
      }),
      prisma.generationJob.updateMany({ where: { generationId: gen.id, finishedAt: null }, data: { status: 'COMPLETED', finishedAt: new Date() } }),
    ]);
    await publish({ type: 'generation.completed', generationId: gen.id, projectId: gen.projectId, assetIds });
    return gen;
  } catch (e) {
    const err = toProviderError(e);
    const willRetry = err.retryable && opts.attempt < opts.maxAttempts && err.code !== 'canceled';
    await prisma.generation.update({
      where: { id: gen.id },
      data: {
        status: err.code === 'canceled' ? 'CANCELED' : willRetry ? 'QUEUED' : 'FAILED',
        error: err.message,
        errorCode: err.code,
        ...(willRetry ? {} : { finishedAt: new Date(), durationMs: Date.now() - started }),
      },
    });
    await prisma.generationJob.updateMany({ where: { generationId: gen.id, finishedAt: null }, data: { status: willRetry ? 'QUEUED' : 'FAILED', error: err.message, finishedAt: new Date() } });
    await publish({ type: 'generation.failed', generationId: gen.id, projectId: gen.projectId, error: err.message, code: err.code, willRetry });
    throw err;
  }
}

async function loadInputs(ids: string[], roles: string[], needPublic: boolean): Promise<InputFile[]> {
  if (!ids.length) return [];
  const assets = await prisma.asset.findMany({ where: { id: { in: ids } }, include: { links: { include: { character: { select: { code: true } }, location: { select: { code: true } } } } } });
  const byId = new Map(assets.map((a) => [a.id, a]));
  return Promise.all(
    ids.map(async (id, i) => {
      const a = byId.get(id)!;
      const link = a.links.find((l) => l.character || l.location);
      return {
        role: (roles[i] ?? 'reference') as InputFile['role'],
        mimeType: a.mimeType,
        data: await getObject(a.storageKey),
        url: needPublic ? await publicUrl(a.storageKey) : null,
        tag: link?.character?.code ?? link?.location?.code ?? null,
        name: a.name,
      };
    }),
  );
}

const TYPE_OF = (mime: string) => (mime.startsWith('image/') ? 'IMAGE' : mime.startsWith('video/') ? 'VIDEO' : mime.startsWith('audio/') ? 'AUDIO' : 'DOCUMENT') as 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT';

async function storeOutputs(gen: { id: string; projectId: string; userId: string; shotId: string | null; target: string | null; capability: Capability; prompt: string }, outputs: OutputFile[], links: Links) {
  const shot = gen.shotId ? await prisma.shot.findUnique({ where: { id: gen.shotId }, include: { characters: true } }) : null;
  const characterIds = links.characterIds ?? shot?.characters.map((c) => c.characterId) ?? [];
  const locationId = links.locationId ?? shot?.locationId ?? null;
  const sceneId = links.sceneId ?? shot?.sceneId ?? null;
  const ids: string[] = [];

  for (const [i, out] of outputs.entries()) {
    if (!out.data) throw new ProviderError('upstream', 'Sortie sans contenu.');
    const type = TYPE_OF(out.mimeType);
    let { width, height } = out;
    if (type === 'IMAGE' && (!width || !height)) {
      try {
        const d = imageSize(new Uint8Array(out.data));
        width = d.width;
        height = d.height;
      } catch {}
    }
    const key = keyFor(gen.projectId, type.toLowerCase(), out.mimeType);
    await putObject(key, out.data, out.mimeType);
    const name = `${shot ? shot.code : (gen.target ?? type.toLowerCase())}-${gen.id.slice(-6)}${outputs.length > 1 ? `-${i + 1}` : ''}`;
    const asset = await prisma.asset.create({
      data: {
        projectId: gen.projectId,
        ownerId: gen.userId,
        type,
        source: 'GENERATED',
        name,
        storageKey: key,
        mimeType: out.mimeType,
        sizeBytes: out.data.length,
        width,
        height,
        durationSec: out.durationSec,
        generationId: gen.id,
        isReference: !!links.setAsRefOf,
        referenceKind: links.setAsRefOf?.type ?? null,
        tags: [gen.target, gen.capability.toLowerCase()].filter(Boolean) as string[],
        links: {
          create: [
            ...(gen.shotId ? [{ shotId: gen.shotId }] : []),
            ...(sceneId ? [{ sceneId }] : []),
            ...characterIds.map((characterId) => ({ characterId })),
            ...(locationId ? [{ locationId }] : []),
            ...(links.propId ? [{ propId: links.propId }] : []),
          ],
        },
      },
    });
    ids.push(asset.id);
  }

  // La première sortie devient la référence demandée : c'est ce qui fait
  // qu'une feuille de personnage générée alimente ensuite tous ses plans.
  if (links.setAsRefOf && ids[0]) {
    const { type, id } = links.setAsRefOf;
    const data = { refAssetId: ids[0] };
    if (type === 'character') await prisma.character.update({ where: { id }, data });
    if (type === 'location') await prisma.location.update({ where: { id }, data });
    if (type === 'prop') await prisma.prop.update({ where: { id }, data });
    if (type === 'style') await prisma.style.update({ where: { id }, data });
    await publish({ type: 'project.updated', projectId: gen.projectId, entity: type, id });
  }
  return ids;
}

// ─────────────────────────────── Texte ───────────────────────────────
// Le texte ne passe pas par la file : l'assistant et les outils d'écriture
// attendent une réponse en secondes, en streaming. Chaque appel est quand
// même tracé (Generation + Usage) pour le suivi des coûts.

export interface TextCall {
  projectId: string;
  userId: string;
  modelId?: string;
  system?: string;
  messages: ChatMessage[];
  maxTokens?: number;
  json?: boolean;
  /** Étiquette de la tâche, pour l'historique : concept, rewrite, assistant… */
  task: string;
}

async function prepareText(call: TextCall) {
  const project = await prisma.project.findUniqueOrThrow({ where: { id: call.projectId }, select: { workspaceId: true } });
  const { model } = await resolveModel({ workspaceId: project.workspaceId, capability: 'TEXT', mode: 'text', modelId: call.modelId ?? 'auto', prefer: 'quality' });
  const adapter = getAdapter(model.provider.adapter);
  if (!adapter.text) throw new StudioError('unsupported', `${model.provider.name} ne génère pas de texte.`);
  return { model, adapter, cfg: providerConfig(model.provider), req: { model: model.modelId, system: call.system, messages: call.messages, maxTokens: call.maxTokens, json: call.json } };
}

async function recordText(call: TextCall, model: Awaited<ReturnType<typeof prepareText>>['model'], result: GenerationResult, started: number) {
  const cost = result.costUsd ?? estimateCost(model.pricing as any, result.usage);
  const lastUser = [...call.messages].reverse().find((m) => m.role === 'user')?.content ?? '';
  const gen = await prisma.generation.create({
    data: {
      projectId: call.projectId,
      userId: call.userId,
      capability: 'TEXT',
      mode: 'text',
      status: 'COMPLETED',
      providerId: model.providerId,
      modelId: model.id,
      target: call.task,
      prompt: lastUser.slice(0, 20000),
      outputText: result.text?.slice(0, 200000),
      progress: 100,
      costUsd: cost,
      durationMs: Date.now() - started,
      startedAt: new Date(started),
      finishedAt: new Date(),
    },
  });
  await prisma.usage.create({
    data: { projectId: call.projectId, generationId: gen.id, userId: call.userId, providerName: model.provider.name, modelId: model.modelId, capability: 'TEXT', inputTokens: result.usage?.inputTokens, outputTokens: result.usage?.outputTokens, costUsd: cost ?? 0 },
  });
  return { generationId: gen.id, costUsd: cost };
}

export async function runText(call: TextCall, signal?: AbortSignal) {
  const started = Date.now();
  const { model, adapter, cfg, req } = await prepareText(call);
  try {
    const result = await adapter.text!.generate(cfg, req, { signal });
    const rec = await recordText(call, model, result, started);
    return { text: result.text ?? '', model: { id: model.id, label: model.label, provider: model.provider.name }, ...rec };
  } catch (e) {
    throw toProviderError(e);
  }
}

/** Streaming : renvoie les morceaux de texte au fur et à mesure, puis le bilan. */
export async function* streamText(call: TextCall, signal?: AbortSignal): AsyncGenerator<{ delta: string } | { done: { text: string; generationId: string; costUsd: number | null; model: string } }> {
  const started = Date.now();
  const { model, adapter, cfg, req } = await prepareText(call);
  if (!adapter.text!.stream) {
    const result = await adapter.text!.generate(cfg, req, { signal });
    yield { delta: result.text ?? '' };
    const rec = await recordText(call, model, result, started);
    yield { done: { text: result.text ?? '', ...rec, model: model.label } };
    return;
  }
  for await (const chunk of adapter.text!.stream(cfg, req, { signal })) {
    if (typeof chunk === 'string') yield { delta: chunk };
    else {
      const rec = await recordText(call, model, chunk.done, started);
      yield { done: { text: chunk.done.text ?? '', ...rec, model: model.label } };
    }
  }
}

/** Extrait un objet JSON d'une réponse de modèle, même entourée de texte. */
export function parseJsonReply<T = unknown>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  const start = raw.search(/[[{]/);
  const end = Math.max(raw.lastIndexOf('}'), raw.lastIndexOf(']'));
  if (start < 0 || end < start) throw new StudioError('invalid', 'Le modèle n’a pas renvoyé de JSON exploitable.');
  try {
    return JSON.parse(raw.slice(start, end + 1)) as T;
  } catch {
    throw new StudioError('invalid', 'Le modèle a renvoyé un JSON invalide. Relancer, ou choisir un modèle plus capable.');
  }
}
