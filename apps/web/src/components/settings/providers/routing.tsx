'use client';

import { ROUTING_TASKS } from '@regie/core';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, X } from 'lucide-react';
import { Choice } from '@/components/common/choice';
import { Button } from '@/components/ui/button';
import { put, toastError } from '@/lib/client';
import { cn } from '@/lib/utils';
import { type ModelRow, type ProviderRow, type ProvidersData, type RouteRow, TASK_CAPABILITY } from './shared';

type Owned = ModelRow & { provider: ProviderRow };

/**
 * Le routage AUTO : pour chaque tâche, l'ordre de préférence des modèles.
 * L'admin règle l'instance ; un espace de travail peut la surcharger.
 */
export function RoutingPanel({ data, canEdit }: { data: ProvidersData; canEdit: boolean }) {
  const qc = useQueryClient();
  const models: Owned[] = data.providers.flatMap((p) => p.models.map((m) => ({ ...m, provider: p })));
  const byId = new Map(models.map((m) => [m.id, m]));
  // L'admin voit et règle les routes de l'instance ; les autres, celles de leur espace (sinon l'instance, en lecture).
  const own = (task: string) => {
    const rows = data.routes.filter((r) => r.task === task);
    const ws = rows.filter((r) => r.workspaceId !== null);
    return (data.isAdmin ? rows.filter((r) => r.workspaceId === null) : ws.length ? ws : rows.filter((r) => r.workspaceId === null)).sort((a, b) => a.priority - b.priority).map((r) => r.modelId);
  };

  const save = useMutation({
    mutationFn: ({ task, modelIds }: { task: string; modelIds: string[] }) => put<RouteRow[]>('/api/routes', { task, modelIds }),
    onMutate: ({ task, modelIds }) =>
      qc.setQueryData<ProvidersData>(['providers'], (d) => {
        if (!d) return d;
        const scope = d.isAdmin ? null : 'pending';
        const keep = d.routes.filter((r) => !(r.task === task && (d.isAdmin ? r.workspaceId === null : r.workspaceId !== null)));
        return { ...d, routes: [...keep, ...modelIds.map((modelId, priority) => ({ id: `tmp-${modelId}`, task, modelId, priority, workspaceId: scope }))] };
      }),
    onSettled: () => qc.invalidateQueries({ queryKey: ['providers'] }),
    onError: (e) => toastError(e, 'Routage non enregistré'),
  });

  return (
    <div className="space-y-4">
      <p className="max-w-3xl text-sm text-muted-foreground">
        En mode AUTO, régie essaie ces modèles dans l’ordre. Sans route pour une tâche, il note chaque modèle disponible selon la qualité, le coût et la vitesse, et prend le meilleur. L’utilisateur peut toujours forcer un modèle précis au moment de générer.
      </p>
      <div className="grid gap-3 lg:grid-cols-2">
        {Object.entries(ROUTING_TASKS).map(([task, label]) => {
          const ids = own(task);
          const cap = TASK_CAPABILITY[task];
          const available = models.filter((m) => m.capability === cap && !ids.includes(m.id));
          const set = (modelIds: string[]) => save.mutate({ task, modelIds });
          const move = (i: number, d: number) => {
            const next = [...ids];
            [next[i], next[i + d]] = [next[i + d], next[i]];
            set(next);
          };
          return (
            <div key={task} className="space-y-3 rounded-md border bg-card p-4">
              <p className="font-medium">{label}</p>
              {ids.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune route : choix automatique par note.</p>
              ) : (
                <ol className="space-y-1.5">
                  {ids.map((id, i) => {
                    const m = byId.get(id);
                    const warn = !m ? 'modèle supprimé' : !m.enabled || !m.provider.enabled ? 'désactivé' : !m.provider.configured ? 'provider non configuré' : null;
                    return (
                      <li key={id} className="flex items-center gap-2 rounded-sm border px-2 py-1.5">
                        <span className="w-5 text-right font-mono text-xs text-muted-foreground">{i + 1}</span>
                        <div className="min-w-0 flex-1">
                          <p className={cn('truncate text-sm', warn && 'text-muted-foreground')}>{m ? m.label : id}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {m?.provider.name}
                            {warn && <span className="text-warning"> · {warn}</span>}
                          </p>
                        </div>
                        {canEdit && (
                          <div className="flex shrink-0">
                            <Button variant="ghost" size="icon-xs" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Monter">
                              <ArrowUp />
                            </Button>
                            <Button variant="ghost" size="icon-xs" disabled={i === ids.length - 1} onClick={() => move(i, 1)} aria-label="Descendre">
                              <ArrowDown />
                            </Button>
                            <Button variant="ghost" size="icon-xs" onClick={() => set(ids.filter((x) => x !== id))} aria-label="Retirer">
                              <X />
                            </Button>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ol>
              )}
              {canEdit &&
                (available.length ? (
                  <Choice key={ids.join(',')} value={null} onChange={(v) => v && set([...ids, v])} placeholder="Ajouter un modèle à la suite…" options={available.map((m) => ({ value: m.id, label: m.label, hint: m.provider.name }))} />
                ) : (
                  <p className="text-xs text-muted-foreground">{models.some((m) => m.capability === cap) ? 'Tous les modèles de cette capacité sont déjà dans la liste.' : 'Aucun modèle de cette capacité n’est déclaré.'}</p>
                ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
