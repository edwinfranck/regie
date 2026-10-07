'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Download, ExternalLink, Loader2, X } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { fileUrl } from '@/components/common/media';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { type StudioEvent, useStudioEvents } from '@/hooks/use-events';
import { get, post, toastError } from '@/lib/client';
import { humanDuration } from './time';

// Le rendu : la séquence enregistrée part dans la file FFmpeg du worker ; le
// fichier produit devient un asset vidéo du projet.

export interface RenderRow {
  id: string;
  format: string;
  status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELED';
  progress: number;
  assetId: string | null;
  error: string | null;
  durationSec: number | null;
  createdAt: string;
  finishedAt: string | null;
}

type RenderEvent =
  | { type: 'render.progress'; renderId: string; timelineId: string; projectId: string; progress: number }
  | { type: 'render.completed'; renderId: string; timelineId: string; projectId: string; assetId: string }
  | { type: 'render.failed'; renderId: string; timelineId: string; projectId: string; error: string };

export const rendersKey = (timelineId: string) => ['editor', 'renders', timelineId];

export function useRenders(projectId: string, timelineId: string | null) {
  return useQuery({ queryKey: rendersKey(timelineId ?? ''), queryFn: () => get<RenderRow[]>(`/api/projects/${projectId}/timelines/${timelineId}/render`), enabled: !!timelineId });
}

/** Suit les rendus en temps réel : progression dans le cache, notification à la fin. */
export function useRenderEvents(projectId: string) {
  const qc = useQueryClient();
  const fn = useCallback(
    (raw: StudioEvent) => {
      const ev = raw as unknown as RenderEvent;
      if (!ev.type?.startsWith('render.') || ev.projectId !== projectId) return;
      const key = rendersKey(ev.timelineId);
      if (ev.type === 'render.progress') {
        qc.setQueryData<RenderRow[]>(key, (old) => old?.map((r) => (r.id === ev.renderId ? { ...r, status: 'PROCESSING', progress: ev.progress } : r)));
        return;
      }
      qc.invalidateQueries({ queryKey: key });
      qc.invalidateQueries({ queryKey: ['editor', 'timelines', projectId] });
      if (ev.type === 'render.completed') {
        qc.invalidateQueries({ queryKey: ['assets'] });
        toast.success('Rendu terminé', {
          description: 'La vidéo est rangée dans les assets du projet.',
          action: { label: 'Télécharger', onClick: () => (window.location.href = fileUrl(ev.assetId, true)) },
          duration: 12000,
        });
      } else toast.error('Rendu échoué', { description: ev.error, duration: 12000 });
    },
    [qc, projectId],
  );
  useStudioEvents(fn);
}

const QUALITIES = [
  { value: 'draft', label: 'Brouillon', hint: 'rapide, fichier léger' },
  { value: 'standard', label: 'Standard', hint: 'diffusion' },
  { value: 'high', label: 'Haute', hint: 'archive, plus lent' },
] as const;

