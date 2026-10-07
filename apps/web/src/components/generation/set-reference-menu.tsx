'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Pin } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useBible, useProjectId } from '@/hooks/use-project';
import { patch, toastError } from '@/lib/client';

const GROUPS = [
  { kind: 'characters', ref: 'character', label: 'Personnages' },
  { kind: 'locations', ref: 'location', label: 'Lieux' },
  { kind: 'props', ref: 'prop', label: 'Objets et costumes' },
  { kind: 'styles', ref: 'style', label: 'Styles' },
] as const;

/**
 * Fait d'un asset la référence d'une entité de la bible : elle sera ensuite
 * chargée dans chaque plan où l'entité apparaît. L'asset rejoint aussi la
 * bibliothèque de références.
 */
export function SetReferenceMenu({ assetId, size = 'xs' }: { assetId: string; size?: 'xs' | 'sm' }) {
  const projectId = useProjectId();
  const qc = useQueryClient();
  const lists = {
    characters: useBible('characters').data ?? [],
    locations: useBible('locations').data ?? [],
    props: useBible('props').data ?? [],
    styles: useBible('styles').data ?? [],
  };
  const empty = GROUPS.every((g) => !lists[g.kind].length);

  async function apply(kind: (typeof GROUPS)[number], entity: { id: string; name: string; code?: string }) {
    try {
      await patch(`/api/projects/${projectId}/bible/${kind.kind}/${entity.id}`, { refAssetId: assetId });
      await patch(`/api/projects/${projectId}/assets/${assetId}`, { isReference: true, referenceKind: kind.ref }).catch(() => {});
      toast.success(`Référence de ${entity.name}`, { description: 'Elle sera chargée dans chaque plan où cet élément apparaît.' });
      qc.invalidateQueries({ queryKey: ['project', projectId] });
      qc.invalidateQueries({ queryKey: ['assets'] });
    } catch (e) {
      toastError(e);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size={size}>
          <Pin /> Définir comme référence de…
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-80 w-64 overflow-y-auto">
        {empty && <p className="px-2 py-1.5 text-sm text-muted-foreground">La bible est vide : créez d’abord un personnage ou un lieu.</p>}
        {GROUPS.filter((g) => lists[g.kind].length).map((g, i) => (
          <DropdownMenuGroup key={g.kind}>
            {i > 0 && <DropdownMenuSeparator />}
            <DropdownMenuLabel>{g.label}</DropdownMenuLabel>
            {lists[g.kind].map((e: any) => (
              <DropdownMenuItem key={e.id} onSelect={() => apply(g, e)}>
                {e.code && <span className="font-mono text-xs text-muted-foreground">{e.code}</span>}
                <span className="truncate">{e.name}</span>
                {e.refAssetId === assetId && <span className="ml-auto text-xs text-muted-foreground">actuelle</span>}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
