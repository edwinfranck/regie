'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Search, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Choice, PillPicker } from '@/components/common/choice';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { del, get, patch, post, toastError } from '@/lib/client';
import { cn } from '@/lib/utils';
import { type Capability, CAPABILITY_LABELS, CAPABILITY_OPTIONS, DISCOVERABLE, MODES_BY_CAPABILITY, type ModelRow, modeLabel, PRICE_UNIT_OPTIONS, PRICE_UNITS_SHORT, type PriceUnit, type ProviderRow, type ProvidersData } from './shared';

const SCORE_OPTIONS = [1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: String(n) }));

/** Met à jour un modèle dans le cache ['providers'] avant la réponse du serveur. */
function useModelMutations() {
  const qc = useQueryClient();
  const setModel = (id: string, fn: (m: ModelRow) => ModelRow | null) =>
    qc.setQueryData<ProvidersData>(['providers'], (d) =>
      d ? { ...d, providers: d.providers.map((p) => ({ ...p, models: p.models.map((m) => (m.id === id ? fn(m) : m)).filter(Boolean) as ModelRow[] })) } : d,
    );
  const update = useMutation({
    mutationFn: ({ id, ...data }: Partial<ModelRow> & { id: string }) => patch(`/api/models/${id}`, data),
    onMutate: ({ id, ...data }) => setModel(id, (m) => ({ ...m, ...data })),
    onError: (e) => {
      toastError(e, 'Modification refusée');
      qc.invalidateQueries({ queryKey: ['providers'] });
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => del(`/api/models/${id}`),
    onMutate: (id) => setModel(id, () => null),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['providers'] }),
    onError: (e) => {
      toastError(e);
      qc.invalidateQueries({ queryKey: ['providers'] });
    },
  });
  return { update, remove };
}

