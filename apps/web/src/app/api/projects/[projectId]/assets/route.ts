import { prisma, type Prisma } from '@regie/db';
import { keyFor, putObject } from '@regie/storage';
import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { imageSize } from 'image-size';
import { api, audit, HttpError, project, rateLimit } from '@/lib/api';

type P = { projectId: string };

const ALLOWED = /^(image\/(png|jpeg|webp|gif)|video\/(mp4|webm|quicktime)|audio\/(mpeg|wav|x-wav|ogg|mp4)|application\/pdf)$/;
const MAX = Number(process.env.UPLOAD_MAX_MB ?? 50) * 1024 * 1024;

// Signatures binaires : le type annoncé par le navigateur ne suffit pas.
function sniff(buf: Buffer): string | null {
  const h = buf.subarray(0, 12);
  if (h[0] === 0x89 && h[1] === 0x50) return 'image/png';
  if (h[0] === 0xff && h[1] === 0xd8) return 'image/jpeg';
  if (h.toString('ascii', 0, 4) === 'RIFF' && h.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  if (h.toString('ascii', 0, 3) === 'GIF') return 'image/gif';
  if (h.toString('ascii', 4, 8) === 'ftyp') return h.toString('ascii', 8, 10) === 'qt' ? 'video/quicktime' : 'video/mp4';
  if (h[0] === 0x1a && h[1] === 0x45) return 'video/webm';
  if (h.toString('ascii', 0, 3) === 'ID3' || (h[0] === 0xff && (h[1] & 0xe0) === 0xe0)) return 'audio/mpeg';
  if (h.toString('ascii', 0, 4) === 'RIFF' && h.toString('ascii', 8, 12) === 'WAVE') return 'audio/wav';
  if (h.toString('ascii', 0, 4) === 'OggS') return 'audio/ogg';
  if (h.toString('ascii', 0, 4) === '%PDF') return 'application/pdf';
  return null;
}

// Durée et dimensions d'une vidéo ou d'un son, lues par ffprobe. Sans FFmpeg
// installé, on s'en passe : l'éditeur de montage les relira dans le navigateur.
async function probeMedia(buf: Buffer, ext: string) {
  const dir = await mkdtemp(join(tmpdir(), 'regie-probe-'));
  try {
    const path = join(dir, `f.${ext}`);
    await writeFile(path, buf);
    const { stdout } = await promisify(execFile)('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,width,height:format=duration', '-of', 'json', path], { timeout: 15_000 });
    const j = JSON.parse(stdout);
    const v = (j.streams ?? []).find((s: any) => s.codec_type === 'video');
    const d = Number(j.format?.duration);
    return { durationSec: Number.isFinite(d) ? d : undefined, width: v?.width, height: v?.height };
  } catch {
    return {};
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export const GET = api<P>(async ({ params, user, req }) => {
  await project(params.projectId, user);
  const sp = req.nextUrl.searchParams;
  const take = Math.min(Number(sp.get('take') ?? 60), 200);
  const cursor = sp.get('cursor');
  const q = sp.get('q');
  const where: Prisma.AssetWhereInput = {
    projectId: params.projectId,
    ...(sp.get('type') ? { type: sp.get('type') as any } : {}),
    ...(sp.get('source') ? { source: sp.get('source') as any } : {}),
    ...(sp.get('reference') === '1' ? { isReference: true } : {}),
    ...(sp.get('referenceKind') ? { referenceKind: sp.get('referenceKind') } : {}),
    ...(sp.get('tag') ? { tags: { has: sp.get('tag')! } } : {}),
    ...(q ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { tags: { has: q } }, { generation: { prompt: { contains: q, mode: 'insensitive' } } }] } : {}),
    ...(sp.get('characterId') ? { links: { some: { characterId: sp.get('characterId') } } } : {}),
    ...(sp.get('locationId') ? { links: { some: { locationId: sp.get('locationId') } } } : {}),
    ...(sp.get('sceneId') ? { links: { some: { sceneId: sp.get('sceneId') } } } : {}),
    ...(sp.get('shotId') ? { links: { some: { shotId: sp.get('shotId') } } } : {}),
    ...(sp.get('providerId') ? { generation: { providerId: sp.get('providerId') } } : {}),
    ...(sp.get('modelId') ? { generation: { modelId: sp.get('modelId') } } : {}),
  };
  const items = await prisma.asset.findMany({
    where,
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    orderBy: sp.get('order') === 'asc' ? [{ createdAt: 'asc' }, { id: 'asc' }] : [{ createdAt: 'desc' }, { id: 'desc' }],
    include: {
      generation: { select: { id: true, prompt: true, mode: true, costUsd: true, model: { select: { label: true } }, provider: { select: { name: true } } } },
      links: { select: { characterId: true, locationId: true, sceneId: true, shotId: true, propId: true } },
    },
  });
  return { items: items.slice(0, take), nextCursor: items.length > take ? items[take - 1].id : null };
});

