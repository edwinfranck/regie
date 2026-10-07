import { execFile, spawn } from 'node:child_process';
import { mkdtemp, rm, stat, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { type MediaRef, type Sequence, type Track, assembleFromShots, buildRenderPlan, dimsFor, sequenceDuration, toSrt } from '@regie/core';
import { prisma, type Prisma } from '@regie/db';
import { enqueueRender, publish } from '@regie/jobs';
import { getObject, keyFor, putObject } from '@regie/storage';
import { StudioError } from './errors';

// Le montage côté serveur : séquences en base, assemblage depuis le
// découpage, rendu FFmpeg dans une file dédiée.

const run = promisify(execFile);

const mediaOf = (a: { id: string; type: string; name: string; mimeType: string; durationSec: number | null; width: number | null; height: number | null; storageKey: string }): MediaRef => ({
  id: a.id,
  type: a.type as MediaRef['type'],
  name: a.name,
  mimeType: a.mimeType,
  durationSec: a.durationSec,
  width: a.width,
  height: a.height,
  storageKey: a.storageKey,
});

export async function loadSequence(timelineId: string) {
  const tl = await prisma.timeline.findUniqueOrThrow({
    where: { id: timelineId },
    include: { project: { select: { aspectRatio: true, resolution: true, fps: true } }, tracks: { orderBy: { order: 'asc' }, include: { clips: { orderBy: { startSec: 'asc' }, include: { asset: true } } } } },
  });
  const { width, height } = dimsFor(tl.aspectRatio || tl.project.aspectRatio, tl.resolution || (tl.aspectRatio ? null : tl.project.resolution));
  const media = new Map<string, MediaRef>();
  const sequence: Sequence = {
    id: tl.id,
    name: tl.name,
    fps: tl.fps,
    width,
    height,
    tracks: tl.tracks.map((t) => ({
      id: t.id,
      kind: t.kind,
      name: t.name,
      order: t.order,
      muted: t.muted,
      locked: t.locked,
      volume: t.volume,
      clips: t.clips.map(({ asset, trackId: _t, ...c }) => {
        if (asset) media.set(asset.id, mediaOf(asset));
        return c;
      }),
    })),
  };
  return { timeline: tl, sequence, media };
}

/** Remplace l'état complet de la séquence (pistes et clips), en une transaction. */
export async function saveSequence(timelineId: string, projectId: string, input: { name?: string; fps?: number; aspectRatio?: string | null; tracks: Track[] }) {
  const assetIds = [...new Set(input.tracks.flatMap((t) => t.clips.map((c) => c.assetId).filter(Boolean) as string[]))];
  if (assetIds.length) {
    const n = await prisma.asset.count({ where: { id: { in: assetIds }, projectId } });
    if (n !== assetIds.length) throw new StudioError('forbidden', 'Un média de la séquence n’appartient pas à ce projet.');
  }
  await prisma.$transaction([
    prisma.timelineTrack.deleteMany({ where: { timelineId } }),
    prisma.timeline.update({ where: { id: timelineId }, data: { ...(input.name ? { name: input.name } : {}), ...(input.fps ? { fps: input.fps } : {}), ...(input.aspectRatio !== undefined ? { aspectRatio: input.aspectRatio } : {}) } }),
    ...input.tracks.map((t, order) =>
      prisma.timelineTrack.create({
        data: {
          id: t.id,
          timelineId,
          kind: t.kind,
          name: t.name,
          order: t.order ?? order,
          muted: t.muted,
          locked: t.locked,
          volume: t.volume,
          clips: {
            create: t.clips.map((c) => ({
              id: c.id,
              assetId: c.assetId ?? null,
              shotId: c.shotId ?? null,
              name: c.name ?? null,
              startSec: c.startSec,
              inSec: c.inSec,
              outSec: c.outSec,
              volume: c.volume,
              opacity: c.opacity,
              fadeInSec: c.fadeInSec,
              fadeOutSec: c.fadeOutSec,
              text: c.text ?? null,
            })),
          },
        },
      }),
    ),
  ]);
}

/** Les plans du projet dans l'ordre, avec leur meilleure vidéo et leur image de case. */
async function shotsForAssembly(projectId: string) {
  const shots = await prisma.shot.findMany({
    where: { projectId },
    orderBy: [{ scene: { order: 'asc' } }, { order: 'asc' }],
    include: {
      frameAsset: true,
      assetLinks: { where: { asset: { type: { in: ['VIDEO', 'IMAGE'] } } }, include: { asset: true }, orderBy: { asset: { createdAt: 'desc' } } },
    },
  });
  return shots.map((s) => {
    const video = s.assetLinks.find((l) => l.asset.type === 'VIDEO')?.asset;
    const image = s.frameAsset ?? s.assetLinks.find((l) => l.asset.type === 'IMAGE')?.asset;
    return { id: s.id, code: s.code, durationSec: s.durationSec, dialogue: s.dialogue, video: video ? mediaOf(video) : null, image: image ? mediaOf(image) : null };
  });
}

export async function createTimeline(projectId: string, input: { name: string; assemble?: boolean; aspectRatio?: string | null }) {
  const count = await prisma.timeline.count({ where: { projectId } });
  const tl = await prisma.timeline.create({ data: { projectId, name: input.name, order: count, aspectRatio: input.aspectRatio ?? null, fps: (await prisma.project.findUniqueOrThrow({ where: { id: projectId }, select: { fps: true } })).fps } });
  const { tracks, missing } = input.assemble ? assembleFromShots(await shotsForAssembly(projectId)) : { tracks: (await import('@regie/core')).defaultTracks(), missing: [] as string[] };
  await saveSequence(tl.id, projectId, { tracks });
  return { timeline: tl, missing };
}

/** Réassemble V1 et les sous-titres depuis le découpage ; les autres pistes restent. */
export async function reassemble(timelineId: string, projectId: string) {
  const { sequence } = await loadSequence(timelineId);
  const { tracks, missing } = assembleFromShots(await shotsForAssembly(projectId));
  const v1 = tracks.find((t) => t.name === 'V1')!;
  const subs = tracks.find((t) => t.kind === 'SUBTITLE')!;
  const next = sequence.tracks.map((t) => {
    if (t.kind === 'VIDEO' && t.name === 'V1') return { ...t, clips: v1.clips };
    if (t.kind === 'SUBTITLE') return { ...t, clips: subs.clips };
    return t;
  });
  if (!next.some((t) => t.name === 'V1')) next.push({ ...v1, order: next.length });
  await saveSequence(timelineId, projectId, { tracks: next });
  return { missing };
}

export async function duplicateTimeline(timelineId: string, projectId: string) {
  const { timeline, sequence } = await loadSequence(timelineId);
  const copy = await prisma.timeline.create({ data: { projectId, name: `${timeline.name} (copie)`, fps: timeline.fps, aspectRatio: timeline.aspectRatio, resolution: timeline.resolution, order: timeline.order + 1 } });
  const { newId } = await import('@regie/core');
  await saveSequence(copy.id, projectId, { tracks: sequence.tracks.map((t) => ({ ...t, id: newId('t'), clips: t.clips.map((c) => ({ ...c, id: newId() })) })) });
  return copy;
}

// ── Rendu ──

export async function requestRender(timelineId: string, userId: string, format: 'mp4' | 'mov', quality: 'draft' | 'standard' | 'high' = 'standard', burnSubtitles = true) {
  const { timeline, sequence, media } = await loadSequence(timelineId);
  if (sequenceDuration(sequence) <= 0 || !sequence.tracks.some((t) => t.clips.length)) throw new StudioError('invalid', 'La séquence est vide : rien à rendre.');
  const render = await prisma.render.create({
    data: { projectId: timeline.projectId, timelineId, userId, format, spec: { sequence, media: [...media.values()], quality, burnSubtitles } as unknown as Prisma.InputJsonValue, durationSec: sequenceDuration(sequence) },
  });
  await enqueueRender(render.id);
  return render;
}

async function probe(path: string) {
  try {
    const { stdout } = await run('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type:format=duration', '-of', 'json', path]);
    const j = JSON.parse(stdout);
    return { hasAudio: (j.streams ?? []).some((s: any) => s.codec_type === 'audio'), duration: Number(j.format?.duration) || null };
  } catch {
    return { hasAudio: false, duration: null };
  }
}

