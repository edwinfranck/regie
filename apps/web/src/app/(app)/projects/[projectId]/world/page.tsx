'use client';

import { WORLD_SECTIONS } from '@regie/core';
import { useQueryClient } from '@tanstack/react-query';
import { Building2, Coins, Cog, Flame, Gavel, Info, KeyRound, Landmark, type LucideIcon, Map as MapIcon, ScrollText, Ship, Shirt, Users } from 'lucide-react';
import { IconLabel } from '@/components/common/icon-label';
import { RichField } from '@/components/common/rich-field';
import { PageHeader } from '@/components/common/page-header';
import { RevisionsButton } from '@/components/project/revisions';
import { Skeleton } from '@/components/ui/skeleton';
import { useAutosave } from '@/hooks/use-autosave';
import { useProjectData, useProjectId } from '@/hooks/use-project';
import { put } from '@/lib/client';

const SECTIONS = Object.entries(WORLD_SECTIONS) as [keyof typeof WORLD_SECTIONS, { label: string; hint: string }][];


const WORLD_ICON: Record<string, LucideIcon> = { rules: ScrollText, geography: MapIcon, history: Landmark, culture: Users, politics: Gavel, technology: Cog, religion: Flame, economy: Coins, architecture: Building2, costumes: Shirt, vehicles: Ship, objects: KeyRound };

export default function WorldPage() {
  const projectId = useProjectId();
  const qc = useQueryClient();
  const key = ['project', projectId, 'world'];
  const { data: world, isLoading } = useProjectData('world');

  const { queue } = useAutosave<{ sections: Record<string, string> }>(async (p) => {
    if (!p.sections) return;
    const row = await put(`/api/projects/${projectId}/world`, { sections: p.sections });
    qc.setQueryData(key, (old: any) => ({ ...old, id: row.id, version: row.version, updatedAt: row.updatedAt }));
  });
  // Les sections partent toujours au complet : le PUT remplace l'objet entier.
  const setSection = (k: string, v: string) => {
    const sections = { ...((qc.getQueryData<any>(key)?.sections as Record<string, string>) ?? {}), [k]: v };
    qc.setQueryData(key, (old: any) => ({ ...old, sections }));
    queue({ sections });
  };

  if (isLoading || !world)
    return (
      <div className="space-y-4 p-8">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-20 max-w-4xl" />
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-36" />
          ))}
        </div>
      </div>
    );

  const sections: Record<string, string> = world.sections ?? {};
  const filled = SECTIONS.filter(([k]) => sections[k]?.trim()).length;

  return (
    <div>
      <PageHeader
        title="Monde"
        description={`Les règles de l’univers : ce qui est possible, ce qui ne l’est pas. ${filled} section${filled > 1 ? 's' : ''} remplie${filled > 1 ? 's' : ''} sur ${SECTIONS.length}.`}
        actions={<RevisionsButton entityType="world" entityId={world.id} onRestored={() => qc.invalidateQueries({ queryKey: key })} />}
      />
      <div className="space-y-6 p-8">
        <div className="flex max-w-4xl gap-3 rounded-md border bg-secondary/40 px-4 py-3 text-sm">
          <Info className="mt-0.5 size-4 shrink-0 text-info" />
          <p>
            Ces règles entrent dans le contexte de <span className="font-medium">toutes les tâches IA</span> du projet : concept, fiches, temps forts, scénario, découpage, assistant. Aucune n’est obligatoire ; un récit réaliste n’en remplira que deux ou trois. Soyez bref et affirmatif : l’IA suit ce qui est écrit ici.
          </p>
        </div>
        <div className="grid gap-x-6 gap-y-5 lg:grid-cols-2">
          {SECTIONS.map(([k, s]) => (
            <RichField key={k} label={WORLD_ICON[k] ? <IconLabel icon={WORLD_ICON[k]}>{s.label}</IconLabel> : s.label} hint={s.hint} value={sections[k]} onChange={(v) => setSection(k, v)} minHeight={k === 'rules' ? 130 : 90} className={k === 'rules' ? 'lg:col-span-2' : undefined} />
          ))}
        </div>
      </div>
    </div>
  );
}
