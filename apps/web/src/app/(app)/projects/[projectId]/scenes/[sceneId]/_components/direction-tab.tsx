'use client';

import { CAMERA_STYLES, DIRECTION_STYLES, EMOTIONS, INSPIRATIONS, LIGHTINGS, type Preset, type PresetGroup, RHYTHMS, toRich } from '@regie/core';
import { Activity, AudioLines, Brush, Crosshair, Drama, Heart, Library, Loader2, Sparkles, Sun, Video } from 'lucide-react';
import { useState } from 'react';
import { ComboField, ComboTags, joinList, splitList } from '@/components/common/combo';
import { IconLabel } from '@/components/common/icon-label';
import { RichField } from '@/components/common/rich-field';
import { useModels, usable } from '@/components/common/model-picker';
import { Panel } from '@/components/common/page-header';
import { type ShotDraft, ShotDrafts } from '@/components/shots/shot-drafts';
import { Button } from '@/components/ui/button';
import { useAiTask } from '@/hooks/use-ai';

type SetFn = (local: Record<string, unknown>, remote?: Record<string, unknown>) => void;

type Field = { key: string; label: React.ReactNode; hint?: string } & ({ kind: 'rich'; wide?: boolean } | { kind: 'one' | 'tags'; options: Preset[] | PresetGroup[] });

// Qualités courtes en listes (saisie libre possible), intentions et jeu en éditeur riche.
const FIELDS: Field[] = [
  { key: 'intention', label: <IconLabel icon={Crosshair}>Intention</IconLabel>, hint: 'Ce que la scène doit produire chez le spectateur.', kind: 'rich', wide: true },
  { key: 'emotion', label: <IconLabel icon={Heart}>Émotion</IconLabel>, kind: 'one', options: EMOTIONS },
  { key: 'rhythm', label: <IconLabel icon={Activity}>Rythme</IconLabel>, kind: 'one', options: RHYTHMS },
  { key: 'style', label: <IconLabel icon={Brush}>Style</IconLabel>, kind: 'tags', options: DIRECTION_STYLES },
  { key: 'references', label: <IconLabel icon={Library}>Références</IconLabel>, hint: 'Films, réalisateurs, photographes, peintres.', kind: 'tags', options: INSPIRATIONS },
  { key: 'camera', label: <IconLabel icon={Video}>Caméra</IconLabel>, hint: 'La grammaire de la scène.', kind: 'tags', options: CAMERA_STYLES },
  { key: 'lighting', label: <IconLabel icon={Sun}>Lumière</IconLabel>, kind: 'tags', options: LIGHTINGS },
  { key: 'acting', label: <IconLabel icon={Drama}>Direction d’acteurs</IconLabel>, kind: 'rich', wide: true },
  { key: 'sound', label: <IconLabel icon={AudioLines}>Son</IconLabel>, kind: 'rich', wide: true },
];
const LABELS: Record<string, string> = { intention: 'Intention', emotion: 'Émotion', rhythm: 'Rythme', style: 'Style', references: 'Références', camera: 'Caméra', lighting: 'Lumière', acting: 'Direction d’acteurs', sound: 'Son' };

/** La mise en scène : les intentions du réalisateur, avant le découpage. */
export function DirectionTab({ scene, set }: { scene: any; set: SetFn }) {
  const d: Record<string, string> = scene.direction ?? {};
  const setD = (k: string, v: string) => set({ direction: { ...d, [k]: v } });
  const { data: text = [] } = useModels('TEXT');
  const canAi = text.some(usable);
  const [proposal, setProposal] = useState<{ direction: Record<string, string>; shots: ShotDraft[] } | null>(null);
  const ai = useAiTask<{ direction: Record<string, string>; shots: ShotDraft[] }>('direction', { onSuccess: setProposal });

  const filled = Object.fromEntries(Object.entries(d).filter(([, v]) => typeof v === 'string' && v.trim()).map(([k, v]) => [k, v.slice(0, 2000)]));
  const proposed = FIELDS.filter((f) => proposal?.direction?.[f.key]?.trim());

  function applyDirection() {
    if (!proposal) return;
    const next = { ...d };
    for (const f of proposed) {
      const v = String(proposal.direction[f.key]);
      next[f.key] = (f.kind === 'rich' ? toRich(v) : v).slice(0, f.key === 'acting' ? 4000 : f.key === 'emotion' || f.key === 'rhythm' ? 400 : 2000);
    }
    set({ direction: next });
    setProposal({ ...proposal, direction: {} });
  }

  return (
    <div className="space-y-8">
      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <div className="grid min-w-0 gap-4 lg:grid-cols-2">
          {FIELDS.map((f) =>
            f.kind === 'rich' ? (
              <RichField key={f.key} label={f.label} hint={f.hint} value={d[f.key]} onChange={(v) => setD(f.key, v)} minHeight={66} className={f.wide ? 'lg:col-span-2' : undefined} />
            ) : f.kind === 'one' ? (
              <ComboField key={f.key} label={f.label} hint={f.hint} value={d[f.key]} onChange={(v) => setD(f.key, v ?? '')} options={f.options} />
            ) : (
              <ComboTags key={f.key} label={f.label} hint={f.hint} value={splitList(d[f.key])} onChange={(v) => setD(f.key, joinList(v))} options={f.options} />
            ),
          )}
        </div>
        <div className="xl:sticky xl:top-16 xl:self-start">
          <Panel
            title="Mise en scène assistée"
            description="L’IA part de ce que vous avez déjà rempli et propose le reste, avec un découpage."
            actions={
              <Button size="sm" variant="outline" onClick={() => ai.mutate({ sceneId: scene.id, input: filled })} disabled={!canAi || ai.isPending}>
                {ai.isPending ? <Loader2 className="animate-spin" /> : <Sparkles />} Proposer
              </Button>
            }
          >
            {!canAi ? (
              <p className="text-sm text-muted-foreground">Aucun modèle de texte configuré. Ajoutez un provider dans les réglages pour utiliser l’assistance.</p>
            ) : !proposal ? (
              <p className="text-sm text-muted-foreground">{ai.isPending ? 'Le réalisateur réfléchit…' : `${Object.keys(filled).length} champ${Object.keys(filled).length > 1 ? 's' : ''} rempli${Object.keys(filled).length > 1 ? 's' : ''} seront transmis comme consignes.`}</p>
            ) : !proposed.length ? (
              <p className="text-sm text-muted-foreground">Mise en scène appliquée. Le découpage proposé reste ci-dessous.</p>
            ) : (
              <div className="space-y-3">
                <dl className="space-y-2 text-sm">
                  {proposed.map((f) => (
                    <div key={f.key}>
                      <dt className="font-medium">{LABELS[f.key]}</dt>
                      <dd className="text-muted-foreground">{proposal.direction[f.key]}</dd>
                    </div>
                  ))}
                </dl>
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setProposal(null)}>
                    Écarter
                  </Button>
                  <Button size="sm" onClick={applyDirection}>
                    Appliquer la mise en scène
                  </Button>
                </div>
              </div>
            )}
          </Panel>
        </div>
      </div>

      {proposal && proposal.shots?.length > 0 && (
        <section className="space-y-3">
          <div>
            <h2 className="font-medium">Découpage proposé</h2>
            <p className="text-sm text-muted-foreground">Les plans cochés s’ajoutent à la suite de ceux de la scène.</p>
          </div>
          <ShotDrafts sceneId={scene.id} drafts={proposal.shots} onAdded={() => setProposal({ ...proposal, shots: [] })} />
        </section>
      )}
    </div>
  );
}
