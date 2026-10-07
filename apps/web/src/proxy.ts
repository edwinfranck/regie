import NextAuth from 'next-auth';
import { NextResponse } from 'next/server';
import { authConfig } from '@/lib/auth.config';

// Garde d'entrée : sans session, toute page renvoie vers /login et toute API
// vers un 401. Les droits fins (rôle sur le projet) sont vérifiés plus loin.
const { auth } = NextAuth(authConfig);

const PUBLIC = ['/login', '/register', '/api/auth', '/api/register', '/api/health'];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((p) => pathname.startsWith(p))) return NextResponse.next();
  if (req.auth) return NextResponse.next();
  if (pathname.startsWith('/api/')) return NextResponse.json({ error: 'Non connecté.', code: 'unauthenticated' }, { status: 401 });
  const url = new URL('/login', req.url);
  if (pathname !== '/') url.searchParams.set('next', pathname);
  return NextResponse.redirect(url);
});

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg).*)'] };
