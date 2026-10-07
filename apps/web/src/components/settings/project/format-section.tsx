'use client';

import { ASPECT_RATIOS, KIND_LABELS } from '@regie/core';
import { Choice } from '@/components/common/choice';
import { NumberField, TextField } from '@/components/common/fields';
import { Panel } from '@/components/common/page-header';
import { useProjectPatch } from './shared';

const RESOLUTIONS = ['1280x720', '1920x1080', '2560x1440', '3840x2160', '2048x858', '4096x1716', '1080x1920', '1080x1350', '1080x1080'];
const LANGUAGES: Record<string, string> = { fr: 'Français', en: 'Anglais', es: 'Espagnol', de: 'Allemand', it: 'Italien', pt: 'Portugais', nl: 'Néerlandais', ar: 'Arabe', ja: 'Japonais', zh: 'Chinois', ko: 'Coréen' };
const withCurrent = (list: string[], v?: string | null) => (v && !list.includes(v) ? [v, ...list] : list);

export function FormatSection({ project: p, editable }: { project: any; editable: boolean }) {
  const { set } = useProjectPatch();
  return (
    <Panel title="Format" description="Le format de sortie : il fixe le cadre de chaque image générée et le rythme du montage.">
      <fieldset disabled={!editable} className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <TextField label="Titre" value={p.title} onChange={(v) => v.trim() && set({ title: v })} className="md:col-span-2 xl:col-span-3" />
        <Choice label="Type" value={p.kind} onChange={(v) => v && set({ kind: v })} options={Object.entries(KIND_LABELS).map(([value, label]) => ({ value, label }))} disabled={!editable} />
        <Choice label="Format d’image" value={p.aspectRatio} onChange={(v) => v && set({ aspectRatio: v })} options={withCurrent([...ASPECT_RATIOS], p.aspectRatio).map((r) => ({ value: r, label: r }))} disabled={!editable} />
        <Choice label="Résolution" value={p.resolution} onChange={(v) => v && set({ resolution: v })} options={withCurrent(RESOLUTIONS, p.resolution).map((r) => ({ value: r, label: r.replace('x', ' × ') }))} disabled={!editable} />
        <NumberField label="Images par seconde" value={p.fps} onChange={(v) => v && v >= 1 && v <= 120 && set({ fps: Math.round(v) })} min={1} max={120} suffix="i/s" />
        <Choice label="Langue" hint="Langue des dialogues et du scénario. Les prompts restent en anglais." value={p.language} onChange={(v) => v && set({ language: v })} options={withCurrent(Object.keys(LANGUAGES), p.language).map((l) => ({ value: l, label: LANGUAGES[l] ?? l }))} disabled={!editable} />
      </fieldset>
    </Panel>
  );
}
