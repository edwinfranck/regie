'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { PageHeader, Panel } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { get, patch, toastError } from '@/lib/client';
import { cn, fmtBytes, fmtDate, fmtUsd } from '@/lib/utils';

interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  isAdmin: boolean;
  disabled: boolean;
  createdAt: string;
  _count: { ownedProjects: number; generations: number };
}
interface AdminData {
  users: AdminUser[];
  projects: number;
  storage: { bytes: number; files: number };
  jobs: Record<'waiting' | 'active' | 'completed' | 'failed' | 'delayed', number> | null;
  errors: { id: string; error: string | null; errorCode: string | null; createdAt: string; provider: { name: string } | null; model: { label: string } | null; project: { title: string } | null }[];
  cost30d: number;
  logs: { id: string; action: string; entityType: string | null; entityId: string | null; createdAt: string; user: { email: string } | null }[];
  providers: number;
}

const JOBS: [keyof NonNullable<AdminData['jobs']>, string][] = [
  ['waiting', 'En attente'],
  ['active', 'En cours'],
  ['delayed', 'Différés'],
  ['completed', 'Terminés'],
  ['failed', 'Échoués'],
];

export function AdminDashboard({ currentUserId }: { currentUserId: string }) {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery<AdminData>({ queryKey: ['admin'], queryFn: () => get('/api/admin'), refetchInterval: 15_000 });

  const setUser = useMutation({
    mutationFn: (p: { userId: string; isAdmin?: boolean; disabled?: boolean }) => patch('/api/admin/users', p),
    onMutate: ({ userId, ...p }) => qc.setQueryData<AdminData>(['admin'], (d) => (d ? { ...d, users: d.users.map((u) => (u.id === userId ? { ...u, ...p } : u)) } : d)),
    onError: (e) => toastError(e),
    onSettled: () => qc.invalidateQueries({ queryKey: ['admin'] }),
  });

  return (
    <div>
      <PageHeader
        title="Administration"
        description="L’état de l’instance : comptes, stockage, file de génération, coûts et journal."
        actions={
          <Button variant="outline" asChild>
            <Link href="/settings/providers">Providers IA</Link>
          </Button>
        }
      />
      <div className="space-y-6 p-8">
        {error ? (
          <p className="text-destructive">{(error as Error).message}</p>
        ) : isLoading || !data ? (
          <Skeleton className="h-96" />
        ) : (
          <>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <Tile label="Utilisateurs" value={String(data.users.length)} hint={`${data.users.filter((u) => u.disabled).length} désactivé(s)`} />
              <Tile label="Projets" value={String(data.projects)} />
              <Tile label="Stockage" value={fmtBytes(data.storage.bytes)} hint={`${data.storage.files.toLocaleString('fr-FR')} fichiers`} />
              <Tile label="Coûts sur 30 jours" value={fmtUsd(data.cost30d)} />
              <Tile label="Providers" value={String(data.providers)} hint={<Link href="/settings/providers" className="underline underline-offset-4">Gérer</Link>} />
            </div>

            <Panel title="File de génération" description="Compteurs de la file BullMQ, actualisés toutes les 15 secondes.">
              {data.jobs ? (
                <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                  {JOBS.map(([k, label]) => (
                    <div key={k}>
                      <p className="text-sm text-muted-foreground">{label}</p>
                      <p className={cn('text-xl font-semibold tabular-nums', k === 'failed' && data.jobs![k] > 0 && 'text-destructive')}>{data.jobs![k].toLocaleString('fr-FR')}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-warning">File injoignable : Redis ne répond pas. Les générations ne partiront pas tant qu’il n’est pas relancé.</p>
              )}
            </Panel>

            <Panel title="Utilisateurs">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Compte</TableHead>
                    <TableHead>Inscrit</TableHead>
                    <TableHead className="text-right">Projets</TableHead>
                    <TableHead className="text-right">Générations</TableHead>
                    <TableHead>Administrateur</TableHead>
                    <TableHead>Actif</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.users.map((u) => {
                    const self = u.id === currentUserId;
                    return (
                      <TableRow key={u.id} className={cn(u.disabled && 'text-muted-foreground')}>
                        <TableCell>
                          <p>{u.name || u.email}</p>
                          {u.name && <p className="text-xs text-muted-foreground">{u.email}</p>}
                        </TableCell>
                        <TableCell>{fmtDate(u.createdAt)}</TableCell>
                        <TableCell className="text-right tabular-nums">{u._count.ownedProjects}</TableCell>
                        <TableCell className="text-right tabular-nums">{u._count.generations}</TableCell>
                        <TableCell>
                          <Switch checked={u.isAdmin} disabled={self} onCheckedChange={(v) => setUser.mutate({ userId: u.id, isAdmin: v })} aria-label="Administrateur" title={self ? 'Vous ne pouvez pas retirer vos propres droits.' : undefined} />
                        </TableCell>
                        <TableCell>
                          <Switch checked={!u.disabled} disabled={self} onCheckedChange={(v) => setUser.mutate({ userId: u.id, disabled: !v })} aria-label="Compte actif" />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Panel>

            <div className="grid gap-6 xl:grid-cols-2">
              <Panel title="Erreurs de génération récentes" description="Les 30 derniers échecs sur 30 jours.">
                {data.errors.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucun échec sur la période.</p>
                ) : (
                  <ul className="divide-y">
                    {data.errors.map((e) => (
                      <li key={e.id} className="space-y-0.5 py-2 text-sm first:pt-0">
                        <p className="text-muted-foreground">
                          {fmtDate(e.createdAt)} · {e.provider?.name ?? 'provider ?'} · {e.model?.label ?? 'modèle ?'} · {e.project?.title ?? 'projet supprimé'}
                        </p>
                        <p className="text-destructive">
                          {e.errorCode && <span className="mr-1.5 font-mono text-xs">{e.errorCode}</span>}
                          {e.error ?? 'Erreur sans message.'}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>

              <Panel title="Journal d’audit" description="Les 50 dernières actions sensibles.">
                {data.logs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Journal vide.</p>
                ) : (
                  <ul className="max-h-[480px] divide-y overflow-y-auto">
                    {data.logs.map((l) => (
                      <li key={l.id} className="flex items-baseline justify-between gap-3 py-1.5 text-sm first:pt-0">
                        <span className="min-w-0 truncate">
                          <span className="font-mono text-[13px]">{l.action}</span>
                          {l.entityType && <span className="text-muted-foreground"> · {l.entityType}</span>}
                          <span className="text-muted-foreground"> · {l.user?.email ?? 'compte supprimé'}</span>
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground">{fmtDate(l.createdAt)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Tile({ label, value, hint }: { label: string; value: string; hint?: React.ReactNode }) {
  return (
    <div className="rounded-md border bg-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
