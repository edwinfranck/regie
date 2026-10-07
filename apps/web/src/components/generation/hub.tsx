'use client';

import { ASPECT_RATIOS, MOVES } from '@regie/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, CircleAlert, ImagePlus, Loader2, Sparkles, X } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useBible, useProject, useProjectData, useProjectId } from '@/hooks/use-project';
import { ApiError, get, post, toastError } from '@/lib/client';
import { cn, fmtUsd } from '@/lib/utils';
import { Choice, PillPicker } from '../common/choice';
import { NumberField, TextField } from '../common/fields';
import { AssetThumb } from '../common/media';
import { ModelPicker, useModels } from '../common/model-picker';
import { EmptyState } from '../common/page-header';
import { AssetPicker } from './asset-picker';
import { GenerationCard, type GenerationRow } from './generation-card';
import { CAPABILITY_MODES, type InputRole, MODE_INPUTS, type MediaCapability, modeLabel, nextRole, ROLE_LABELS } from './modes';
import { PromptHelpers } from './prompt-helpers';

interface Input {
  assetId: string;
  role: InputRole;
  type: string;
  label?: string;
}

interface Form {
  mode: string;
  prompt: string;
  negative: string;
  modelId: string;
  aspectRatio: string | null;
  quality: 'draft' | 'standard' | 'high';
  resolution: string | null;
  steps: number | null;
  cfg: number | null;
  seed: number | null;
  count: number;
  durationSec: number;
  fps: number | null;
  cameraMovement: string | null;
  motionStrength: number | null;
  voiceId: string;
  audioDuration: number | null;
  inputs: Input[];
  characterIds: string[];
  locationId: string | null;
  sceneId: string | null;
  shotId: string | null;
}

const blank = (capability: MediaCapability): Form => ({
  mode: CAPABILITY_MODES[capability][0],
  prompt: '',
  negative: '',
  modelId: 'auto',
  aspectRatio: null,
  quality: 'standard',
  resolution: null,
  steps: null,
  cfg: null,
  seed: null,
  count: 1,
  durationSec: 5,
  fps: null,
  cameraMovement: null,
  motionStrength: null,
  voiceId: '',
  audioDuration: null,
  inputs: [],
  characterIds: [],
  locationId: null,
  sceneId: null,
  shotId: null,
});

const QUALITY = [
  { value: 'draft', label: 'Brouillon', hint: 'rapide, peu coûteux' },
  { value: 'standard', label: 'Standard' },
  { value: 'high', label: 'Haute' },
];
const VIDEO_RES = ['480p', '720p', '1080p'];
const DURATIONS = [3, 4, 5, 6, 8, 10, 12, 15];
const FPS = [24, 25, 30];

/** Garde les entrées compatibles avec un mode, en réattribuant les rôles devenus invalides. */
function fitInputs(mode: string, inputs: Input[]): Input[] {
  const spec = MODE_INPUTS[mode];
  if (!spec?.max) return [];
  const out: Input[] = [];
  for (const i of inputs) {
    if (out.length >= spec.max) break;
    out.push(spec.roles.includes(i.role) ? i : { ...i, role: nextRole(mode, out) });
  }
  return out;
}

/**
 * Le poste de génération commun aux pages Images, Vidéos et Audio :
 * formulaire à gauche, file et résultats à droite. Rien n'est affiché qui
 * ne vienne du serveur : la file est la liste réelle des générations.
 */
