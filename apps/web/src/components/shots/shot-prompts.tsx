'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, Film, ImageIcon, Pencil, RotateCcw, ShieldAlert } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Choice } from '@/components/common/choice';
import { AssetThumb } from '@/components/common/media';
import { Code, IssueList, type IssueLike } from '@/components/common/status';
import { type CompiledPrompt, type GenerateRequest, QuickGenerate } from '@/components/generation/quick-generate';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useProjectId } from '@/hooks/use-project';
import { get, patch, toastError } from '@/lib/client';
import { useShotAssets } from './shot-media';

interface PromptsResponse {
  spec: {
    code: string;
    duration: number;
    format: { ratio: string; resolution: string };
    characters: { id: string; code: string; name: string }[];
    props: { id: string; code: string; name: string }[];
    location: { id: string; code: string; name: string } | null;
    light: { id: string; code: string; name: string } | null;
    style: { code: string; name: string };
    refs: { id: string; kind: string; assetId?: string | null; key?: string | null; why: string }[];
  };
  prompts: Record<string, CompiledPrompt>;
  targets: { id: string; label: string; kind: 'image' | 'video' }[];
  issues: IssueLike[];
}

const SHORT: Record<string, string> = { still: 'Image', veo: 'Veo', kling: 'Kling', wan: 'Wan', runway: 'Runway' };

/**
 * Le Prompt Engine appliqué au plan : ce que le compilateur a résolu, le
 * prompt final par moteur, et les deux générations naturelles du plan.
 */
