import { prisma } from '@regie/db';
import { signedUrl } from '@regie/storage';
import { requireProject } from '@regie/studio';
import type { NextRequest } from 'next/server';
import { currentUser } from '@/lib/auth';

// <img src="/api/files/ID"> : contrôle des droits, puis redirection vers une
// URL signée de courte durée. Le bucket n'est jamais public.
export async function GET(req: NextRequest, { params }: { params: Promise<{ assetId: string }> }) {
  const user = await currentUser();
  if (!user) return new Response('Non connecté.', { status: 401 });
  const { assetId } = await params;
  const asset = await prisma.asset.findUnique({ where: { id: assetId }, select: { projectId: true, storageKey: true, name: true, mimeType: true } });
  if (!asset) return new Response('Introuvable.', { status: 404 });
  try {
    await requireProject(asset.projectId, user.id);
  } catch {
    return new Response('Introuvable.', { status: 404 });
  }
  const download = req.nextUrl.searchParams.get('download') ? `${asset.name}.${asset.mimeType.split('/')[1]?.replace('jpeg', 'jpg').replace('quicktime', 'mov').replace('mpeg', 'mp3') ?? 'bin'}` : undefined;
  const url = await signedUrl(asset.storageKey, { expiresIn: 3600, download });
  return new Response(null, { status: 302, headers: { Location: url, 'Cache-Control': 'private, max-age=3000' } });
}
