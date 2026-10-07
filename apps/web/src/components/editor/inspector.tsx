'use client';

import { ASPECT_RATIOS, type Clip, clipDuration, isAudible, isVisual, sequenceDuration, type Track, TRACK_KINDS, type TrackKind } from '@regie/core';
import { useQuery } from '@tanstack/react-query';
import { Copy, ExternalLink, Scissors, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { Choice } from '@/components/common/choice';
import { AreaField, NumberField, TextField } from '@/components/common/fields';
import { TypeIcon } from '@/components/common/media';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { get } from '@/lib/client';
import { actions } from './actions';
import { setFormat, updateClip } from './ops';
import { mediaDuration, useEditor } from './store';
import { humanDuration, round3, timecode } from './time';

// L'inspecteur : le clip sélectionné, sinon les réglages de la séquence.

export type ProjectInfo = { aspectRatio: string; resolution?: string | null; fps?: number };

const selectedClip = (s: ReturnType<typeof useEditor.getState>) => {
  if (s.selection.length !== 1 || !s.doc) return null;
  for (const t of s.doc.tracks) for (const c of t.clips) if (c.id === s.selection[0]) return c;
  return null;
};
const selectedTrack = (s: ReturnType<typeof useEditor.getState>) => {
  if (s.selection.length !== 1 || !s.doc) return null;
  return s.doc.tracks.find((t) => t.clips.some((c) => c.id === s.selection[0])) ?? null;
};

export function Inspector({ projectId, project }: { projectId: string; project?: ProjectInfo }) {
  const count = useEditor((s) => s.selection.length);
  const clip = useEditor(selectedClip);
  const track = useEditor(selectedTrack);
  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="flex h-10 shrink-0 items-center border-b px-3 text-sm font-medium">{clip ? 'Clip' : count > 1 ? 'Sélection' : 'Séquence'}</div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {clip && track ? <ClipPanel key={clip.id} clip={clip} track={track} projectId={projectId} /> : count > 1 ? <MultiPanel count={count} /> : <SequencePanel project={project} />}
      </div>
    </div>
  );
}

const Section = ({ title, children }: { title?: string; children: React.ReactNode }) => (
  <section className="space-y-3 border-b px-3 py-3.5">
    {title && <h3 className="text-xs font-medium text-muted-foreground">{title}</h3>}
    {children}
  </section>
);

