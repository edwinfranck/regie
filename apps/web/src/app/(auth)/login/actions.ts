'use server';

import { AuthError } from 'next-auth';
import { signIn } from '@/lib/auth';

export async function loginAction(fd: FormData, next?: string) {
  try {
    await signIn('credentials', { email: fd.get('email'), password: fd.get('password'), redirectTo: next && next.startsWith('/') ? next : '/' });
  } catch (e) {
    if (e instanceof AuthError) return { error: 'Email ou mot de passe incorrect.' };
    throw e; // la redirection de réussite passe par une exception
  }
}
