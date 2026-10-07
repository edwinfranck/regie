'use client';

import { LIGHTINGS, MOODS, toPlain, WEATHERS } from '@regie/core';
import { Car, CloudSun, Loader2, type LucideIcon, Music, NotebookPen, PawPrint, Shirt, Sparkles, Sun, Volume2, Wand, Wind, Wrench } from 'lucide-react';
import { useState } from 'react';
import { ComboField } from '@/components/common/combo';
import { TagInput } from '@/components/common/fields';
import { IconLabel } from '@/components/common/icon-label';
import { RichField } from '@/components/common/rich-field';
import { useModels, usable } from '@/components/common/model-picker';
import { Panel } from '@/components/common/page-header';
import { Code } from '@/components/common/status';
import { fmtDuration, sceneHeading } from '@/components/shots/shot-meta';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useAiTask } from '@/hooks/use-ai';
import { useBible } from '@/hooks/use-project';

type SetFn = (local: Record<string, unknown>, remote?: Record<string, unknown>) => void;

export const BREAKDOWN_LISTS = { props: 'Accessoires', costumes: 'Costumes', vehicles: 'Véhicules', animals: 'Animaux', vfx: 'Effets visuels (VFX)', sfx: 'Effets sonores (SFX)', music: 'Musique' } as const;
const BREAKDOWN_TEXTS = { ambience: 'Ambiance', lighting: 'Lumière', weather: 'Météo' } as const;
const LIST_ICONS: Record<keyof typeof BREAKDOWN_LISTS, LucideIcon> = { props: Wrench, costumes: Shirt, vehicles: Car, animals: PawPrint, vfx: Wand, sfx: Volume2, music: Music };
const TEXT_FIELDS = { ambience: { icon: Wind, options: MOODS }, lighting: { icon: Sun, options: LIGHTINGS }, weather: { icon: CloudSun, options: WEATHERS } } as const;

interface Proposal {
  characters: string[];
  locationCode: string | null;
  breakdown: Record<string, any>;
  summary: string;
  emotion: string;
  estSeconds: number;
}

type Part = 'breakdown' | 'cast' | 'location' | 'emotion' | 'duration';

