'use client';

import { ANGLES, LENSES, MOVES, SIZES, TRANSITIONS } from '@regie/core';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useProjectId } from '@/hooks/use-project';
import { del, get, post, toastError } from '@/lib/client';
import { cameraLabel } from './shot-meta';

export interface ShotDraft {
  description?: string;
  action?: string;
  size?: string | null;
  angle?: string | null;
  lens?: string | null;
  move?: string | null;
  durationSec?: number;
  dialogue?: string | null;
  characters?: string[];
  composition?: string | null;
  transition?: string | null;
  note?: string | null;
}

// Le modèle peut sortir du vocabulaire : ce qui n'existe pas dans la
// bibliothèque caméra est laissé vide plutôt que refusé par l'API.
const known = (table: object, v?: string | null) => (v && v in table ? v : null);
const clean = (d: ShotDraft) => ({
  description: (d.description ?? '').slice(0, 4000),
  action: (d.action ?? '').slice(0, 4000),
  size: known(SIZES, d.size),
  angle: known(ANGLES, d.angle),
  lens: d.lens && (LENSES as readonly string[]).includes(d.lens) ? d.lens : d.lens?.slice(0, 40) || null,
  move: known(MOVES, d.move),
  transition: known(TRANSITIONS, d.transition),
  durationSec: Math.min(600, Math.max(0.5, Number(d.durationSec) || 3)),
  dialogue: d.dialogue || null,
  composition: d.composition || null,
  note: d.note || null,
  characters: (d.characters ?? []).filter((c) => typeof c === 'string'),
});

/**
 * Découpage proposé par l'IA : l'auteur coche ce qu'il garde, puis ajoute.
 * Les personnages sont des codes (CH1) que l'API résout.
 */
export function ShotDrafts({ sceneId, drafts, replace, onAdded }: { sceneId: string; drafts: ShotDraft[]; replace?: boolean; onAdded?: () => void }) {
  const projectId = useProjectId();
  const qc = useQueryClient();
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  useEffect(() => setPicked(new Set(drafts.map((_, i) => i))), [drafts]);

  const toggle = (i: number) => setPicked((p) => {
    const n = new Set(p);
    if (n.has(i)) n.delete(i);
    else n.add(i);
    return n;
  });

  async function add() {
    const shots = drafts.filter((_, i) => picked.has(i)).map(clean);
    if (!shots.length) return;
    setBusy(true);
    try {
      // Un plan par requête : la forme groupée {sceneId, shots} de POST /shots
      // est aujourd'hui capturée par le schéma d'un plan seul (voir rapport).
      if (replace) {
        const existing = await get<{ id: string }[]>(`/api/projects/${projectId}/shots?sceneId=${sceneId}`);
        for (const s of existing) await del(`/api/projects/${projectId}/shots/${s.id}`);
      }
      for (const s of shots) await post(`/api/projects/${projectId}/shots`, { sceneId, ...s });
      toast.success(`${shots.length} plan${shots.length > 1 ? 's' : ''} ajouté${shots.length > 1 ? 's' : ''}`);
      qc.invalidateQueries({ queryKey: ['project', projectId] });
      onAdded?.();
    } catch (e) {
      toastError(e, 'Ajout impossible');
    } finally {
      setBusy(false);
    }
  }

  if (!drafts.length) return <p className="text-sm text-muted-foreground">Aucun plan proposé.</p>;
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox checked={picked.size === drafts.length} onCheckedChange={(v) => setPicked(v ? new Set(drafts.map((_, i) => i)) : new Set())} aria-label="Tout cocher" />
              </TableHead>
              <TableHead className="w-10">#</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Cadre</TableHead>
              <TableHead className="w-16 text-right">Durée</TableHead>
              <TableHead>Personnages</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {drafts.map((d, i) => (
              <TableRow key={i} className="align-top" onClick={() => toggle(i)}>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Checkbox checked={picked.has(i)} onCheckedChange={() => toggle(i)} aria-label={`Plan ${i + 1}`} />
                </TableCell>
                <TableCell className="text-muted-foreground tabular-nums">{i + 1}</TableCell>
                <TableCell className="max-w-md whitespace-normal">
                  <p>{d.description}</p>
                  {d.action && <p className="mt-0.5 font-mono text-xs text-muted-foreground">{d.action}</p>}
                  {d.dialogue && <p className="mt-0.5 text-xs italic">« {d.dialogue} »</p>}
                </TableCell>
                <TableCell className="whitespace-normal text-sm">{cameraLabel(clean(d)) || '—'}</TableCell>
                <TableCell className="text-right tabular-nums">{d.durationSec ?? '—'} s</TableCell>
                <TableCell className="font-mono text-xs">{(d.characters ?? []).join(', ') || '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-muted-foreground">
          {picked.size} sur {drafts.length} coché{picked.size > 1 ? 's' : ''}
          {replace ? ' — les plans existants de la scène seront remplacés.' : ''}
        </span>
        <Button onClick={add} disabled={busy || !picked.size}>
          {busy ? <Loader2 className="animate-spin" /> : <Plus />} Ajouter les plans cochés
        </Button>
      </div>
    </div>
  );
}
