'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { loginAction } from '../login/actions';

export default function RegisterPage() {
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  return (
    <div className="w-full max-w-sm space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Créer un compte</h1>
        <p className="text-muted-foreground">Le premier compte de l’instance en devient l’administrateur.</p>
      </div>
      <form
        className="space-y-4"
        action={async (fd) => {
          setPending(true);
          setError(undefined);
          const res = await fetch('/api/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(fd)) });
          if (!res.ok) {
            setError((await res.json()).error);
            setPending(false);
            return;
          }
          await loginAction(fd, '/new');
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="name">Nom</Label>
          <Input id="name" name="name" required autoFocus autoComplete="name" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required autoComplete="email" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Mot de passe</Label>
          <Input id="password" name="password" type="password" required minLength={10} autoComplete="new-password" />
          <p className="text-xs text-muted-foreground">10 caractères minimum.</p>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button className="h-10 w-full" disabled={pending}>
          {pending ? 'Création…' : 'Créer le compte'}
        </Button>
      </form>
      <p className="text-sm text-muted-foreground">
        Déjà inscrit ?{' '}
        <Link href="/login" className="font-medium text-foreground underline underline-offset-4">
          Se connecter
        </Link>
      </p>
    </div>
  );
}
