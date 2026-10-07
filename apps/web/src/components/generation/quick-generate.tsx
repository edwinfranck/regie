'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Copy, Loader2, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useProjectId } from '@/hooks/use-project';
import { post, toastError } from '@/lib/client';
import { fmtUsd } from '@/lib/utils';
import { Choice } from '../common/choice';
import { AssetThumb } from '../common/media';
import { ModelPicker, useModels } from '../common/model-picker';

export interface CompiledPrompt {
  target: string;
  text: string;
  negative: string[];
  refs: { id: string; kind: string; assetId?: string | null; why: string }[];
  notes: string[];
  startFrame?: string;
  edited?: boolean;
}

export interface GenerateRequest {
  capability: 'IMAGE' | 'VIDEO' | 'AUDIO';
  mode: string;
  prompt: CompiledPrompt;
  shotId?: string | null;
  links?: Record<string, unknown>;
  /** Assets passés en entrée, avec leur rôle. Par défaut : les références du prompt. */
  inputs?: { assetId: string; role: string }[];
  aspectRatio?: string;
  durationSec?: number;
  title?: string;
}

const RATIOS = ['16:9', '9:16', '1:1', '4:3', '3:4', '2.39:1', '1.85:1', '4:5'];

/**
 * Le dialogue de génération partagé : prompt final visible et éditable,
 * références chargées, modèle (AUTO ou forcé), coût estimé, puis mise en file.
 * La génération tourne en arrière-plan ; l'interface n'est jamais bloquée.
 */
export function QuickGenerate({ request, open, onOpenChange, onQueued }: { request: GenerateRequest | null; open: boolean; onOpenChange: (o: boolean) => void; onQueued?: (g: any) => void }) {
  const projectId = useProjectId();
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const [negative, setNegative] = useState('');
  const [modelId, setModelId] = useState('auto');
  const [ratio, setRatio] = useState<string>('16:9');
  const [duration, setDuration] = useState(5);
  const [useRefs, setUseRefs] = useState(true);
  const { data: models = [] } = useModels(request?.capability);

  useEffect(() => {
    if (!request) return;
    setText(request.prompt.text);
    setNegative(request.prompt.negative.join(', '));
    setRatio(request.aspectRatio ?? '16:9');
    setDuration(request.durationSec ?? 5);
    setUseRefs(true);
  }, [request]);

  const inputs = request?.inputs ?? request?.prompt.refs.filter((r) => r.assetId).map((r) => ({ assetId: r.assetId!, role: 'reference' })) ?? [];
  const model = models.find((m) => m.id === modelId);
  const quote = model?.pricing?.usd !== undefined ? (model.pricing.unit === 'second' ? model.pricing.usd * duration : model.pricing.unit === 'image' ? model.pricing.usd : model.pricing.usd) : null;

  const run = useMutation({
    mutationFn: () =>
      post(`/api/projects/${projectId}/generations`, {
        capability: request!.capability,
        mode: request!.mode,
        modelId,
        prompt: text,
        negative: negative || undefined,
        shotId: request!.shotId ?? null,
        target: request!.prompt.target,
        inputAssetIds: useRefs ? inputs.map((i) => i.assetId) : [],
        inputRoles: useRefs ? inputs.map((i) => i.role) : [],
        links: request!.links ?? {},
        params: { aspectRatio: ratio, ...(request!.capability === 'VIDEO' ? { durationSec: duration } : {}) },
      }),
    onSuccess: (g) => {
      toast.success('Génération en file', { description: `${g.model?.label ?? 'Modèle'} · ${g.provider?.name ?? ''}. Le résultat arrivera dans les assets.` });
      qc.invalidateQueries({ queryKey: ['generations'] });
      onQueued?.(g);
      onOpenChange(false);
    },
    onError: (e) => toastError(e, 'Génération refusée'),
  });

  if (!request) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{request.title ?? 'Générer'}</DialogTitle>
          <DialogDescription>Le prompt a été compilé depuis la bible. Il reste modifiable avant l’envoi.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 md:grid-cols-[1fr_220px]">
          <div className="space-y-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Prompt</Label>
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => {
                    navigator.clipboard.writeText(text);
                    toast.success('Prompt copié');
                  }}
                >
                  <Copy /> Copier
                </Button>
              </div>
              <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={12} className="font-mono text-[12.5px] leading-relaxed" />
            </div>
            {request.capability !== 'AUDIO' && (
              <div className="space-y-1.5">
                <Label>À éviter</Label>
                <Textarea value={negative} onChange={(e) => setNegative(e.target.value)} rows={2} className="font-mono text-[12.5px]" />
              </div>
            )}
            {request.prompt.notes.length > 0 && (
              <ul className="space-y-0.5 text-xs text-muted-foreground">
                {request.prompt.notes.map((n) => (
                  <li key={n}>· {n}</li>
                ))}
              </ul>
            )}
          </div>
          <div className="space-y-4">
            <ModelPicker capability={request.capability} mode={request.mode} value={modelId} onChange={setModelId} />
            {request.capability !== 'AUDIO' && <Choice label="Format" value={ratio} onChange={(v) => v && setRatio(v)} options={RATIOS.map((r) => ({ value: r, label: r }))} />}
            {request.capability === 'VIDEO' && <Choice label="Durée" value={String(duration)} onChange={(v) => v && setDuration(Number(v))} options={[3, 4, 5, 6, 8, 10].map((d) => ({ value: String(d), label: `${d} s` }))} />}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Références ({inputs.length})</Label>
                {inputs.length > 0 && (
                  <button className="text-xs text-muted-foreground underline underline-offset-2" onClick={() => setUseRefs(!useRefs)}>
                    {useRefs ? 'ne pas envoyer' : 'envoyer'}
                  </button>
                )}
              </div>
              {inputs.length === 0 ? (
                <p className="text-xs text-muted-foreground">Aucune image de référence. Le texte seul ne fige ni un visage ni un costume.</p>
              ) : (
                <div className={`grid grid-cols-3 gap-1.5 ${useRefs ? '' : 'opacity-40'}`}>
                  {inputs.map((i) => (
                    <div key={i.assetId} className="space-y-0.5">
                      <AssetThumb asset={{ id: i.assetId, type: 'IMAGE' }} ratio="1:1" className="rounded-sm" />
                      <p className="truncate text-[10px] text-muted-foreground">{request.prompt.refs.find((r) => r.assetId === i.assetId)?.id ?? i.role}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        <DialogFooter className="items-center sm:justify-between">
          <span className="text-sm text-muted-foreground">{modelId === 'auto' ? 'Coût selon le modèle choisi par le routeur' : quote !== null ? `Coût estimé : ${fmtUsd(quote)}` : 'Coût inconnu pour ce modèle'}</span>
          <Button onClick={() => run.mutate()} disabled={run.isPending || !text.trim()} className="bg-signal text-signal-foreground hover:bg-signal/90">
            {run.isPending ? <Loader2 className="animate-spin" /> : <Sparkles />} Générer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