export function RenderDialog({ open, onOpenChange, projectId, timelineId, flush, empty }: { open: boolean; onOpenChange: (v: boolean) => void; projectId: string; timelineId: string; flush: () => Promise<boolean>; empty: boolean }) {
  const qc = useQueryClient();
  const [format, setFormat] = useState<'mp4' | 'mov'>('mp4');
  const [quality, setQuality] = useState<'draft' | 'standard' | 'high'>('standard');
  const [subs, setSubs] = useState(true);
  const [busy, setBusy] = useState(false);
  const { data: renders } = useRenders(projectId, timelineId);

  const start = async () => {
    setBusy(true);
    try {
      // Le worker rend la séquence enregistrée : on enregistre d'abord.
      if (!(await flush())) return;
      const r = await post<RenderRow>(`/api/projects/${projectId}/timelines/${timelineId}/render`, { format, quality, burnSubtitles: subs });
      qc.setQueryData<RenderRow[]>(rendersKey(timelineId), (old) => [{ ...r, progress: 0 }, ...(old ?? [])]);
    } catch (e) {
      toastError(e, 'Rendu impossible');
    } finally {
      setBusy(false);
    }
  };

  const running = renders?.some((r) => r.status === 'QUEUED' || r.status === 'PROCESSING');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Rendre la vidéo</DialogTitle>
          <DialogDescription>FFmpeg assemble la séquence telle qu’enregistrée ; le fichier rejoint les assets vidéo du projet.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Format</Label>
            <ToggleGroup type="single" variant="outline" value={format} onValueChange={(v) => v && setFormat(v as 'mp4' | 'mov')} className="w-full">
              <ToggleGroupItem value="mp4" className="flex-1">
                MP4 <span className="text-xs text-muted-foreground">H.264</span>
              </ToggleGroupItem>
              <ToggleGroupItem value="mov" className="flex-1">
                MOV <span className="text-xs text-muted-foreground">QuickTime</span>
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
          <div className="space-y-1.5">
            <Label>Qualité</Label>
            <ToggleGroup type="single" variant="outline" value={quality} onValueChange={(v) => v && setQuality(v as typeof quality)} className="w-full">
              {QUALITIES.map((q) => (
                <ToggleGroupItem key={q.value} value={q.value} className="flex-1">
                  {q.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <p className="text-xs text-muted-foreground">{QUALITIES.find((q) => q.value === quality)?.hint}</p>
          </div>
          <label className="flex items-center justify-between gap-4 rounded-md border px-3 py-2.5">
            <span className="text-sm">
              Sous-titres incrustés
              <span className="block text-xs text-muted-foreground">Les pistes de sous-titres visibles, gravées dans l’image.</span>
            </span>
            <Switch checked={subs} onCheckedChange={setSubs} />
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fermer
          </Button>
          <Button onClick={start} disabled={busy || empty} className="bg-signal text-signal-foreground hover:bg-signal/90">
            {busy && <Loader2 className="animate-spin" />}
            {running ? 'Lancer un autre rendu' : 'Lancer le rendu'}
          </Button>
        </DialogFooter>
        {!!renders?.length && (
          <div className="space-y-2 border-t pt-4">
            <h3 className="text-sm font-medium">Rendus</h3>
            <ul className="max-h-60 space-y-1.5 overflow-y-auto">
              {renders.map((r) => (
                <RenderItem key={r.id} r={r} projectId={projectId} />
              ))}
            </ul>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

const when = (d: string) => new Date(d).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

function RenderItem({ r, projectId }: { r: RenderRow; projectId: string }) {
  const active = r.status === 'QUEUED' || r.status === 'PROCESSING';
  return (
    <li className="rounded-md border px-3 py-2 text-sm">
      <div className="flex items-center gap-2">
        {r.status === 'COMPLETED' ? <Check className="size-3.5 text-success" /> : r.status === 'FAILED' || r.status === 'CANCELED' ? <X className="size-3.5 text-destructive" /> : <Loader2 className="size-3.5 animate-spin text-signal" />}
        <span className="font-medium uppercase">{r.format}</span>
        <span className="min-w-0 flex-1 truncate whitespace-nowrap text-muted-foreground">
          {when(r.createdAt)}
          {r.durationSec ? ` · ${humanDuration(r.durationSec)}` : ''}
        </span>
        {r.status === 'COMPLETED' && r.assetId && (
          <>
            <Button variant="ghost" size="xs" asChild>
              <Link href={`/projects/${projectId}/assets?asset=${r.assetId}`}>
                <ExternalLink /> Voir dans les assets
              </Link>
            </Button>
            <Button variant="outline" size="xs" asChild>
              <a href={fileUrl(r.assetId, true)}>
                <Download /> Télécharger
              </a>
            </Button>
          </>
        )}
        {r.status === 'QUEUED' && <span className="text-xs text-muted-foreground">En file</span>}
        {r.status === 'PROCESSING' && <span className="text-xs text-signal tabular-nums">{r.progress} %</span>}
      </div>
      {active && <Progress value={r.status === 'QUEUED' ? 0 : r.progress} className="mt-2 h-1" />}
      {r.status === 'FAILED' && r.error && <p className="mt-1 line-clamp-3 text-xs text-destructive">{r.error}</p>}
    </li>
  );
}