export function ShotPrompts({ shot }: { shot: { id: string; sceneId: string; durationSec: number; frameAssetId?: string | null; overrides?: Record<string, string> } }) {
  const projectId = useProjectId();
  const qc = useQueryClient();
  const key = ['project', projectId, `shots/${shot.id}/prompts`];
  const { data, isLoading, error } = useQuery({ queryKey: key, queryFn: () => get<PromptsResponse>(`/api/projects/${projectId}/shots/${shot.id}/prompts`) });
  const { data: assets = [] } = useShotAssets(shot.id);
  const [tab, setTab] = useState('still');
  const [videoTarget, setVideoTarget] = useState('veo');
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [request, setRequest] = useState<GenerateRequest | null>(null);
  const [open, setOpen] = useState(false);

  if (isLoading) return <Skeleton className="h-96" />;
  if (error || !data) return <p className="text-sm text-destructive">Le prompt n’a pas pu être compilé : {(error as Error)?.message}</p>;

  const { spec, prompts, targets, issues } = data;
  const blocking = issues.filter((i) => i.blocking);
  const others = issues.filter((i) => !i.blocking);
  const videoTargets = targets.filter((t) => t.kind === 'video');
  const latestImage = assets.find((a) => a.type === 'IMAGE');
  const startFrame = shot.frameAssetId ?? latestImage?.id ?? null;
  const refInputs = spec.refs.filter((r) => r.assetId).map((r) => ({ assetId: r.assetId!, role: 'reference' }));

  async function saveOverride(target: string, text: string | null) {
    const overrides = { ...(shot.overrides ?? {}) };
    if (text === null) delete overrides[target];
    else overrides[target] = text;
    try {
      const row = await patch(`/api/projects/${projectId}/shots/${shot.id}`, { overrides });
      qc.setQueryData(['project', projectId, `shots/${shot.id}`], (old: any) => ({ ...old, overrides: row.overrides }));
      await qc.invalidateQueries({ queryKey: key });
      setEditing(null);
      toast.success(text === null ? 'Prompt compilé rétabli' : 'Prompt enregistré sur le plan');
    } catch (e) {
      toastError(e, 'Enregistrement impossible');
    }
  }

  const generate = (req: GenerateRequest) => {
    setRequest(req);
    setOpen(true);
  };
  const genImage = () => generate({ capability: 'IMAGE', mode: 'text-to-image', prompt: prompts.still, shotId: shot.id, inputs: refInputs, aspectRatio: spec.format.ratio, title: `Image du plan ${spec.code}` });
  const genVideo = () => {
    const prompt = prompts[videoTarget];
    generate(
      startFrame
        ? { capability: 'VIDEO', mode: 'image-to-video', prompt, shotId: shot.id, inputs: [{ assetId: startFrame, role: 'first_frame' }], aspectRatio: spec.format.ratio, durationSec: Math.round(shot.durationSec), title: `Vidéo du plan ${spec.code}` }
        : { capability: 'VIDEO', mode: 'text-to-video', prompt, shotId: shot.id, inputs: [], aspectRatio: spec.format.ratio, durationSec: Math.round(shot.durationSec), title: `Vidéo du plan ${spec.code} (sans image de départ)` },
    );
  };

  return (
    <div className="space-y-5">
      {blocking.length > 0 && (
        <div className="space-y-2 rounded-md border border-destructive/40 bg-destructive/5 p-3">
          <p className="flex items-center gap-2 text-sm font-medium text-destructive">
            <ShieldAlert className="size-4" /> {blocking.length} problème{blocking.length > 1 ? 's' : ''} bloquant{blocking.length > 1 ? 's' : ''} : la génération partirait sur de mauvaises bases.
          </p>
          <IssueList issues={blocking} />
        </div>
      )}
      {others.length > 0 && <IssueList issues={others} compact />}

      <section className="space-y-2">
        <h3 className="text-sm font-medium">Contexte résolu</h3>
        <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="text-muted-foreground">Personnages</dt>
          <dd>{spec.characters.length ? spec.characters.map((c) => `${c.code} ${c.name}`).join(', ') : '—'}</dd>
          {spec.props.length > 0 && (
            <>
              <dt className="text-muted-foreground">Objets</dt>
              <dd>{spec.props.map((p) => `${p.code} ${p.name}`).join(', ')}</dd>
            </>
          )}
          <dt className="text-muted-foreground">Lieu</dt>
          <dd>{spec.location?.id ? `${spec.location.code} ${spec.location.name}` : <span className="text-warning">non défini</span>}</dd>
          <dt className="text-muted-foreground">Lumière</dt>
          <dd>{spec.light ? `${spec.light.code} ${spec.light.name}` : '—'}</dd>
          <dt className="text-muted-foreground">Style</dt>
          <dd>{spec.style.code ? `${spec.style.code} ${spec.style.name}` : '—'}</dd>
          <dt className="text-muted-foreground">Format</dt>
          <dd>
            {spec.format.ratio} · {spec.format.resolution}
          </dd>
        </dl>
        <div className="space-y-1.5 pt-1">
          <p className="text-sm text-muted-foreground">Références chargées ({spec.refs.filter((r) => r.assetId).length}/{spec.refs.length})</p>
          {spec.refs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune : le texte seul ne fige ni un visage ni un décor.</p>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {spec.refs.map((r) => (
                <div key={r.id + r.kind} className="space-y-0.5" title={r.why}>
                  {r.assetId ? (
                    <AssetThumb asset={{ id: r.assetId, type: 'IMAGE' }} ratio="1:1" className="rounded-sm" />
                  ) : (
                    <div className="flex aspect-square items-center justify-center rounded-sm border border-dashed text-center text-[11px] text-muted-foreground">sans image</div>
                  )}
                  <p className="truncate text-[11px]">
                    <span className="font-mono">{r.id}</span> <span className="text-muted-foreground">{r.why}</span>
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <Tabs
        value={tab}
        onValueChange={(v) => {
          setTab(v);
          setEditing(null);
          if (targets.find((t) => t.id === v)?.kind === 'video') setVideoTarget(v);
        }}
      >
        <TabsList className="w-full">
          {targets.map((t) => (
            <TabsTrigger key={t.id} value={t.id} title={t.label}>
              {SHORT[t.id] ?? t.id}
              {prompts[t.id]?.edited && <span className="size-1.5 rounded-full bg-foreground" aria-label="réécrit" />}
            </TabsTrigger>
          ))}
        </TabsList>
        {targets.map((t) => {
          const p = prompts[t.id];
          if (!p) return null;
          return (
            <TabsContent key={t.id} value={t.id} className="space-y-3 pt-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  {t.label}
                  {p.edited && <span className="ml-1.5 rounded-sm bg-secondary px-1 text-foreground">réécrit à la main</span>}
                </p>
                <div className="flex shrink-0 gap-1">
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={() => {
                      navigator.clipboard.writeText(p.text);
                      toast.success('Prompt copié');
                    }}
                  >
                    <Copy /> Copier
                  </Button>
                  {editing !== t.id && (
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={() => {
                        setDraft(p.text);
                        setEditing(t.id);
                      }}
                    >
                      <Pencil /> Modifier
                    </Button>
                  )}
                  {p.edited && (
                    <Button size="xs" variant="ghost" onClick={() => saveOverride(t.id, null)} title="Oublier la réécriture : le prompt suivra de nouveau la bible et le plan.">
                      <RotateCcw /> Revenir au prompt compilé
                    </Button>
                  )}
                </div>
              </div>
              {editing === t.id ? (
                <div className="space-y-2">
                  <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={14} className="font-mono text-[12.5px] leading-relaxed" autoFocus />
                  <p className="text-xs text-muted-foreground">Une réécriture l’emporte sur le compilateur : elle ne suivra plus les changements de la bible.</p>
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                      Annuler
                    </Button>
                    <Button size="sm" onClick={() => saveOverride(t.id, draft)} disabled={!draft.trim()}>
                      Enregistrer sur le plan
                    </Button>
                  </div>
                </div>
              ) : (
                <pre className="max-h-96 overflow-auto rounded-md border bg-muted/40 p-3 font-mono text-[12.5px] leading-relaxed whitespace-pre-wrap">{p.text}</pre>
              )}
              {p.negative.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">À éviter</p>
                  <div className="flex flex-wrap gap-1">
                    {p.negative.map((n) => (
                      <Code key={n}>{n}</Code>
                    ))}
                  </div>
                </div>
              )}
              {p.notes.length > 0 && (
                <ul className="space-y-0.5 text-xs text-muted-foreground">
                  {p.notes.map((n) => (
                    <li key={n}>· {n}</li>
                  ))}
                </ul>
              )}
            </TabsContent>
          );
        })}
      </Tabs>

      <section className="space-y-3 border-t pt-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={genImage} className="bg-signal text-signal-foreground hover:bg-signal/90">
            <ImageIcon /> Générer l’image
          </Button>
          <span className="text-xs text-muted-foreground">prompt Image · {refInputs.length} référence{refInputs.length > 1 ? 's' : ''} · {spec.format.ratio}</span>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <Choice label="Prompt vidéo" value={videoTarget} onChange={(v) => v && setVideoTarget(v)} options={videoTargets.map((t) => ({ value: t.id, label: SHORT[t.id] ?? t.id }))} className="w-44" />
          <Button onClick={genVideo} className="bg-signal text-signal-foreground hover:bg-signal/90">
            <Film /> Générer la vidéo
          </Button>
        </div>
        {startFrame ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <AssetThumb asset={{ id: startFrame, type: 'IMAGE' }} ratio={spec.format.ratio} className="w-20 rounded-sm" />
            Image de départ : {shot.frameAssetId ? 'la case retenue du storyboard' : 'la dernière image générée du plan'}.
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Aucune image pour ce plan : la vidéo partira du texte seul (texte → vidéo), avec moins de contrôle sur les visages et le décor. Générer d’abord l’image est plus sûr.</p>
        )}
      </section>

      <QuickGenerate request={request} open={open} onOpenChange={setOpen} />
    </div>
  );
}