// Upload multipart : un ou plusieurs fichiers, taille et type vérifiés.
export const POST = api<P>(async ({ params, user, req }) => {
  await project(params.projectId, user, 'project.edit');
  await rateLimit(`upload:${user.id}`, 120, 3600);
  const form = await req.formData();
  const files = form.getAll('file').filter((f): f is File => f instanceof File);
  if (!files.length) throw new HttpError(400, 'Aucun fichier.');
  const isReference = form.get('isReference') === 'true';
  const referenceKind = (form.get('referenceKind') as string) || null;
  const tags = String(form.get('tags') ?? '').split(',').map((t) => t.trim().toLowerCase()).filter(Boolean).slice(0, 20);
  const link = { characterId: form.get('characterId') as string | null, locationId: form.get('locationId') as string | null, propId: form.get('propId') as string | null, shotId: form.get('shotId') as string | null, sceneId: form.get('sceneId') as string | null };
  // Les entités à lier doivent appartenir au projet.
  for (const [k, id] of Object.entries(link)) {
    if (!id) continue;
    const table = { characterId: prisma.character, locationId: prisma.location, propId: prisma.prop, shotId: prisma.shot, sceneId: prisma.scene }[k] as any;
    if (!(await table.findFirst({ where: { id, projectId: params.projectId } }))) throw new HttpError(400, 'Entité à lier introuvable dans ce projet.');
  }

  const created = [];
  for (const f of files) {
    if (f.size > MAX) throw new HttpError(413, `${f.name} dépasse ${MAX / 1024 / 1024} Mo.`);
    const buf = Buffer.from(await f.arrayBuffer());
    const mime = sniff(buf);
    if (!mime || !ALLOWED.test(mime)) throw new HttpError(415, `${f.name} : type non accepté (images, vidéos, audio, PDF).`);
    let width: number | undefined;
    let height: number | undefined;
    if (mime.startsWith('image/')) {
      try {
        const d = imageSize(new Uint8Array(buf));
        width = d.width;
        height = d.height;
      } catch {}
    }
    const type = mime.startsWith('image/') ? 'IMAGE' : mime.startsWith('video/') ? 'VIDEO' : mime.startsWith('audio/') ? 'AUDIO' : 'DOCUMENT';
    let durationSec: number | undefined;
    if (type === 'VIDEO' || type === 'AUDIO') {
      const info = await probeMedia(buf, mime.split('/')[1] ?? 'bin');
      durationSec = info.durationSec;
      width ??= info.width;
      height ??= info.height;
    }
    const key = keyFor(params.projectId, type.toLowerCase(), mime);
    await putObject(key, buf, mime);
    const linkData = Object.fromEntries(Object.entries(link).filter(([, v]) => v));
    const asset = await prisma.asset.create({
      data: {
        projectId: params.projectId,
        ownerId: user.id,
        type: type as any,
        source: 'UPLOAD',
        name: f.name.replace(/\.[^.]+$/, '').slice(0, 160),
        storageKey: key,
        mimeType: mime,
        sizeBytes: buf.length,
        width,
        height,
        durationSec,
        isReference,
        referenceKind,
        tags,
        ...(Object.keys(linkData).length ? { links: { create: [linkData] } } : {}),
      },
    });
    created.push(asset);
  }
  await audit(user.id, 'asset.upload', 'project', params.projectId, { count: created.length });
  return created;
});
