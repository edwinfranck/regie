import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

// Les clés API des providers sont chiffrées en base (AES-256-GCM) et ne
// quittent jamais le serveur : l'interface n'en voit que les 4 derniers
// caractères.

function key() {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw || raw === 'change-me') throw new Error('ENCRYPTION_KEY manquante : générer avec `openssl rand -base64 32`.');
  const buf = Buffer.from(raw, 'base64');
  if (buf.length !== 32) throw new Error('ENCRYPTION_KEY doit faire 32 octets encodés en base64.');
  return buf;
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), enc.toString('base64')].join(':');
}

export function decryptSecret(blob: string): string {
  const [v, iv, tag, enc] = blob.split(':');
  if (v !== 'v1') throw new Error('Format de secret inconnu.');
  const d = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64'));
  d.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([d.update(Buffer.from(enc, 'base64')), d.final()]).toString('utf8');
}

export const secretHint = (plain: string) => (plain.length > 8 ? `…${plain.slice(-4)}` : '…');
