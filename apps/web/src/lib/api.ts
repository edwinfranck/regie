import { redis } from '@regie/jobs';
import { ProviderError } from '@regie/providers';
import { type Action, StudioError, requireProject } from '@regie/studio';
import { prisma } from '@regie/db';
import type { NextRequest } from 'next/server';
import { ZodError, type ZodType } from 'zod';
import { type CurrentUser, currentUser } from './auth';

// Le socle de toutes les routes d'API : session, CSRF, validation, droits,
// erreurs compréhensibles. Une route n'écrit que sa logique métier.

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = 'error',
  ) {
    super(message);
  }
}

export interface Ctx<P> {
  req: NextRequest;
  params: P;
  user: CurrentUser;
}

type Handler<P> = (ctx: Ctx<P>) => Promise<unknown>;

export function api<P = Record<string, string>>(fn: Handler<P>, opts: { admin?: boolean } = {}) {
  return async (req: NextRequest, context: { params: Promise<P> }) => {
    try {
      const user = await currentUser();
      if (!user) throw new HttpError(401, 'Non connecté.', 'unauthenticated');
      if (opts.admin && !user.isAdmin) throw new HttpError(403, 'Réservé à l’administrateur.', 'forbidden');
      checkOrigin(req);
      const out = await fn({ req, params: (await context.params) ?? ({} as P), user });
      if (out instanceof Response) return out;
      return Response.json(out ?? { ok: true });
    } catch (e) {
      return errorResponse(e);
    }
  };
}

/** Protection CSRF : une requête qui modifie doit venir de notre propre origine. */
function checkOrigin(req: NextRequest) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return;
  const origin = req.headers.get('origin');
  if (!origin) return; // appels serveur à serveur, jetons d'API
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  if (new URL(origin).host !== host) throw new HttpError(403, 'Origine refusée.', 'csrf');
}

export function errorResponse(e: unknown) {
  if (e instanceof HttpError) return Response.json({ error: e.message, code: e.code }, { status: e.status });
  if (e instanceof StudioError) return Response.json({ error: e.message, code: e.code, action: e.action }, { status: e.status });
  if (e instanceof ProviderError)
    return Response.json({ error: e.message, code: e.code, retryable: e.retryable, ...(e.code === 'not_configured' ? { action: { label: 'Configurer un provider', href: '/settings/providers' } } : {}) }, { status: e.code === 'auth' || e.code === 'not_configured' ? 424 : 502 });
  if (e instanceof ZodError)
    return Response.json({ error: e.issues.map((i) => `${i.path.join('.') || 'requête'} : ${i.message}`).join(' · '), code: 'invalid', issues: e.issues }, { status: 400 });
  const prismaCode = (e as { code?: string })?.code;
  if (prismaCode === 'P2025') return Response.json({ error: 'Élément introuvable.', code: 'not_found' }, { status: 404 });
  if (prismaCode === 'P2002') return Response.json({ error: 'Cet identifiant existe déjà.', code: 'conflict' }, { status: 409 });
  console.error(e);
  return Response.json({ error: 'Erreur interne. Le détail est dans les logs du serveur.', code: 'internal' }, { status: 500 });
}

export async function body<T>(req: NextRequest, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new HttpError(400, 'Corps JSON invalide.', 'invalid');
  }
  return schema.parse(raw);
}

/** Vérifie l'accès au projet et renvoie le rôle. */
export const project = (projectId: string, user: CurrentUser, action: Action = 'project.read') => requireProject(projectId, user.id, action);

/** Limite simple par fenêtre fixe, dans Redis. */
export async function rateLimit(key: string, limit: number, windowSec: number) {
  const k = `regie:rl:${key}:${Math.floor(Date.now() / 1000 / windowSec)}`;
  const n = await redis().incr(k);
  if (n === 1) await redis().expire(k, windowSec);
  if (n > limit) throw new HttpError(429, `Trop de requêtes : ${limit} par ${windowSec >= 60 ? `${windowSec / 60} min` : `${windowSec} s`}.`, 'rate_limited');
}

export async function audit(userId: string, action: string, entityType?: string, entityId?: string, meta?: object) {
  await prisma.auditLog.create({ data: { userId, action, entityType, entityId, meta: meta as any } }).catch(() => {});
}
