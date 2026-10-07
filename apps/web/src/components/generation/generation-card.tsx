'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, CircleAlert, Clapperboard, Loader2, RotateCcw, Settings2, Shuffle, X } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Progress } from '@/components/ui/progress';
import { useProjectId } from '@/hooks/use-project';
import { del, post, toastError } from '@/lib/client';
import { cn, fmtDuration, fmtRelative, fmtUsd } from '@/lib/utils';
import { Choice } from '../common/choice';
import { AssetThumb } from '../common/media';
import { useModels, usable } from '../common/model-picker';
import { StatusPill } from '../common/status';
import { AssetPreview } from './asset-preview';
import { modeLabel } from './modes';
import { SetReferenceMenu } from './set-reference-menu';

export interface GenerationRow {
  id: string;
  status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELED';
  capability: 'IMAGE' | 'VIDEO' | 'AUDIO';
  mode: string;
  prompt: string;
  negative?: string | null;
  params?: Record<string, any> | null;
  inputAssetIds: string[];
  shotId?: string | null;
  progress?: number | null;
  message?: string;
  error?: string | null;
  errorCode?: string | null;
  costUsd?: number | null;
  durationMs?: number | null;
  createdAt: string;
  model?: { id: string; label: string; modelId: string } | null;
  provider?: { id: string; name: string; adapter: string } | null;
  outputs: { id: string; type: string; width?: number | null; height?: number | null; mimeType: string }[];
  shot?: { id: string; code: string } | null;
}

/**
 * Une génération de la file : statut en direct, sorties, et quand elle
 * échoue, une carte qui dit qui a échoué et pourquoi, avec de quoi repartir.
 */
