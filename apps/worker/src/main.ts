import { prisma } from '@regie/db';
import { QUEUE_NAME, RENDER_QUEUE, connection, type GenerationJobData, redis } from '@regie/jobs';
import { ProviderError } from '@regie/providers';
import { runGeneration, runRender } from '@regie/studio';
import { UnrecoverableError, Worker } from 'bullmq';

// Le worker : consomme la file de génération. Plusieurs instances peuvent
// tourner en parallèle ; BullMQ garantit qu'un job n'est pris qu'une fois.

const concurrency = Number(process.env.WORKER_CONCURRENCY ?? 4);
const running = new Map<string, AbortController>();

// Annulation demandée depuis l'interface pendant l'exécution.
const cancelSub = connection();
await cancelSub.subscribe('regie:cancel');
cancelSub.on('message', (_ch, id) => running.get(id)?.abort());

const worker = new Worker<GenerationJobData>(
  QUEUE_NAME,
  async (job) => {
    const { generationId } = job.data;
    const ctrl = new AbortController();
    running.set(generationId, ctrl);
    const attempt = job.attemptsMade + 1;
    const maxAttempts = job.opts.attempts ?? 1;
    if (attempt > 1) await prisma.generationJob.create({ data: { generationId, queueJobId: String(job.id), attempt } });
    try {
      await runGeneration(generationId, { signal: ctrl.signal, attempt, maxAttempts });
    } catch (e) {
      // Une erreur non rattrapable (clé refusée, contenu refusé…) ne se
      // réessaie pas : inutile de brûler trois fois des crédits.
      if (e instanceof ProviderError && !e.retryable) throw new UnrecoverableError(e.message);
      throw e;
    } finally {
      running.delete(generationId);
    }
  },
  { connection: redis(), concurrency, lockDuration: 5 * 60_000 },
);

// Les rendus de montage : FFmpeg, un ou deux à la fois selon la machine.
const renderWorker = new Worker<{ renderId: string }>(
  RENDER_QUEUE,
  async (job) => {
    const ctrl = new AbortController();
    running.set(job.data.renderId, ctrl);
    try {
      await runRender(job.data.renderId, ctrl.signal);
    } finally {
      running.delete(job.data.renderId);
    }
  },
  { connection: connection(), concurrency: Number(process.env.RENDER_CONCURRENCY ?? 1), lockDuration: 30 * 60_000 },
);
renderWorker.on('completed', (job) => console.log(`✓ rendu ${job.data.renderId}`));
renderWorker.on('failed', (job, err) => console.log(`✗ rendu ${job?.data.renderId} : ${err.message}`));

worker.on('failed', (job, err) => console.log(`✗ ${job?.data.generationId} (essai ${job?.attemptsMade}) : ${err.message}`));
worker.on('completed', (job) => console.log(`✓ ${job.data.generationId}`));
worker.on('ready', () => console.log(`worker régie prêt — ${concurrency} génération(s) en parallèle`));

// Au démarrage : une génération marquée PROCESSING sans job actif a été
// interrompue par un arrêt brutal. BullMQ la relancera (stalled) ; on remet
// juste son statut d'aplomb pour l'interface.
await prisma.generation.updateMany({ where: { status: 'PROCESSING', startedAt: { lt: new Date(Date.now() - 30 * 60_000) } }, data: { status: 'QUEUED' } });

async function shutdown() {
  console.log('arrêt du worker…');
  for (const c of running.values()) c.abort();
  await worker.close();
  await renderWorker.close();
  await cancelSub.quit();
  await prisma.$disconnect();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
