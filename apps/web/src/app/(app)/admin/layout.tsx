import { SettingsNav } from '@/components/settings/settings-nav';
import { currentUser } from '@/lib/auth';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  return (
    <div className="flex">
      <aside className="sticky top-12 h-[calc(100vh-3rem)] w-56 shrink-0 border-r bg-sidebar">
        <SettingsNav isAdmin={!!user?.isAdmin} />
      </aside>
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
