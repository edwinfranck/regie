import { PageHeader } from '@/components/common/page-header';
import { AdminDashboard } from '@/components/settings/admin-dashboard';
import { currentUser } from '@/lib/auth';

export default async function AdminPage() {
  const user = await currentUser();
  if (!user?.isAdmin)
    return (
      <div>
        <PageHeader title="Administration" />
        <p className="p-8 text-muted-foreground">Cette page est réservée à l’administrateur de l’instance.</p>
      </div>
    );
  return <AdminDashboard currentUserId={user.id} />;
}
