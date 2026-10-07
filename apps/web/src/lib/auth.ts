import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from '@regie/db';
import bcrypt from 'bcryptjs';
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { z } from 'zod';
import { authConfig } from './auth.config';

// Authentification. Tout ce qui touche à Auth.js est confiné ici et dans
// auth.config.ts : changer pour Better Auth ou Clerk ne demande que de
// réécrire ces deux fichiers et `currentUser()`.

const credentials = z.object({ email: z.email(), password: z.string().min(1) });

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma as any),
  providers: [
    ...authConfig.providers,
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const parsed = credentials.safeParse(raw);
        if (!parsed.success) return null;
        const user = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
        if (!user?.passwordHash || user.disabled) return null;
        if (!(await bcrypt.compare(parsed.data.password, user.passwordHash))) return null;
        await prisma.auditLog.create({ data: { userId: user.id, action: 'auth.login' } });
        return { id: user.id, email: user.email, name: user.name, image: user.image };
      },
    }),
  ],
  events: {
    // Compte créé par OAuth : même règle d'administration que l'inscription.
    async createUser({ user }) {
      if (user.id && (await shouldBeAdmin(user.email ?? ''))) await prisma.user.update({ where: { id: user.id }, data: { isAdmin: true } });
    },
  },
});

/** Le premier compte de l'instance est administrateur, ainsi que ADMIN_EMAILS. */
export async function shouldBeAdmin(email: string) {
  const admins = (process.env.ADMIN_EMAILS ?? '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
  if (admins.includes(email.toLowerCase())) return true;
  return (await prisma.user.count({ where: { isAdmin: true } })) === 0;
}

export async function currentUser() {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;
  const user = await prisma.user.findUnique({ where: { id }, select: { id: true, email: true, name: true, image: true, isAdmin: true, disabled: true } });
  return user && !user.disabled ? user : null;
}
export type CurrentUser = NonNullable<Awaited<ReturnType<typeof currentUser>>>;