export function ModelsTable({ provider }: { provider: ProviderRow }) {
  const { update, remove } = useModelMutations();
  const ro = !provider.canManage;
  const [adding, setAdding] = useState(false);
  const [discovering, setDiscovering] = useState(false);

  return (
    <div className="space-y-3">
      {provider.models.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aucun modèle déclaré. {DISCOVERABLE.has(provider.adapter) ? 'Lancez la découverte pour lister ceux que le serveur expose, ou ajoutez-en un à la main.' : 'Ajoutez-en un à la main.'}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-44">Libellé</TableHead>
                <TableHead>Identifiant</TableHead>
                <TableHead className="w-28">Capacité</TableHead>
                <TableHead>Modes</TableHead>
                <TableHead className="min-w-52">Prix estimé</TableHead>
                <TableHead className="w-20" title="Note de qualité pour le routage AUTO">
                  Qualité
                </TableHead>
                <TableHead className="w-20" title="Note de vitesse pour le routage AUTO">
                  Vitesse
                </TableHead>
                <TableHead className="w-24">Durée max</TableHead>
                <TableHead className="w-16">Actif</TableHead>
                {!ro && <TableHead className="w-10" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {provider.models.map((m) => (
                <ModelLine key={m.id} m={m} ro={ro} onPatch={(data) => update.mutate({ id: m.id, ...data })} onDelete={() => remove.mutate(m.id)} />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {!ro && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
            <Plus /> Ajouter un modèle
          </Button>
          {DISCOVERABLE.has(provider.adapter) && (
            <Button size="sm" variant="outline" onClick={() => setDiscovering(true)}>
              <Search /> Découvrir les modèles
            </Button>
          )}
        </div>
      )}
      {adding && <AddModelDialog provider={provider} onClose={() => setAdding(false)} />}
      {discovering && <DiscoverDialog provider={provider} onClose={() => setDiscovering(false)} />}
    </div>
  );
}

/** Un champ texte qui n'envoie qu'en sortie de champ (pas une requête par frappe). */
function CommitInput({ value, onCommit, className, type = 'text', disabled, placeholder }: { value: string; onCommit: (v: string) => void; className?: string; type?: string; disabled?: boolean; placeholder?: string }) {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);
  return (
    <Input
      type={type}
      value={local}
      disabled={disabled}
      placeholder={placeholder}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => local !== value && onCommit(local)}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      className={cn('h-8', className)}
    />
  );
}

function ModelLine({ m, ro, onPatch, onDelete }: { m: ModelRow; ro: boolean; onPatch: (d: Partial<ModelRow>) => void; onDelete: () => void }) {
  const modes = MODES_BY_CAPABILITY[m.capability];
  return (
    <TableRow className={cn(!m.enabled && 'text-muted-foreground')}>
      <TableCell>{ro ? m.label : <CommitInput value={m.label} onCommit={(v) => v.trim() && onPatch({ label: v.trim() })} />}</TableCell>
      <TableCell className="max-w-56 truncate font-mono text-[13px]" title={m.modelId}>
        {m.modelId}
      </TableCell>
      <TableCell>{ro ? CAPABILITY_LABELS[m.capability] : <Choice value={m.capability} onChange={(v) => v && onPatch({ capability: v as Capability, modes: m.modes.filter((x) => MODES_BY_CAPABILITY[v as Capability].includes(x)) })} options={CAPABILITY_OPTIONS} triggerClassName="h-8" />}</TableCell>
      <TableCell>
        {ro ? (
          <span className="text-sm">{m.modes.map(modeLabel).join(', ') || '—'}</span>
        ) : (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 max-w-52 justify-start truncate font-normal">
                {m.modes.length ? m.modes.map(modeLabel).join(', ') : 'Tous les modes'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="start">
              <PillPicker label="Modes pris en charge" options={modes.map((x) => ({ value: x, label: modeLabel(x) }))} value={m.modes} onChange={(v) => onPatch({ modes: v })} />
              <p className="mt-2 text-xs text-muted-foreground">Aucun mode coché = le routeur le considère apte à tous.</p>
            </PopoverContent>
          </Popover>
        )}
      </TableCell>
      <TableCell>
        {ro ? (
          <span className="text-sm">{m.pricing?.usd !== undefined ? `${m.pricing.usd} $ ${PRICE_UNIT_OPTIONS.find((u) => u.value === m.pricing.unit)?.label ?? ''}` : '—'}</span>
        ) : (
          <div className="flex items-center gap-1.5">
            <CommitInput type="number" value={m.pricing?.usd === undefined ? '' : String(m.pricing.usd)} placeholder="$" className="w-20" onCommit={(v) => onPatch({ pricing: { ...m.pricing, usd: v === '' ? undefined : Math.max(0, Number(v)) } })} />
            <Choice value={m.pricing?.unit ?? null} onChange={(v) => onPatch({ pricing: { ...m.pricing, unit: (v ?? undefined) as PriceUnit | undefined } })} options={Object.entries(PRICE_UNITS_SHORT).map(([value, label]) => ({ value, label }))} placeholder="unité" triggerClassName="h-8 w-32" />
          </div>
        )}
      </TableCell>
      <TableCell>{ro ? m.quality : <Choice value={String(m.quality)} onChange={(v) => v && onPatch({ quality: Number(v) })} options={SCORE_OPTIONS} triggerClassName="h-8" />}</TableCell>
      <TableCell>{ro ? m.speed : <Choice value={String(m.speed)} onChange={(v) => v && onPatch({ speed: Number(v) })} options={SCORE_OPTIONS} triggerClassName="h-8" />}</TableCell>
      <TableCell>
        {m.capability !== 'VIDEO' && m.capability !== 'AUDIO' ? (
          <span className="text-muted-foreground">—</span>
        ) : ro ? (
          m.maxDuration ? `${m.maxDuration} s` : '—'
        ) : (
          <CommitInput type="number" value={m.maxDuration ? String(m.maxDuration) : ''} placeholder="s" className="w-20" onCommit={(v) => onPatch({ maxDuration: v === '' ? null : Math.max(0, Number(v)) })} />
        )}
      </TableCell>
      <TableCell>
        <Switch checked={m.enabled} disabled={ro} onCheckedChange={(v) => onPatch({ enabled: v })} aria-label="Modèle activé" />
      </TableCell>
      {!ro && (
        <TableCell>
          <Button variant="ghost" size="icon-sm" onClick={onDelete} aria-label={`Supprimer ${m.label}`} className="text-muted-foreground hover:text-destructive">
            <Trash2 />
          </Button>
        </TableCell>
      )}
    </TableRow>
  );
}

interface Draft {
  modelId: string;
  label: string;
  capability: Capability;
  modes: string[];
  unit: PriceUnit | null;
  usd: string;
  quality: number;
  speed: number;
  maxDuration: string;
}

function AddModelDialog({ provider, onClose }: { provider: ProviderRow; onClose: () => void }) {
  const qc = useQueryClient();
  const [d, setD] = useState<Draft>({ modelId: '', label: '', capability: 'IMAGE', modes: [], unit: null, usd: '', quality: 3, speed: 3, maxDuration: '' });
  const set = (p: Partial<Draft>) => setD((s) => ({ ...s, ...p }));
  const create = useMutation({
    mutationFn: () =>
      post(`/api/providers/${provider.id}/models`, {
        modelId: d.modelId.trim(),
        label: d.label.trim() || d.modelId.trim(),
        capability: d.capability,
        modes: d.modes,
        pricing: d.usd !== '' ? { usd: Number(d.usd), ...(d.unit ? { unit: d.unit } : {}) } : undefined,
        quality: d.quality,
        speed: d.speed,
        maxDuration: d.maxDuration ? Number(d.maxDuration) : null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['providers'] });
      onClose();
    },
    onError: (e) => toastError(e),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Ajouter un modèle à {provider.name}</DialogTitle>
          <DialogDescription>L’identifiant est celui qu’attend l’API du fournisseur, à l’identique.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (d.modelId.trim()) create.mutate();
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="m-id">Identifiant</Label>
              <Input id="m-id" value={d.modelId} onChange={(e) => set({ modelId: e.target.value })} className="font-mono text-[13px]" placeholder="fal-ai/flux/dev" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="m-label">Libellé</Label>
              <Input id="m-label" value={d.label} onChange={(e) => set({ label: e.target.value })} placeholder="Flux Dev" />
            </div>
          </div>
          <Choice label="Capacité" value={d.capability} onChange={(v) => v && set({ capability: v as Capability, modes: [] })} options={CAPABILITY_OPTIONS} />
          <PillPicker label="Modes" options={MODES_BY_CAPABILITY[d.capability].map((x) => ({ value: x, label: modeLabel(x) }))} value={d.modes} onChange={(modes) => set({ modes })} />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="m-usd">Prix estimé ($)</Label>
              <Input id="m-usd" type="number" step="0.001" min={0} value={d.usd} onChange={(e) => set({ usd: e.target.value })} />
            </div>
            <Choice label="Unité" value={d.unit} onChange={(v) => set({ unit: v as PriceUnit | null })} options={PRICE_UNIT_OPTIONS} placeholder="unité" />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Choice label="Qualité" value={String(d.quality)} onChange={(v) => v && set({ quality: Number(v) })} options={SCORE_OPTIONS} />
            <Choice label="Vitesse" value={String(d.speed)} onChange={(v) => v && set({ speed: Number(v) })} options={SCORE_OPTIONS} />
            {(d.capability === 'VIDEO' || d.capability === 'AUDIO') && (
              <div className="space-y-1.5">
                <Label htmlFor="m-dur">Durée max (s)</Label>
                <Input id="m-dur" type="number" min={0} value={d.maxDuration} onChange={(e) => set({ maxDuration: e.target.value })} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={!d.modelId.trim() || create.isPending}>
              Ajouter
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface Discovered {
  modelId: string;
  label: string;
  capability: Capability;
  modes: string[];
  pricing?: { unit?: PriceUnit; usd?: number };
  quality?: number;
  speed?: number;
  maxDuration?: number;
  aspectRatios?: string[];
}

/** Interroge le serveur du provider (Ollama, ComfyUI, OpenAI-compatible) et propose ses modèles. */
export function DiscoverDialog({ provider, onClose }: { provider: ProviderRow; onClose: () => void }) {
  const qc = useQueryClient();
  const [state, setState] = useState<{ loading: boolean; models: Discovered[]; error: string | null }>({ loading: true, models: [], error: null });
  const [pending, setPending] = useState<string | null>(null);
  const known = new Set(provider.models.map((m) => m.modelId));

  useEffect(() => {
    get<{ models: Discovered[]; discovered: boolean }>(`/api/providers/${provider.id}/models`)
      .then((r) => setState({ loading: false, models: r.models, error: null }))
      .catch((e) => setState({ loading: false, models: [], error: e instanceof Error ? e.message : 'Découverte impossible.' }));
  }, [provider.id]);

  async function add(m: Discovered) {
    setPending(m.modelId);
    try {
      await post(`/api/providers/${provider.id}/models`, {
        modelId: m.modelId,
        label: m.label || m.modelId,
        capability: m.capability,
        modes: m.modes ?? [],
        ...(m.pricing ? { pricing: m.pricing } : {}),
        ...(m.quality ? { quality: m.quality } : {}),
        ...(m.speed ? { speed: m.speed } : {}),
        ...(m.maxDuration ? { maxDuration: m.maxDuration } : {}),
        ...(m.aspectRatios ? { aspectRatios: m.aspectRatios } : {}),
      });
      await qc.invalidateQueries({ queryKey: ['providers'] });
      toast.success(`${m.label || m.modelId} ajouté`);
    } catch (e) {
      toastError(e);
    } finally {
      setPending(null);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Modèles exposés par {provider.name}</DialogTitle>
          <DialogDescription>Ce que le serveur annonce en ce moment. Ajoutez ceux que régie doit pouvoir utiliser.</DialogDescription>
        </DialogHeader>
        {state.loading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Interrogation du serveur…
          </p>
        ) : state.error ? (
          <p className="text-sm text-destructive">{state.error}</p>
        ) : state.models.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Le serveur répond mais n’expose aucun modèle.{' '}
            {provider.adapter === 'ollama' ? (
              <>
                Installez-en un sur la machine, par exemple <code className="font-mono">ollama pull llama3.2</code>, puis relancez la découverte.
              </>
            ) : provider.adapter === 'comfyui' ? (
              'Déclarez vos workflows dans la configuration du provider.'
            ) : null}
          </p>
        ) : (
          <ul className="max-h-[60vh] divide-y overflow-y-auto rounded-md border">
            {state.models.map((m) => (
              <li key={m.modelId} className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate">{m.label || m.modelId}</p>
                  <p className="truncate font-mono text-xs text-muted-foreground">
                    {m.modelId} · {CAPABILITY_LABELS[m.capability] ?? m.capability}
                  </p>
                </div>
                {known.has(m.modelId) ? (
                  <span className="text-sm text-muted-foreground">Déjà ajouté</span>
                ) : (
                  <Button size="sm" variant="outline" disabled={pending === m.modelId} onClick={() => add(m)}>
                    {pending === m.modelId ? <Loader2 className="animate-spin" /> : <Plus />} Ajouter
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