function ClipPanel({ clip, track, projectId }: { clip: Clip; track: Track; projectId: string }) {
  const media = useEditor((s) => (clip.assetId ? s.media[clip.assetId] : null));
  const fps = useEditor((s) => s.doc?.fps ?? 24);
  const known = useEditor((s) => (clip.assetId ? s.media[clip.assetId]?.durationSec || s.durations[clip.assetId] || null : null));
  const change = (field: string, fn: (c: Clip) => Clip) => useEditor.getState().commit((d) => updateClip(d, clip.id, fn), { coalesce: `${clip.id}:${field}` });
  const dur = clipDuration(clip);
  const still = !clip.assetId || media?.type === 'IMAGE';
  const maxOut = mediaDuration(clip.assetId);
  const sub = track.kind === 'SUBTITLE';
  const visual = isVisual(track.kind);
  const hasSound = isAudible(track.kind) || (visual && media?.type === 'VIDEO');
  const hint = (t: number) => <span className="font-mono tabular-nums">{timecode(t, fps)}</span>;

  const setDuration = (v: number) =>
    change('dur', (c) => {
      let out = c.inSec + Math.max(0.1, v);
      if (!still && maxOut) out = Math.min(out, maxOut);
      return { ...c, outSec: round3(out) };
    });

  return (
    <>
      <Section>
        {sub ? <AreaField label="Texte" value={clip.text ?? ''} onChange={(v) => change('text', (c) => ({ ...c, text: v }))} rows={3} /> : <TextField label="Nom" value={clip.name ?? ''} onChange={(v) => change('name', (c) => ({ ...c, name: v || null }))} placeholder={media?.name} />}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {media ? (
            <>
              <TypeIcon type={media.type} className="size-3.5 shrink-0" />
              <span className="min-w-0 flex-1 truncate" title={media.name}>
                {media.name}
              </span>
              {known && <span className="shrink-0 text-xs tabular-nums">{humanDuration(known)}</span>}
            </>
          ) : clip.assetId ? (
            <span className="text-destructive">Média introuvable (supprimé des assets ?)</span>
          ) : (
            <span>Sous-titre · piste {track.name}</span>
          )}
        </div>
        {media && <p className="text-xs text-muted-foreground">Piste {track.name} · {TRACK_KINDS[track.kind as TrackKind]?.label}</p>}
      </Section>

      <Section title="Temps">
        <div className="grid grid-cols-2 gap-3">
          <NumberField label="Début" value={clip.startSec} step={1 / fps} min={0} suffix="s" hint={hint(clip.startSec)} onChange={(v) => v !== null && change('start', (c) => ({ ...c, startSec: round3(Math.max(0, v)) }))} />
          <NumberField label="Durée" value={round3(dur)} step={1 / fps} min={0.1} suffix="s" hint={hint(dur)} onChange={(v) => v !== null && setDuration(v)} />
          {!still && (
            <>
              <NumberField label="Entrée" value={clip.inSec} step={1 / fps} min={0} suffix="s" hint="dans le média" onChange={(v) => v !== null && change('in', (c) => ({ ...c, inSec: round3(Math.max(0, Math.min(v, c.outSec - 0.1))) }))} />
              <NumberField
                label="Sortie"
                value={clip.outSec}
                step={1 / fps}
                min={0.1}
                max={maxOut ?? undefined}
                suffix="s"
                hint={maxOut ? `max ${maxOut.toFixed(2).replace('.', ',')} s` : 'dans le média'}
                onChange={(v) => v !== null && change('out', (c) => ({ ...c, outSec: round3(Math.max(c.inSec + 0.1, maxOut ? Math.min(v, maxOut) : v)) }))}
              />
            </>
          )}
        </div>
      </Section>

      {(visual || hasSound) && (
        <Section title={visual ? 'Image et son' : 'Son'}>
          {visual && (
            <SliderRow label="Opacité" value={clip.opacity} max={1} onChange={(v) => change('opacity', (c) => ({ ...c, opacity: v }))} />
          )}
          {hasSound && <SliderRow label="Volume" value={clip.volume} max={2} onChange={(v) => change('volume', (c) => ({ ...c, volume: v }))} hint={clip.volume > 1 ? 'Au-delà de 100 %, l’aperçu plafonne ; le rendu applique le gain.' : undefined} />}
          <div className="grid grid-cols-2 gap-3">
            <NumberField label="Fondu d’entrée" value={clip.fadeInSec} step={0.1} min={0} suffix="s" onChange={(v) => change('fin', (c) => ({ ...c, fadeInSec: round3(Math.max(0, Math.min(v ?? 0, clipDuration(c)))) }))} />
            <NumberField label="Fondu de sortie" value={clip.fadeOutSec} step={0.1} min={0} suffix="s" onChange={(v) => change('fout', (c) => ({ ...c, fadeOutSec: round3(Math.max(0, Math.min(v ?? 0, clipDuration(c)))) }))} />
          </div>
        </Section>
      )}

      {clip.shotId && <ShotLink projectId={projectId} shotId={clip.shotId} />}

      <Section>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={actions.split}>
            <Scissors /> Couper
          </Button>
          <Button variant="outline" size="sm" onClick={actions.duplicate}>
            <Copy /> Dupliquer
          </Button>
          <Button variant="outline" size="sm" onClick={actions.remove} className="text-destructive hover:text-destructive">
            <Trash2 /> Supprimer
          </Button>
        </div>
      </Section>
    </>
  );
}

