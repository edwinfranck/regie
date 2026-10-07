import { Queue, type JobsOptions } from 'bullmq';
import { Redis } from 'ioredis';

// La file de génération. Toute génération d'image, de vidéo ou d'audio passe
// par ici : l'API enregistre la demande et rend la main, un worker l'exécute,
// l'interface suit la progression en temps réel par Server-Sent Events.
//
//   Frontend → API → Queue → Worker → Provider → Storage → Database → Frontend

export const QUEUE_NAME = process.env.REGIE_QUEUE ?? 'generations';

export interface GenerationJobData {
  generationId: string;
}

/** Les événements poussés vers l'interface. */
export type StudioEvent =
  | { type: 'generation.queued'; generationId: string; projectId: string; position?: number }
  | { type: 'generation.progress'; generationId: string; projectId: string; progress: number; message?: string }
  | { type: 'generation.completed'; generationId: string; projectId: string; assetIds: string[] }
  | { type: 'generation.failed'; generationId: string; projectId: string; error: string; code?: string; willRetry: boolean }
  | { type: 'project.updated'; projectId: string; entity: string; id?: string }
  | { type: 'render.progress'; renderId: string; timelineId: string; projectId: string; progress: number }
  | { type: 'render.completed'; renderId: string; timelineId: string; projectId: string; assetId: string }
  | { type: 'render.failed'; renderId: string; timelineId: string; projectId: string; error: string };

const url = () => process.env.REDIS_URL ?? 'redis://localhost:6379';

const g = globalThis as unknown as { __regieRedis?: Redis; __regieQueue?: Queue; __regiePub?: Redis };

/** Connexion partagée ; BullMQ exige maxRetriesPerRequest: null. */
export function redis(): Redis {
  if (!g.__regieRedis) g.__regieRedis = new Redis(url(), { maxRetriesPerRequest: null, lazyConnect: false });
  return g.__regieRedis;
}

export const connection = () => new Redis(url(), { maxRetriesPerRequest: null });

export function queue(): Queue<GenerationJobData> {
  if (!g.__regieQueue) g.__regieQueue = new Queue<GenerationJobData>(QUEUE_NAME, { connection: redis() });
  return g.__regieQueue as Queue<GenerationJobData>;
}

export const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 10_000 },
  removeOnComplete: { age: 7 * 24 * 3600, count: 5000 },
  removeOnFail: { age: 30 * 24 * 3600 },
};

export async function enqueueGeneration(generationId: string, opts: JobsOptions = {}) {
  // jobId = generationId : une même génération ne peut pas être en file deux fois.
  const job = await queue().add('generate', { generationId }, { ...DEFAULT_JOB_OPTIONS, jobId: generationId, ...opts });
  return job;
}

// ── Rendus de montage (FFmpeg), dans une file séparée : un rendu est long et
// gourmand, il ne doit pas retarder les générations. ──

export const RENDER_QUEUE = process.env.REGIE_RENDER_QUEUE ?? 'renders';
const gr = globalThis as unknown as { __regieRenderQueue?: Queue<{ renderId: string }> };
export function renderQueue(): Queue<{ renderId: string }> {
  if (!gr.__regieRenderQueue) gr.__regieRenderQueue = new Queue<{ renderId: string }>(RENDER_QUEUE, { connection: redis() });
  return gr.__regieRenderQueue;
}
export const enqueueRender = (renderId: string) => renderQueue().add('render', { renderId }, { jobId: renderId, attempts: 2, backoff: { type: 'fixed', delay: 5000 }, removeOnComplete: { count: 500 }, removeOnFail: { count: 500 } });

export async function cancelGeneration(generationId: string) {
  const job = await queue().getJob(generationId);
  if (job && (await job.isWaiting() || await job.isDelayed())) await job.remove();
  await redis().publish(`regie:cancel`, generationId);
}

export async function queueCounts() {
  return queue().getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed');
}

/** Position dans la file (0 = prochaine à partir). */
export async function queuePosition(generationId: string) {
  const waiting = await queue().getWaiting(0, 500);
  const i = waiting.findIndex((j) => j.id === generationId);
  return i < 0 ? null : i;
}

// ── Événements temps réel (pub/sub Redis → SSE) ──

export const channel = (projectId: string) => `regie:events:${projectId}`;

export async function publish(ev: StudioEvent) {
  if (!g.__regiePub) g.__regiePub = new Redis(url(), { maxRetriesPerRequest: null });
  await g.__regiePub.publish(channel(ev.projectId), JSON.stringify(ev));
}

/** Abonnement à un ou plusieurs projets ; renvoie la fonction de désabonnement. */
export function subscribe(projectIds: string[], onEvent: (ev: StudioEvent) => void) {
  const sub = new Redis(url(), { maxRetriesPerRequest: null });
  sub.subscribe(...projectIds.map(channel)).catch(() => {});
  sub.on('message', (_ch, msg) => {
    try {
      onEvent(JSON.parse(msg));
    } catch {}
  });
  return () => {
    sub.quit().catch(() => sub.disconnect());
  };
}