export function GenerationCard({ g, highlighted, onReuse }: { g: GenerationRow; highlighted?: boolean; onReuse: (g: GenerationRow) => void }) {
  const projectId = useProjectId();
  const qc = useQueryClient();
  const [preview, setPreview] = useState<GenerationRow['outputs'][number] | null>(null);
  const [promptOpen, setPromptOpen] = useState(false);
  const base = `/api/projects/${projectId}/generations/${g.id}`;
  const refresh = () => qc.invalidateQueries({ queryKey: ['generations'] });

  const retry = useMutation({
    mutationFn: (modelId?: string) => post(base, modelId ? { modelId } : {}),
    onSuccess: (_r, modelId) => {
      toast.success(modelId ? 'Relancée avec un autre modèle' : 'Génération relancée');
      refresh();
    },
    onError: (e) => toastError(e, 'Relance refusée'),
  });
  const cancel = useMutation({
    mutationFn: () => del(base),
    onSuccess: () => {
      toast.message('Génération annulée');
      refresh();
    },
    onError: (e) => toastError(e),
  });

  const active = g.status === 'QUEUED' || g.status === 'PROCESSING';
  const failed = g.status === 'FAILED';
  const ratio = g.capability === 'AUDIO' ? undefined : String(g.params?.aspectRatio ?? '16:9');

  return (
    <article id={`gen-${g.id}`} className={cn('rounded-md border bg-card', highlighted && 'border-signal ring-1 ring-signal')}>
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-4 py-2.5 text-sm">
        <StatusPill status={g.status} progress={g.progress ?? undefined} />
        <span className="font-medium">{modeLabel(g.mode)}</span>
        {g.shot && <span className="font-mono text-xs text-muted-foreground">plan {g.shot.code}</span>}
        <span className="text-muted-foreground">
          {g.model?.label ?? 'Modèle supprimé'} · {g.provider?.name ?? '—'}
        </span>
        <span className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
          {g.durationMs ? <span>{fmtDuration(g.durationMs / 1000)}</span> : null}
          {g.costUsd !== null && g.costUsd !== undefined ? <span>{fmtUsd(g.costUsd)}</span> : null}
          <span>{fmtRelative(g.createdAt)}</span>
        </span>
      </header>

      <div className="space-y-3 p-4">
        {active && (
          <div className="space-y-1.5">
            <Progress value={g.status === 'QUEUED' ? 0 : (g.progress ?? 0)} className="h-1" />
            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>{g.status === 'QUEUED' ? 'En attente d’un créneau de génération…' : (g.message ?? 'Génération en cours…')}</span>
              <Button variant="ghost" size="xs" onClick={() => cancel.mutate()} disabled={cancel.isPending}>
                {cancel.isPending ? <Loader2 className="animate-spin" /> : <X />} Annuler
              </Button>
            </div>
          </div>
        )}

        {failed && (
          <div className="space-y-2 rounded-md border border-destructive/40 bg-destructive/5 p-3">
            <p className="flex items-center gap-2 font-medium text-destructive">
              <CircleAlert className="size-4" /> La génération a échoué
            </p>
            <dl className="grid grid-cols-[90px_1fr] gap-x-3 gap-y-0.5 text-sm">
              <dt className="text-muted-foreground">Provider</dt>
              <dd>{g.provider?.name ?? '—'}</dd>
              <dt className="text-muted-foreground">Modèle</dt>
              <dd>
                {g.model?.label ?? '—'} {g.model?.modelId && <span className="font-mono text-xs text-muted-foreground">{g.model.modelId}</span>}
              </dd>
              <dt className="text-muted-foreground">Erreur</dt>
              <dd className="break-words">
                {g.error || 'Aucun message du provider.'} {g.errorCode && <span className="font-mono text-xs text-muted-foreground">({g.errorCode})</span>}
              </dd>
            </dl>
            <div className="flex flex-wrap gap-1.5 pt-1">
              <Button size="sm" variant="outline" onClick={() => retry.mutate(undefined)} disabled={retry.isPending}>
                {retry.isPending ? <Loader2 className="animate-spin" /> : <RotateCcw />} Réessayer
              </Button>
              <ChangeModel g={g} onPick={(id) => retry.mutate(id)} pending={retry.isPending} />
              {g.errorCode === 'not_configured' || g.errorCode === 'auth' ? (
                <Button size="sm" variant="ghost" asChild>
                  <Link href="/settings/providers">Configurer un provider</Link>
                </Button>
              ) : null}
            </div>
          </div>
        )}

        {g.status === 'CANCELED' && (
          <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
            <span>Annulée avant la fin.</span>
            <Button size="xs" variant="ghost" onClick={() => retry.mutate(undefined)} disabled={retry.isPending}>
              <RotateCcw /> Relancer
            </Button>
          </div>
        )}

        {g.outputs.length > 0 && (
          <div className={cn('grid gap-2', g.capability === 'AUDIO' ? 'grid-cols-1' : g.outputs.length === 1 ? 'grid-cols-1 sm:max-w-md' : 'grid-cols-2 lg:grid-cols-4')}>
            {g.outputs.map((o) =>
              g.capability === 'AUDIO' ? (
                <AssetThumb key={o.id} asset={o} className="rounded-sm" />
              ) : (
                <button key={o.id} type="button" onClick={() => setPreview(o)} className="overflow-hidden rounded-sm border hover:border-foreground/50" aria-label="Agrandir">
                  <AssetThumb asset={o} ratio={ratio} />
                </button>
              ),
            )}
          </div>
        )}

        <Collapsible open={promptOpen} onOpenChange={setPromptOpen}>
          <CollapsibleTrigger className="flex w-full items-center gap-1 text-left text-sm text-muted-foreground hover:text-foreground">
            <ChevronDown className={cn('size-4 shrink-0 transition-transform', !promptOpen && '-rotate-90')} />
            <span className={cn('min-w-0', !promptOpen && 'truncate')}>{promptOpen ? 'Prompt' : g.prompt}</span>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <pre className="mt-2 max-h-72 overflow-y-auto rounded-sm bg-muted/50 p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap">{g.prompt}</pre>
            {g.negative && <p className="mt-1.5 font-mono text-xs text-muted-foreground">À éviter : {g.negative}</p>}
          </CollapsibleContent>
        </Collapsible>

        <div className="flex flex-wrap gap-1">
          <Button variant="ghost" size="xs" onClick={() => onReuse(g)}>
            <Settings2 /> Réutiliser les réglages
          </Button>
          {g.status === 'COMPLETED' && g.outputs[0] && <OutputActions output={g.outputs[0]} capability={g.capability} />}
        </div>
      </div>

      <AssetPreview
        asset={preview}
        onOpenChange={(o) => !o && setPreview(null)}
        title={`${modeLabel(g.mode)} · ${g.model?.label ?? ''}`}
        description={g.provider?.name}
        actions={preview && <OutputActions output={preview} capability={g.capability} size="sm" />}
      />
    </article>
  );
}

function OutputActions({ output, capability, size = 'xs' }: { output: { id: string; type: string }; capability: string; size?: 'xs' | 'sm' }) {
  const projectId = useProjectId();
  if (output.type !== 'IMAGE') return null;
  return (
    <>
      {capability === 'IMAGE' && (
        <Button variant="ghost" size={size} asChild>
          <Link href={`/projects/${projectId}/videos?from=${output.id}`}>
            <Clapperboard /> Utiliser comme première image
          </Link>
        </Button>
      )}
      <SetReferenceMenu assetId={output.id} size={size} />
    </>
  );
}

function ChangeModel({ g, onPick, pending }: { g: GenerationRow; onPick: (id: string) => void; pending: boolean }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<string | null>(null);
  const { data: models = [] } = useModels(g.capability);
  const options = models.filter((m) => usable(m) && m.id !== g.model?.id && (!m.modes.length || m.modes.includes(g.mode)));
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline" disabled={pending}>
          <Shuffle /> Changer de modèle
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 space-y-3">
        {options.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucun autre modèle disponible pour ce mode.{' '}
            <Link href="/settings/providers" className="underline underline-offset-2">
              Configurer un provider
            </Link>
          </p>
        ) : (
          <>
            <Choice label="Relancer avec" value={value} onChange={setValue} options={options.map((m) => ({ value: m.id, label: m.label, hint: m.provider.name }))} placeholder="Choisir un modèle" />
            <Button
              size="sm"
              className="w-full"
              disabled={!value}
              onClick={() => {
                onPick(value!);
                setOpen(false);
              }}
            >
              Relancer
            </Button>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