function SliderRow({ label, value, max, onChange, hint }: { label: string; value: number; max: number; onChange: (v: number) => void; hint?: string }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <span className="text-xs text-muted-foreground tabular-nums">{Math.round(value * 100)} %</span>
      </div>
      <Slider min={0} max={max} step={0.01} value={[value]} onValueChange={([v]) => onChange(v)} aria-label={label} />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function ShotLink({ projectId, shotId }: { projectId: string; shotId: string }) {
  const { data, isError } = useQuery({ queryKey: ['project', projectId, `shots/${shotId}`], queryFn: () => get<{ id: string; code: string; sceneId: string; action?: string | null; description?: string | null }>(`/api/projects/${projectId}/shots/${shotId}`), staleTime: 60_000 });
  return (
    <Section title="Plan d’origine">
      {isError ? (
        <p className="text-sm text-muted-foreground">Ce plan n’existe plus dans le découpage.</p>
      ) : !data ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : (
        <Link href={`/projects/${projectId}/scenes/${data.sceneId}?shot=${data.id}`} className="group flex items-start gap-2 rounded-md border px-2.5 py-2 hover:bg-accent">
          <span className="font-mono text-sm font-medium">{data.code}</span>
          <span className="line-clamp-2 min-w-0 flex-1 text-sm text-muted-foreground">{data.action || data.description || 'Ouvrir le plan'}</span>
          <ExternalLink className="mt-0.5 size-3.5 shrink-0 text-muted-foreground group-hover:text-foreground" />
        </Link>
      )}
    </Section>
  );
}

function MultiPanel({ count }: { count: number }) {
  return (
    <Section>
      <p className="text-sm">{count} clips sélectionnés</p>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={actions.duplicate}>
          <Copy /> Dupliquer
        </Button>
        <Button variant="outline" size="sm" onClick={actions.remove} className="text-destructive hover:text-destructive">
          <Trash2 /> Supprimer
        </Button>
        <Button variant="ghost" size="sm" onClick={() => useEditor.getState().select([])}>
          Désélectionner
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Glissez l’un des clips pour déplacer toute la sélection.</p>
    </Section>
  );
}

const SHORTCUTS: [string, string][] = [
  ['Espace', 'Lecture / pause'],
  ['J · K · L', 'Arrière · stop · avant (répéter pour accélérer)'],
  ['← →', 'Image précédente / suivante (Maj : 1 s)'],
  ['↑ ↓', 'Coupe précédente / suivante'],
  ['Début · Fin', 'Début / fin de la séquence'],
  ['S ou Ctrl+K', 'Couper à la tête de lecture'],
  ['Suppr', 'Supprimer la sélection'],
  ['Ctrl+D', 'Dupliquer'],
  ['Ctrl+Z · Ctrl+Maj+Z', 'Annuler · rétablir'],
  ['Ctrl+A', 'Tout sélectionner'],
  ['N', 'Aimantation (Alt pendant un geste : l’inverse)'],
  ['+ · − · Maj+Z', 'Zoom · ajuster'],
  ['Ctrl + molette', 'Zoom sous la souris'],
];

function SequencePanel({ project }: { project?: ProjectInfo }) {
  const doc = useEditor((s) => s.doc);
  if (!doc) return null;
  const commit = (fn: Parameters<ReturnType<typeof useEditor.getState>['commit']>[0], key?: string) => useEditor.getState().commit(fn, key ? { coalesce: key } : undefined);
  const clips = doc.tracks.reduce((n, t) => n + t.clips.length, 0);
  return (
    <>
      <Section>
        <TextField label="Nom" value={doc.name} onChange={(v) => v.trim() && commit((d) => ({ ...d, name: v.trim() }), 'seq:name')} />
        <div className="grid grid-cols-2 gap-3">
          <Choice label="Cadence" value={String(doc.fps)} onChange={(v) => v && commit((d) => ({ ...d, fps: Number(v) }))} options={[24, 25, 30, 48, 50, 60].map((n) => ({ value: String(n), label: `${n} i/s` }))} />
          <Choice
            label="Format"
            value={doc.aspectRatio}
            allowNone
            noneLabel={`Projet (${project?.aspectRatio ?? '16:9'})`}
            onChange={(v) => commit((d) => setFormat(d, v, { aspectRatio: project?.aspectRatio ?? '16:9', resolution: project?.resolution }))}
            options={ASPECT_RATIOS.map((r) => ({ value: r, label: r }))}
          />
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted-foreground">Image</dt>
          <dd className="tabular-nums">
            {doc.width} × {doc.height}
          </dd>
          <dt className="text-muted-foreground">Durée</dt>
          <dd className="tabular-nums">
            {timecode(sequenceDuration(doc), doc.fps)} <span className="text-muted-foreground">({humanDuration(sequenceDuration(doc))})</span>
          </dd>
          <dt className="text-muted-foreground">Clips</dt>
          <dd className="tabular-nums">{clips}</dd>
        </dl>
      </Section>
      <Section title="Raccourcis clavier">
        <dl className="space-y-1.5 text-[13px]">
          {SHORTCUTS.map(([k, v]) => (
            <div key={k} className="flex gap-3">
              <dt className="w-28 shrink-0 font-mono text-xs leading-5 text-foreground">{k}</dt>
              <dd className="text-muted-foreground">{v}</dd>
            </div>
          ))}
        </dl>
      </Section>
    </>
  );
}
