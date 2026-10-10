import type { NextRequest } from 'next/server';
import { DEMO_MODE, signIn } from '@/lib/auth';

// Mode démo : connecte le visiteur en invité anonyme puis le renvoie où il
// voulait aller. Appelé par le middleware quand une session manque.
export async function GET(req: NextRequest) {
  if (!DEMO_MODE) return new Response('Mode démo désactivé.', { status: 404 });
  const next = req.nextUrl.searchParams.get('next');
  const to = next && next.startsWith('/') ? next : '/';
  // signIn pose le cookie de session et lève une redirection vers `to`.
  await signIn('guest', { redirectTo: to });
}
