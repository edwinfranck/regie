import { CreateBucketCommand, DeleteObjectCommand, GetObjectCommand, HeadBucketCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'node:crypto';

// Stockage objet compatible S3 : AWS S3, Cloudflare R2, Supabase Storage,
// MinIO. Les fichiers ne sont jamais servis en direct : l'application
// délivre des URLs signées à durée courte, après contrôle des droits.

const env = (k: string, d?: string) => process.env[k] ?? d;

let client: S3Client | null = null;
function s3() {
  if (!client)
    client = new S3Client({
      endpoint: env('S3_ENDPOINT'),
      region: env('S3_REGION', 'us-east-1'),
      forcePathStyle: env('S3_FORCE_PATH_STYLE', 'true') === 'true',
      credentials: { accessKeyId: env('S3_ACCESS_KEY_ID', '')!, secretAccessKey: env('S3_SECRET_ACCESS_KEY', '')! },
    });
  return client;
}
const bucket = () => env('S3_BUCKET', 'regie')!;

let ensured = false;
/** Crée le bucket au premier usage s'il n'existe pas (MinIO en local). */
export async function ensureBucket() {
  if (ensured) return;
  try {
    await s3().send(new HeadBucketCommand({ Bucket: bucket() }));
  } catch {
    await s3().send(new CreateBucketCommand({ Bucket: bucket() }));
  }
  ensured = true;
}

const EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/ogg': 'ogg',
  'application/pdf': 'pdf',
  'application/json': 'json',
  'text/plain': 'txt',
};
export const extFor = (mime: string) => EXT[mime] ?? 'bin';

export function keyFor(projectId: string, kind: string, mime: string) {
  return `projects/${projectId}/${kind}/${new Date().toISOString().slice(0, 7)}/${randomUUID()}.${extFor(mime)}`;
}

export async function putObject(key: string, body: Buffer, contentType: string) {
  await ensureBucket();
  await s3().send(new PutObjectCommand({ Bucket: bucket(), Key: key, Body: body, ContentType: contentType }));
  return key;
}

export async function getObject(key: string): Promise<Buffer> {
  const r = await s3().send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
  return Buffer.from(await r.Body!.transformToByteArray());
}

export async function deleteObject(key: string) {
  await s3().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
}

/** URL signée de lecture. `download` force l'enregistrement sous ce nom. */
export async function signedUrl(key: string, { expiresIn = 3600, download }: { expiresIn?: number; download?: string } = {}) {
  return getSignedUrl(
    s3(),
    new GetObjectCommand({ Bucket: bucket(), Key: key, ...(download ? { ResponseContentDisposition: `attachment; filename="${download.replace(/"/g, '')}"` } : {}) }),
    { expiresIn },
  );
}

/**
 * URL joignable depuis Internet, pour les providers qui refusent les données
 * inline (Luma). Nécessite S3_PUBLIC_URL (domaine public du bucket) ou un
 * stockage S3 public ; sinon l'URL signée locale est renvoyée et l'adapter
 * expliquera pourquoi elle ne suffit pas.
 */
export async function publicUrl(key: string) {
  const pub = env('S3_PUBLIC_URL');
  if (pub) return `${pub.replace(/\/$/, '')}/${key}`;
  return signedUrl(key, { expiresIn: 6 * 3600 });
}