/** Le dépouillement : tout ce qu'il faudra fabriquer, louer ou générer pour la scène. */
export function BreakdownTab({ scene, set }: { scene: any; set: SetFn }) {
  const b: Record<string, any> = scene.breakdown ?? {};
  const setB = (k: string, v: unknown) => set({ breakdown: { ...b, [k]: v } });
  const { data: characters = [] } = useBible('characters');
  const { data: locations = [] } = useBible('locations');
  const { data: text = [] } = useModels('TEXT');
  const canAi = text.some(usable);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [parts, setParts] = useState<Set<Part>>(new Set(['breakdown', 'cast', 'location', 'emotion', 'duration']));
  const ai = useAiTask<Proposal>('breakdown', { onSuccess: setProposal });

  const known = (proposal?.characters ?? []).map((code) => characters.find((c: any) => c.code === code?.toUpperCase())).filter(Boolean) as any[];
  const unknown = (proposal?.characters ?? []).filter((code) => !characters.some((c: any) => c.code === code?.toUpperCase()));
  const loc = proposal?.locationCode ? locations.find((l: any) => l.code === proposal.locationCode?.toUpperCase()) : null;

  function apply() {
    if (!proposal) return;
    const local: Record<string, unknown> = {};
    const remote: Record<string, unknown> = {};
    if (parts.has('breakdown')) {
      const next = { ...b };
      for (const k of [...Object.keys(BREAKDOWN_LISTS), ...Object.keys(BREAKDOWN_TEXTS), 'notes'])
        if (proposal.breakdown?.[k] !== undefined && proposal.breakdown[k] !== null) next[k] = Array.isArray(proposal.breakdown[k]) ? proposal.breakdown[k].map(String).slice(0, 80) : String(proposal.breakdown[k]);
      local.breakdown = remote.breakdown = next;
    }
    if (parts.has('cast') && known.length) {
      local.characters = known.map((c) => ({ characterId: c.id }));
      remote.characterIds = known.map((c) => c.id);
    }
    if (parts.has('location') && loc) {
      local.locationId = remote.locationId = loc.id;
      local.location = loc;
    }
    if (parts.has('emotion') && proposal.emotion) local.emotion = remote.emotion = proposal.emotion.slice(0, 400);
    if (parts.has('duration') && proposal.estSeconds > 0) local.estSeconds = remote.estSeconds = Math.round(proposal.estSeconds);
    set(local, remote);
    setProposal(null);
  }

  const toggle = (p: Part) => setParts((s) => {
    const n = new Set(s);
    if (n.has(p)) n.delete(p);
    else n.add(p);
    return n;
  });
  const Row = ({ part, label, children, disabled }: { part: Part; label: string; children: React.ReactNode; disabled?: boolean }) => (
    <label className="flex gap-3 border-t py-2.5 text-sm first:border-t-0">
      <Checkbox checked={parts.has(part) && !disabled} disabled={disabled} onCheckedChange={() => toggle(part)} className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <p className="font-medium">{label}</p>
        <div className="text-muted-foreground">{children}</div>
      </div>
    </label>
  );

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
      <div className="min-w-0 space-y-5">
        <div className="grid gap-4 lg:grid-cols-2">
          {Object.entries(BREAKDOWN_LISTS).map(([k, label]) => (
            <TagInput key={k} label={<IconLabel icon={LIST_ICONS[k as keyof typeof BREAKDOWN_LISTS]}>{label}</IconLabel>} value={b[k] ?? []} onChange={(v) => setB(k, v)} />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {Object.entries(BREAKDOWN_TEXTS).map(([k, label]) => (
            <ComboField key={k} label={<IconLabel icon={TEXT_FIELDS[k as keyof typeof BREAKDOWN_TEXTS].icon}>{label}</IconLabel>} value={b[k]} onChange={(v) => setB(k, v ?? '')} options={TEXT_FIELDS[k as keyof typeof BREAKDOWN_TEXTS].options} />
          ))}
        </div>
        <RichField label={<IconLabel icon={NotebookPen}>Notes</IconLabel>} value={b.notes} onChange={(v) => setB('notes', v)} minHeight={88} />
      </div>

      <div className="space-y-4 xl:sticky xl:top-16 xl:self-start">
        <Panel
          title="Dépouillement assisté"
          description="L’IA lit la description de la scène et propose la liste. Rien n’est appliqué sans vous."
          actions={
            <Button size="sm" variant="outline" onClick={() => ai.mutate({ heading: sceneHeading(scene), text: toPlain(scene.description) })} disabled={!canAi || ai.isPending || !toPlain(scene.description).trim()}>
              {ai.isPending ? <Loader2 className="animate-spin" /> : <Sparkles />} Proposer
            </Button>
          }
        >
          {!canAi ? (
            <p className="text-sm text-muted-foreground">Aucun modèle de texte configuré. Ajoutez un provider dans les réglages pour utiliser l’assistance.</p>
          ) : !toPlain(scene.description).trim() ? (
            <p className="text-sm text-muted-foreground">Écrivez d’abord la description de la scène (onglet Fiche) : c’est elle que l’IA dépouille.</p>
          ) : !proposal ? (
            <p className="text-sm text-muted-foreground">{ai.isPending ? 'Lecture de la scène…' : 'Pas encore de proposition.'}</p>
          ) : (
            <div className="space-y-3">
              {proposal.summary && <p className="text-sm">{proposal.summary}</p>}
              <div>
                <Row part="breakdown" label="Dépouillement">
                  {Object.entries(BREAKDOWN_LISTS)
                    .filter(([k]) => proposal.breakdown?.[k]?.length)
                    .map(([k, label]) => (
                      <p key={k}>
                        {label} : {proposal.breakdown[k].join(', ')}
                      </p>
                    ))}
                  {Object.entries(BREAKDOWN_TEXTS)
                    .filter(([k]) => proposal.breakdown?.[k])
                    .map(([k, label]) => (
                      <p key={k}>
                        {label} : {proposal.breakdown[k]}
                      </p>
                    ))}
                </Row>
                <Row part="cast" label="Distribution" disabled={!known.length}>
                  <div className="flex flex-wrap items-center gap-1">
                    {known.map((c) => (
                      <Code key={c.id}>{c.code}</Code>
                    ))}
                    {!known.length && 'Aucun personnage de la bible reconnu.'}
                  </div>
                  {unknown.length > 0 && <p className="mt-1 text-xs">Absents de la bible : {unknown.join(', ')}.</p>}
                </Row>
                <Row part="location" label="Lieu" disabled={!loc}>
                  {loc ? `${loc.code} ${loc.name}` : proposal.locationCode ? `${proposal.locationCode} : absent de la bible.` : 'Aucun lieu reconnu.'}
                </Row>
                <Row part="emotion" label="Émotion" disabled={!proposal.emotion}>
                  {proposal.emotion || '—'}
                </Row>
                <Row part="duration" label="Durée estimée" disabled={!(proposal.estSeconds > 0)}>
                  {fmtDuration(proposal.estSeconds)}
                </Row>
              </div>
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => setProposal(null)}>
                  Écarter
                </Button>
                <Button size="sm" onClick={apply} disabled={!parts.size}>
                  Appliquer la sélection
                </Button>
              </div>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