export function GenerationHub({ capability }: { capability: MediaCapability }) {
  const projectId = useProjectId();
  const qc = useQueryClient();
  const search = useSearchParams();
  const { data: project } = useProject();
  const [form, setForm] = useState<Form>(() => blank(capability));
  const [picker, setPicker] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [linksOpen, setLinksOpen] = useState(false);
  const [submitError, setSubmitError] = useState<ApiError | Error | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'failed' | 'done'>('all');
  const highlight = search.get('generation');
  const set = useCallback((p: Partial<Form>) => setForm((f) => ({ ...f, ...p })), []);

  // Paramètres d'URL : ?prompt, ?from (première image / image de départ), ?generation (surlignée).
  const applied = useRef(false);
  useEffect(() => {
    if (applied.current) return;
    applied.current = true;
    const prompt = search.get('prompt');
    const from = search.get('from');
    const patch: Partial<Form> = {};
    if (prompt) patch.prompt = prompt;
    if (from && capability === 'VIDEO') Object.assign(patch, { mode: 'image-to-video', inputs: [{ assetId: from, role: 'first_frame', type: 'IMAGE' }] });
    if (from && capability === 'IMAGE') Object.assign(patch, { mode: 'image-to-image', inputs: [{ assetId: from, role: 'init', type: 'IMAGE' }] });
    if (Object.keys(patch).length) set(patch);
  }, [search, capability, set]);

  const { data: models = [] } = useModels(capability);
  const model = models.find((m) => m.id === form.modelId);
  const characters = useBible('characters').data ?? [];
  const locations = useBible('locations').data ?? [];
  const scenesData = useProjectData<{ scenes: any[] }>('scenes').data;
  const scenes = scenesData?.scenes ?? [];
  const shots = useMemo(() => scenes.filter((s) => !form.sceneId || s.id === form.sceneId).flatMap((s) => (s.shots ?? []).map((sh: any) => ({ ...sh, sceneNumber: s.number }))), [scenes, form.sceneId]);

  const genKey = ['generations', projectId, capability];
  const { data: gens, isLoading: gensLoading } = useQuery({
    queryKey: genKey,
    queryFn: () => get<{ items: GenerationRow[] }>(`/api/projects/${projectId}/generations?capability=${capability}&take=60`),
    enabled: !!projectId,
  });
  const items = gens?.items ?? [];
  const shown = items.filter((g) => (filter === 'all' ? true : filter === 'active' ? g.status === 'QUEUED' || g.status === 'PROCESSING' : filter === 'failed' ? g.status === 'FAILED' : g.status === 'COMPLETED'));
  const counts = { active: items.filter((g) => g.status === 'QUEUED' || g.status === 'PROCESSING').length, failed: items.filter((g) => g.status === 'FAILED').length };

  // Faire défiler jusqu'à la génération demandée dans l'URL, une fois chargée.
  const scrolled = useRef(false);
  useEffect(() => {
    if (!highlight || scrolled.current || !items.some((g) => g.id === highlight)) return;
    scrolled.current = true;
    requestAnimationFrame(() => document.getElementById(`gen-${highlight}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  }, [highlight, items]);

  const spec = MODE_INPUTS[form.mode] ?? { roles: [], required: [], max: 0 };
  const missing = spec.required.filter((r) => !form.inputs.some((i) => i.role === r));
  const ratio = form.aspectRatio ?? project?.aspectRatio ?? '16:9';
  const audioSeconds = form.mode === 'text-to-speech' ? null : form.audioDuration;
  const units = capability === 'VIDEO' ? form.durationSec : capability === 'IMAGE' ? form.count : (audioSeconds ?? 1);
  const quote = model?.pricing?.usd === undefined ? null : model.pricing.unit === 'second' ? model.pricing.usd * units : model.pricing.unit === 'image' ? model.pricing.usd * form.count : model.pricing.unit === '1k_chars' ? (model.pricing.usd * form.prompt.length) / 1000 : model.pricing.usd;

  function buildParams() {
    const p: Record<string, unknown> = {};
    if (capability === 'IMAGE') Object.assign(p, { aspectRatio: ratio, quality: form.quality, count: form.count, steps: form.steps ?? undefined, cfg: form.cfg ?? undefined, seed: form.seed ?? undefined });
    if (capability === 'VIDEO')
      Object.assign(p, {
        aspectRatio: ratio,
        durationSec: form.durationSec,
        resolution: form.resolution ?? undefined,
        cameraMovement: form.cameraMovement ?? undefined,
        motionStrength: form.motionStrength ?? undefined,
        seed: form.seed ?? undefined,
        fps: form.fps ?? undefined,
      });
    if (capability === 'AUDIO') Object.assign(p, { voiceId: form.mode === 'text-to-speech' && form.voiceId.trim() ? form.voiceId.trim() : undefined, durationSec: audioSeconds ?? undefined });
    return Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined));
  }

  const run = useMutation({
    mutationFn: () =>
      post<GenerationRow>(`/api/projects/${projectId}/generations`, {
        capability,
        mode: form.mode,
        modelId: form.modelId,
        prompt: form.prompt,
        negative: form.negative.trim() || undefined,
        shotId: form.shotId,
        inputAssetIds: form.inputs.map((i) => i.assetId),
        inputRoles: form.inputs.map((i) => i.role),
        links: { characterIds: form.characterIds.length ? form.characterIds : undefined, locationId: form.locationId, sceneId: form.sceneId },
        params: buildParams(),
      }),
    onMutate: () => setSubmitError(null),
    onSuccess: (g) => {
      toast.success('Génération en file', { description: `${g.model?.label ?? 'Modèle'} · ${g.provider?.name ?? ''}` });
      qc.setQueryData(genKey, (old: any) => (old?.items ? { ...old, items: [g, ...old.items.filter((x: GenerationRow) => x.id !== g.id)] } : old));
      qc.invalidateQueries({ queryKey: ['generations'] });
      setFilter('all');
    },
    onError: (e) => {
      setSubmitError(e);
      toastError(e, 'Génération refusée');
    },
  });

  function reuse(g: GenerationRow) {
    const p = g.params ?? {};
    const roles: string[] = p.inputRoles ?? [];
    setForm({
      ...blank(capability),
      mode: g.mode,
      prompt: g.prompt,
      negative: g.negative ?? '',
      modelId: g.model && models.some((m) => m.id === g.model!.id) ? g.model.id : 'auto',
      aspectRatio: p.aspectRatio ?? null,
      quality: p.quality ?? 'standard',
      resolution: p.resolution ?? null,
      steps: p.steps ?? null,
      cfg: p.cfg ?? null,
      seed: p.seed ?? null,
      count: p.count ?? 1,
      durationSec: capability === 'VIDEO' ? (p.durationSec ?? 5) : 5,
      fps: p.fps ?? null,
      cameraMovement: p.cameraMovement ?? null,
      motionStrength: p.motionStrength ?? null,
      voiceId: p.voiceId ?? '',
      audioDuration: capability === 'AUDIO' ? (p.durationSec ?? null) : null,
      inputs: g.inputAssetIds.map((id, i) => ({ assetId: id, role: (roles[i] ?? 'reference') as InputRole, type: 'IMAGE' })),
      characterIds: p.links?.characterIds ?? [],
      locationId: p.links?.locationId ?? null,
      sceneId: p.links?.sceneId ?? null,
      shotId: g.shotId ?? null,
    });
    setSubmitError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    toast.message('Réglages rechargés', { description: 'Modifiez puis relancez.' });
  }

  const addInputs = (list: { assetId: string; type: string; label?: string }[]) =>
    setForm((f) => {
      const next = [...f.inputs];
      for (const a of list) {
        if (next.length >= spec.max || next.some((i) => i.assetId === a.assetId)) continue;
        next.push({ assetId: a.assetId, type: a.type, label: a.label, role: nextRole(f.mode, next) });
      }
      return { ...f, inputs: next };
    });

  const canSubmit = !!form.prompt.trim() && missing.length === 0 && !run.isPending;
  const hasLinks = form.characterIds.length || form.locationId || form.sceneId || form.shotId;

  return (
    <div className="grid gap-6 p-8 xl:grid-cols-[minmax(380px,460px)_1fr]">
      {/* ── Formulaire ── */}
      <section className="min-w-0 xl:sticky xl:top-14 xl:max-h-[calc(100vh-4.5rem)] xl:self-start xl:overflow-y-auto">
        <div className="space-y-5 rounded-md border bg-card p-4">
          <div className="space-y-1.5">
            <Label>Mode</Label>
            <div className={cn('grid gap-1.5', CAPABILITY_MODES[capability].length === 3 ? 'grid-cols-3' : 'grid-cols-2')} role="radiogroup">
              {CAPABILITY_MODES[capability].map((m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={form.mode === m}
                  onClick={() => setForm((f) => ({ ...f, mode: m, inputs: fitInputs(m, f.inputs) }))}
                  className={cn('rounded-sm border px-2 py-1.5 text-sm transition-colors', form.mode === m ? 'border-foreground bg-foreground text-background' : 'hover:bg-accent')}
                >
                  {modeLabel(m)}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="prompt">{form.mode === 'text-to-speech' ? 'Texte à dire' : 'Prompt'}</Label>
            <Textarea
              id="prompt"
              value={form.prompt}
              onChange={(e) => set({ prompt: e.target.value })}
              rows={9}
              placeholder={capability === 'AUDIO' ? (form.mode === 'text-to-speech' ? 'Le texte, tel qu’il doit être prononcé.' : 'Décrivez le son : source, matière, distance, durée…') : 'Décrivez l’image. Citez les personnages et lieux de la bible par leur nom ou leur code (CH1, L2).'}
              className="min-h-40 resize-y font-mono text-[12.5px] leading-relaxed"
            />
            {capability !== 'AUDIO' && (
              <PromptHelpers
                text={form.prompt}
                kind={capability === 'VIDEO' ? 'video' : 'image'}
                onApply={({ text, negative }) => setForm((f) => ({ ...f, prompt: text, negative: negative?.length ? [...new Set([...f.negative.split(',').map((s) => s.trim()).filter(Boolean), ...negative])].join(', ') : f.negative }))}
                onAddRefs={(refs) => addInputs(refs.map((r) => ({ assetId: r.assetId, type: 'IMAGE', label: r.label })))}
                onDetected={(d) => setForm((f) => ({ ...f, characterIds: [...new Set([...f.characterIds, ...d.characters])], locationId: f.locationId ?? d.locations[0] ?? null }))}
              />
            )}
          </div>

          {capability !== 'AUDIO' && (
            <div className="space-y-1.5">
              <Label htmlFor="negative">À éviter</Label>
              <Textarea id="negative" value={form.negative} onChange={(e) => set({ negative: e.target.value })} rows={2} placeholder="Negative prompt : ce que le modèle ne doit pas produire." className="resize-y font-mono text-[12.5px]" />
            </div>
          )}

          <ModelPicker capability={capability} mode={form.mode} value={form.modelId} onChange={(v) => set({ modelId: v })} />

          {/* Paramètres selon la capacité */}
          {capability === 'IMAGE' && (
            <div className="grid grid-cols-2 gap-3">
              <Choice label="Format" value={ratio} onChange={(v) => set({ aspectRatio: v })} options={ASPECT_RATIOS.map((r) => ({ value: r, label: r }))} />
              <Choice label="Qualité" value={form.quality} onChange={(v) => v && set({ quality: v as Form['quality'] })} options={QUALITY} />
              <Choice label="Nombre" value={String(form.count)} onChange={(v) => v && set({ count: Number(v) })} options={[1, 2, 3, 4].map((n) => ({ value: String(n), label: `${n} image${n > 1 ? 's' : ''}` }))} />
            </div>
          )}
          {capability === 'VIDEO' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Choice label="Durée" value={String(form.durationSec)} onChange={(v) => v && set({ durationSec: Number(v) })} options={DURATIONS.filter((d) => !model?.maxDuration || d <= model.maxDuration).map((d) => ({ value: String(d), label: `${d} s` }))} />
                <Choice label="Format" value={ratio} onChange={(v) => set({ aspectRatio: v })} options={ASPECT_RATIOS.map((r) => ({ value: r, label: r }))} />
                <Choice label="Résolution" value={form.resolution} onChange={(v) => set({ resolution: v })} allowNone noneLabel="Par défaut du modèle" options={VIDEO_RES.map((r) => ({ value: r, label: r }))} />
                <Choice label="Caméra" value={form.cameraMovement} onChange={(v) => set({ cameraMovement: v })} allowNone noneLabel="Selon le prompt" options={Object.entries(MOVES).map(([k, m]) => ({ value: k, label: m.fr }))} />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Intensité du mouvement</Label>
                  <button type="button" className="text-xs text-muted-foreground underline-offset-2 hover:underline" onClick={() => set({ motionStrength: form.motionStrength === null ? 0.5 : null })}>
                    {form.motionStrength === null ? 'par défaut — régler' : `${Math.round(form.motionStrength * 100)} % — réinitialiser`}
                  </button>
                </div>
                <Slider value={[form.motionStrength ?? 0.5]} min={0} max={1} step={0.05} onValueChange={([v]) => set({ motionStrength: v })} className={cn(form.motionStrength === null && 'opacity-40')} />
              </div>
            </div>
          )}
          {capability === 'AUDIO' && (
            <div className="grid grid-cols-2 gap-3">
              {form.mode === 'text-to-speech' ? (
                <TextField label="Voix" value={form.voiceId} onChange={(v) => set({ voiceId: v })} placeholder="Identifiant de voix du provider" className="col-span-2" mono />
              ) : (
                <NumberField label="Durée" value={form.audioDuration} onChange={(v) => set({ audioDuration: v })} min={1} max={60} suffix="s" />
              )}
            </div>
          )}

          {capability !== 'AUDIO' && (
            <Collapsible open={advanced} onOpenChange={setAdvanced}>
              <CollapsibleTrigger className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                <ChevronDown className={cn('size-4 transition-transform', !advanced && '-rotate-90')} /> Réglages avancés
              </CollapsibleTrigger>
              <CollapsibleContent className="grid grid-cols-2 gap-3 pt-3">
                {capability === 'IMAGE' && (
                  <>
                    <NumberField label="Steps" value={form.steps} onChange={(v) => set({ steps: v })} min={1} max={200} />
                    <NumberField label="CFG" value={form.cfg} onChange={(v) => set({ cfg: v })} min={0} max={40} step={0.5} />
                  </>
                )}
                {capability === 'VIDEO' && <Choice label="Images/s" value={form.fps ? String(form.fps) : null} onChange={(v) => set({ fps: v ? Number(v) : null })} allowNone noneLabel="Par défaut" options={FPS.map((f) => ({ value: String(f), label: `${f} i/s` }))} />}
                <NumberField label="Seed" hint="Vide = aléatoire" value={form.seed} onChange={(v) => set({ seed: v === null ? null : Math.max(0, Math.round(v)) })} min={0} />
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Entrées */}
          {spec.max > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>
                  {spec.required.length ? 'Images d’entrée' : 'Références'} ({form.inputs.length}/{spec.max})
                </Label>
                <Button type="button" variant="outline" size="xs" onClick={() => setPicker(true)} disabled={form.inputs.length >= spec.max}>
                  <ImagePlus /> Ajouter
                </Button>
              </div>
              {form.inputs.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  {spec.required.length ? `Ce mode demande : ${spec.required.map((r) => ROLE_LABELS[r].toLowerCase()).join(' et ')}.` : 'Aucune référence. Le texte seul ne fige ni un visage ni un costume.'}
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {form.inputs.map((i, n) => (
                    <li key={i.assetId} className="flex items-center gap-2">
                      <AssetThumb asset={{ id: i.assetId, type: i.type }} ratio="1:1" className="size-12 shrink-0 rounded-sm" />
                      <div className="min-w-0 flex-1">
                        {spec.roles.length > 1 ? (
                          <Choice value={i.role} onChange={(v) => v && set({ inputs: form.inputs.map((x, k) => (k === n ? { ...x, role: v as InputRole } : x)) })} options={spec.roles.map((r) => ({ value: r, label: ROLE_LABELS[r] }))} triggerClassName="h-8" />
                        ) : (
                          <span className="text-sm">{ROLE_LABELS[i.role]}</span>
                        )}
                        {i.label && <p className="truncate text-xs text-muted-foreground">{i.label}</p>}
                      </div>
                      <Button type="button" variant="ghost" size="icon-sm" onClick={() => set({ inputs: form.inputs.filter((_, k) => k !== n) })} aria-label="Retirer">
                        <X />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              {missing.length > 0 && form.inputs.length > 0 && <p className="text-xs text-warning">Il manque : {missing.map((r) => ROLE_LABELS[r].toLowerCase()).join(', ')}.</p>}
            </div>
          )}

          {/* Rattachement */}
          <Collapsible open={linksOpen} onOpenChange={setLinksOpen}>
            <CollapsibleTrigger className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              <ChevronDown className={cn('size-4 transition-transform', !linksOpen && '-rotate-90')} /> Rattacher le résultat à…
              {hasLinks ? <span className="ml-1 rounded-sm bg-secondary px-1.5 text-xs text-foreground">actif</span> : null}
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pt-3">
              <PillPicker label="Personnages" value={form.characterIds} onChange={(v) => set({ characterIds: v })} options={characters.map((c: any) => ({ value: c.id, label: c.code ? `${c.code} ${c.name}` : c.name }))} />
              <div className="grid grid-cols-2 gap-3">
                <Choice label="Lieu" value={form.locationId} onChange={(v) => set({ locationId: v })} allowNone options={locations.map((l: any) => ({ value: l.id, label: l.name, hint: l.code }))} />
                <Choice label="Scène" value={form.sceneId} onChange={(v) => set({ sceneId: v, shotId: null })} allowNone noneLabel="Aucune" options={scenes.map((s: any) => ({ value: s.id, label: `${s.number}. ${s.title || 'Sans titre'}` }))} />
                <Choice label="Plan" value={form.shotId} onChange={(v) => set({ shotId: v })} allowNone className="col-span-2" options={shots.map((s: any) => ({ value: s.id, label: s.code, hint: `scène ${s.sceneNumber}` }))} />
              </div>
            </CollapsibleContent>
          </Collapsible>

          {submitError && (
            <div className="space-y-1.5 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
              <p className="flex items-center gap-2 font-medium text-destructive">
                <CircleAlert className="size-4 shrink-0" /> {submitError.message}
              </p>
              {submitError instanceof ApiError && submitError.action && (
                <Button size="sm" variant="outline" asChild>
                  <Link href={submitError.action.href}>{submitError.action.label}</Link>
                </Button>
              )}
            </div>
          )}

          <div className="flex items-center justify-between gap-3 border-t pt-4">
            <span className="text-sm text-muted-foreground">{form.modelId === 'auto' ? 'Coût selon le modèle choisi par le routeur' : quote !== null ? `Coût estimé : ${fmtUsd(quote)}` : 'Coût inconnu pour ce modèle'}</span>
            <Button onClick={() => run.mutate()} disabled={!canSubmit} className="bg-signal text-signal-foreground hover:bg-signal/90">
              {run.isPending ? <Loader2 className="animate-spin" /> : <Sparkles />} Générer
            </Button>
          </div>
          {missing.length > 0 && <p className="-mt-3 text-right text-xs text-muted-foreground">Ajoutez d’abord : {missing.map((r) => ROLE_LABELS[r].toLowerCase()).join(', ')}.</p>}
        </div>
      </section>

      {/* ── File et résultats ── */}
      <section className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-medium">File et résultats</h2>
          <ToggleGroup type="single" variant="outline" size="sm" value={filter} onValueChange={(v) => v && setFilter(v as typeof filter)}>
            <ToggleGroupItem value="all" className="px-3">
              Tout
            </ToggleGroupItem>
            <ToggleGroupItem value="active" className="px-3">
              En cours{counts.active ? ` (${counts.active})` : ''}
            </ToggleGroupItem>
            <ToggleGroupItem value="failed" className="px-3">
              Échecs{counts.failed ? ` (${counts.failed})` : ''}
            </ToggleGroupItem>
            <ToggleGroupItem value="done" className="px-3">
              Terminées
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
        {gensLoading ? (
          <p className="text-sm text-muted-foreground">Chargement de la file…</p>
        ) : shown.length === 0 ? (
          <EmptyState
            title={items.length ? 'Rien dans ce filtre' : 'Aucune génération pour l’instant'}
            description={items.length ? 'Changez de filtre pour voir les autres générations.' : 'Les générations lancées ici apparaissent dans cette file, avec leur statut en direct. Les résultats rejoignent aussi les assets du projet.'}
          />
        ) : (
          <div className="space-y-3">
            {shown.map((g) => (
              <GenerationCard key={g.id} g={g} highlighted={g.id === highlight} onReuse={reuse} />
            ))}
          </div>
        )}
      </section>

      <AssetPicker
        open={picker}
        onOpenChange={setPicker}
        max={Math.max(1, spec.max - form.inputs.length)}
        title={missing[0] ? `Choisir : ${ROLE_LABELS[missing[0]].toLowerCase()}` : 'Choisir des références'}
        onPick={(list) => addInputs(list.map((a) => ({ assetId: a.id, type: a.type, label: a.name })))}
      />
    </div>
  );
}
