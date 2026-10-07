import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';

// L'espace de montage vit hors du shell de l'application : plein écran,
// sans barre du haut ni barre latérale.
export default async function EditorLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect('/login');
  return children;
}