export async function runRender(renderId: string, signal?: AbortSignal) {
  const r = await prisma.render.findUniqueOrThrow({ where: { id: renderId }, include: { timeline: { select: { name: true } } } });
  if (r.status === 'COMPLETED') return r;
  const spec = r.spec as unknown as { sequence: Sequence; media: MediaRef[]; quality: 'draft' | 'standard' | 'high'; burnSubtitles: boolean };
  const ev = { renderId: r.id, timelineId: r.timelineId, projectId: r.projectId };
  await prisma.render.update({ where: { id: r.id }, data: { status: 'PROCESSING', progress: 0, error: null } });
  const dir = await mkdtemp(join(tmpdir(), 'regie-render-'));
  try {
    const media = new Map(spec.media.map((m) => [m.id, m]));
    const paths = new Map<string, string>();
    const audio = new Map<string, boolean>();
    for (const m of media.values()) {
      const ext = m.storageKey?.split('.').pop() ?? 'bin';
      const p = join(dir, `${m.id}.${ext}`);
      await writeFile(p, await getObject(m.storageKey!));
      paths.set(m.id, p);
      if (m.type === 'VIDEO') audio.set(m.id, (await probe(p)).hasAudio);
    }
    const srt = toSrt(spec.sequence);
    const srtPath = spec.burnSubtitles && srt.trim() ? join(dir, 'subs.srt') : null;
    if (srtPath) await writeFile(srtPath, srt);
    const output = join(dir, `out.${r.format}`);
    const plan = buildRenderPlan(spec.sequence, media, { format: r.format as 'mp4' | 'mov', output, pathOf: (id) => paths.get(id)!, hasAudio: (id) => audio.get(id) ?? false, srtPath, quality: spec.quality });

    await new Promise<void>((resolve, reject) => {
      const p = spawn('ffmpeg', plan.args, { signal });
      let err = '';
      let last = 0;
      p.stdout.on('data', (d: Buffer) => {
        const m = [...d.toString().matchAll(/out_time_(?:us|ms)=(\d+)/g)].pop();
        if (!m) return;
        const pct = Math.min(99, Math.round((Number(m[1]) / 1e6 / plan.durationSec) * 100));
        if (pct >= last + 3) {
          last = pct;
          void prisma.render.update({ where: { id: r.id }, data: { progress: pct } }).catch(() => {});
          void publish({ type: 'render.progress', ...ev, progress: pct });
        }
      });
      p.stderr.on('data', (d: Buffer) => (err = (err + d.toString()).slice(-4000)));
      p.on('error', reject);
      p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`FFmpeg a échoué (code ${code}) : ${err.trim().split('\n').slice(-3).join(' ')}`))));
    });

    const data = await readFile(output);
    const mime = r.format === 'mov' ? 'video/quicktime' : 'video/mp4';
    const key = keyFor(r.projectId, 'video', mime);
    await putObject(key, data, mime);
    const info = await probe(output);
    const asset = await prisma.asset.create({
      data: {
        projectId: r.projectId,
        ownerId: r.userId,
        type: 'VIDEO',
        source: 'GENERATED',
        name: `${r.timeline.name} — montage`,
        storageKey: key,
        mimeType: mime,
        sizeBytes: (await stat(output)).size,
        width: spec.sequence.width,
        height: spec.sequence.height,
        durationSec: info.duration ?? plan.durationSec,
        tags: ['montage', r.format],
      },
    });
    await prisma.render.update({ where: { id: r.id }, data: { status: 'COMPLETED', progress: 100, assetId: asset.id, finishedAt: new Date() } });
    await publish({ type: 'render.completed', ...ev, assetId: asset.id });
    return r;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await prisma.render.update({ where: { id: r.id }, data: { status: signal?.aborted ? 'CANCELED' : 'FAILED', error: message.slice(0, 2000), finishedAt: new Date() } });
    await publish({ type: 'render.failed', ...ev, error: message.slice(0, 500) });
    throw e;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
