import { prisma } from '@regie/db';
import { personalWorkspace } from '@regie/studio';
import bcrypt from 'bcryptjs';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { errorResponse, HttpError, rateLimit } from '@/lib/api';
import { shouldBeAdmin } from '@/lib/auth';

const schema = z.object({
  name: z.string().trim().min(1, 'Votre nom.').max(120),
  email: z.email('Email invalide.').max(200),
  password: z.string().min(10, '10 caractères minimum.').max(200),
});

export async function POST(req: NextRequest) {
  try {
    await rateLimit(`register:${req.headers.get('x-forwarded-for') ?? 'local'}`, 10, 3600);
    const data = schema.parse(await req.json());
    const email = data.email.toLowerCase();
    if (await prisma.user.findUnique({ where: { email } })) throw new HttpError(409, 'Un compte existe déjà avec cet email.', 'conflict');
    const user = await prisma.user.create({
      data: { email, name: data.name, passwordHash: await bcrypt.hash(data.password, 12), isAdmin: await shouldBeAdmin(email) },
    });
    await personalWorkspace(user.id);
    await prisma.auditLog.create({ data: { userId: user.id, action: 'auth.register' } });
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
