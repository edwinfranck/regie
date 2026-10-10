import { redirect } from 'next/navigation';
import { CommandPalette } from '@/components/app/command-palette';
import { Crumbs } from '@/components/app/crumbs';
import { DemoBanner } from '@/components/app/demo-banner';
import { TopBar } from '@/components/app/top-bar';
import { currentUser, DEMO_MODE } from '@/lib/auth';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect(DEMO_MODE ? '/api/demo/start' : '/login');
  return (
    <div className="min-h-screen">
      {DEMO_MODE && user.isGuest && <DemoBanner />}
      <TopBar user={{ id: user.id, name: user.name, email: user.email, isAdmin: user.isAdmin }}>
        <Crumbs />
      </TopBar>
      <CommandPalette />
      {children}
    </div>
  );
}
