'use client';

import { ROLES, type RoleName } from '@regie/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UserMinus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Choice } from '@/components/common/choice';
import { Panel } from '@/components/common/page-header';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useProjectId } from '@/hooks/use-project';
import { del, get, patch, post, toastError } from '@/lib/client';
import { ROLE_HINTS, ROLE_LABELS } from './shared';

interface Person {
  id: string;
  email: string;
  name: string | null;
}
interface MembersData {
  owner: Person;
  members: { role: RoleName; createdAt: string; user: Person }[];
  role: RoleName;
  canAdmin: boolean;
}

const ASSIGNABLE = ROLES.filter((r) => r !== 'OWNER').map((r) => ({ value: r, label: ROLE_LABELS[r] }));
const initials = (p: Person) => (p.name || p.email).slice(0, 1).toUpperCase();

export function MembersSection() {
  const projectId = useProjectId();
  const qc = useQueryClient();
  const key = ['project', projectId, 'members'];
  const base = `/api/projects/${projectId}/members`;
  const { data, isLoading } = useQuery<MembersData>({ queryKey: key, queryFn: () => get(base) });
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<RoleName>('WRITER');
  const refresh = () => qc.invalidateQueries({ queryKey: key });

  const add = useMutation({
    mutationFn: () => post(base, { email: email.trim(), role }),
    onSuccess: () => {
      toast.success(`${email.trim()} ajouté au projet`);
      setEmail('');
      refresh();
    },
    onError: (e) => toastError(e),
  });
  const change = useMutation({ mutationFn: (p: { userId: string; role: string }) => patch(base, p), onSuccess: refresh, onError: (e) => toastError(e) });
  const remove = useMutation({ mutationFn: (userId: string) => del(`${base}?userId=${encodeURIComponent(userId)}`), onSuccess: refresh, onError: (e) => toastError(e) });

  if (isLoading || !data) return <Skeleton className="h-48" />;
  return (
    <div className="space-y-6">
      <Panel title="Membres du projet" description="Le rôle sur le projet s’ajoute à celui dans l’espace de travail : le plus élevé l’emporte.">
        <ul className="divide-y">
          <Row person={data.owner}>
            <span className="text-sm">{ROLE_LABELS.OWNER}</span>
          </Row>
          {data.members.map((m) => (
            <Row key={m.user.id} person={m.user}>
              {data.canAdmin ? (
                <div className="flex items-center gap-2">
                  <Choice value={m.role} onChange={(v) => v && change.mutate({ userId: m.user.id, role: v })} options={ASSIGNABLE} className="w-56" />
                  <Button variant="ghost" size="icon-sm" onClick={() => remove.mutate(m.user.id)} aria-label={`Retirer ${m.user.email}`} className="text-muted-foreground hover:text-destructive">
                    <UserMinus />
                  </Button>
                </div>
              ) : (
                <span className="text-sm">{ROLE_LABELS[m.role]}</span>
              )}
            </Row>
          ))}
        </ul>
        {data.members.length === 0 && <p className="pt-3 text-sm text-muted-foreground">Personne d’autre sur ce projet pour l’instant.</p>}
      </Panel>

      {data.canAdmin ? (
        <Panel title="Inviter quelqu’un" description="La personne doit déjà avoir un compte sur cette instance.">
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (email.trim()) add.mutate();
            }}
          >
            <div className="min-w-64 flex-1 space-y-1.5">
              <Label htmlFor="member-email">Email</Label>
              <Input id="member-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="prenom@studio.fr" />
            </div>
            <Choice label="Rôle" value={role} onChange={(v) => v && setRole(v as RoleName)} options={ASSIGNABLE} className="w-64" />
            <Button type="submit" disabled={!email.trim() || add.isPending}>
              Ajouter
            </Button>
          </form>
          <p className="mt-2 text-xs text-muted-foreground">
            {ROLE_LABELS[role]} : {ROLE_HINTS[role]}.
          </p>
        </Panel>
      ) : (
        <p className="text-sm text-muted-foreground">Votre rôle ({ROLE_LABELS[data.role]}) ne permet pas de gérer les membres.</p>
      )}
    </div>
  );
}

function Row({ person, children }: { person: Person; children: React.ReactNode }) {
  return (
    <li className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar className="size-8">
          <AvatarFallback className="text-sm">{initials(person)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate">{person.name || person.email}</p>
          {person.name && <p className="truncate text-xs text-muted-foreground">{person.email}</p>}
        </div>
      </div>
      {children}
    </li>
  );
}
