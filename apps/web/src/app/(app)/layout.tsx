import { redirect } from 'next/navigation';
import { CommandPalette } from '@/components/app/command-palette';
import { Crumbs } from '@/components/app/crumbs';
import { TopBar } from '@/components/app/top-bar';
import { currentUser } from '@/lib/auth';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect('/login');
  return (
    <div className="min-h-screen">
      <TopBar user={{ id: user.id, name: user.name, email: user.email, isAdmin: user.isAdmin }}>
        <Crumbs />
      </TopBar>
      <CommandPalette />
      {children}
    </div>
  );
}
