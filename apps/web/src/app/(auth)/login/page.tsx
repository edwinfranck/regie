import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth, signIn } from '@/lib/auth';
import { LoginForm } from './login-form';

export const metadata = { title: 'Connexion' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  if (await auth()) redirect(next || '/');
  const oauth = [...(process.env.AUTH_GOOGLE_ID ? [{ id: 'google', name: 'Google' }] : []), ...(process.env.AUTH_GITHUB_ID ? [{ id: 'github', name: 'GitHub' }] : [])];
  return (
    <div className="w-full max-w-sm space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Connexion</h1>
        <p className="text-muted-foreground">Retrouvez vos projets.</p>
      </div>
      <LoginForm next={next} initialError={error ? 'Connexion refusée. Vérifiez vos identifiants.' : undefined} />
      {oauth.length > 0 && (
        <div className="space-y-2">
          <div className="text-center text-sm text-muted-foreground">ou</div>
          {oauth.map((p) => (
            <form
              key={p.id}
              action={async () => {
                'use server';
                await signIn(p.id, { redirectTo: next || '/' });
              }}
            >
              <button className="h-10 w-full rounded-md border text-sm font-medium hover:bg-accent">Continuer avec {p.name}</button>
            </form>
          ))}
        </div>
      )}
      <p className="text-sm text-muted-foreground">
        Pas encore de compte ?{' '}
        <Link href="/register" className="font-medium text-foreground underline underline-offset-4">
          Créer un compte
        </Link>
      </p>
    </div>
  );
}
