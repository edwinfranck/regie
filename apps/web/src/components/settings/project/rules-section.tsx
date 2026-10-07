'use client';

import { MOVES } from '@regie/core';
import { Plus, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { Choice, PillPicker } from '@/components/common/choice';
import { AreaField, NumberField, TagInput, TextField } from '@/components/common/fields';
import { Panel } from '@/components/common/page-header';
import { Code } from '@/components/common/status';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useBible } from '@/hooks/use-project';
import { useProjectPatch } from './shared';

interface Rules {
  maxCharactersPerShot?: number;
  neverTogether?: string[][];
  blocks?: Record<string, string>;
  lineupKey?: string | null;
  propsSheetKey?: string | null;
  targetSeconds?: number | null;
}
interface Motion {
  clipSeconds?: [number, number];
  allowedMoves?: string[];
  short?: string;
  block?: string;
  never?: string[];
}

const MOVE_OPTIONS = Object.entries(MOVES).map(([value, m]) => ({ value, label: m.fr, title: m.en }));

/** Les règles que le linter fait respecter au découpage, et ce qu'un plan animé a le droit de faire. */
export function RulesSection({ project: p, editable }: { project: any; editable: boolean }) {
  const { set } = useProjectPatch();
  const rules: Rules = p.rules ?? {};
  const motion: Motion = p.motion ?? {};
  const setRules = (patch: Partial<Rules>) => set({ rules: { ...rules, ...patch } });
  const setMotion = (patch: Partial<Motion>) => set({ motion: { ...motion, ...patch } });
  const [min, max] = motion.clipSeconds ?? [undefined, undefined];

  return (
    <div className="space-y-6">
      {!editable && <p className="text-sm text-muted-foreground">Lecture seule : seuls le propriétaire et les administrateurs du projet modifient ces règles.</p>}
      <fieldset disabled={!editable} className="space-y-6">
        <Panel title="Contrôle du découpage" description="Le linter de continuité signale chaque plan qui enfreint ces règles.">
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <NumberField label="Personnages maximum par plan" hint="Au-delà, les modèles d’image mélangent les visages." value={rules.maxCharactersPerShot} onChange={(v) => setRules({ maxCharactersPerShot: v === null ? undefined : Math.min(20, Math.max(1, Math.round(v))) })} min={1} max={20} />
              <NumberField label="Durée cible" hint="La durée visée pour le film entier." value={rules.targetSeconds} onChange={(v) => setRules({ targetSeconds: v === null ? null : Math.max(0, v) })} min={0} suffix="s" />
            </div>
            <NeverTogether value={rules.neverTogether ?? []} onChange={(neverTogether) => setRules({ neverTogether })} />
            <Blocks value={rules.blocks ?? {}} onChange={(blocks) => setRules({ blocks })} />
          </div>
        </Panel>

        <Panel title="Mouvement" description="Ce qu’un plan vidéo a le droit de faire. Injecté dans les prompts des moteurs vidéo.">
          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <NumberField label="Durée minimale d’un plan vidéo" value={min} onChange={(v) => setMotion({ clipSeconds: [v ?? 0, max ?? Math.max(v ?? 0, 5)] })} min={0} step={0.5} suffix="s" />
              <NumberField label="Durée maximale d’un plan vidéo" value={max} onChange={(v) => setMotion({ clipSeconds: [min ?? 0, v ?? 0] })} min={0} step={0.5} suffix="s" />
            </div>
            <PillPicker label="Mouvements de caméra autorisés" options={MOVE_OPTIONS} value={motion.allowedMoves ?? []} onChange={(allowedMoves) => setMotion({ allowedMoves })} />
            <p className="-mt-3 text-xs text-muted-foreground">Aucun sélectionné = tous autorisés.</p>
            <TextField label="Forme courte" hint="Une phrase pour les moteurs qui décrochent au-delà de 70 mots." value={motion.short} onChange={(v) => setMotion({ short: v })} mono />
            <AreaField label="Bloc de mouvement" hint="Ajouté à chaque prompt vidéo : rythme, physique, caméra." value={motion.block} onChange={(v) => setMotion({ block: v })} rows={4} mono />
            <TagInput label="Interdits en vidéo" hint="Ces termes rejoignent les négatifs de chaque plan vidéo." value={motion.never ?? []} onChange={(never) => setMotion({ never })} />
          </div>
        </Panel>
      </fieldset>
    </div>
  );
}

function NeverTogether({ value, onChange }: { value: string[][]; onChange: (v: string[][]) => void }) {
  const { data: characters = [] } = useBible<{ id: string; code: string; name: string }>('characters');
  const [a, setA] = useState<string | null>(null);
  const [b, setB] = useState<string | null>(null);
  const name = (code: string) => characters.find((c) => c.code === code)?.name;
  const options = characters.map((c) => ({ value: c.code, label: `${c.code} · ${c.name}` }));
  const add = () => {
    if (!a || !b || a === b) return;
    if (!value.some((p) => p.includes(a) && p.includes(b))) onChange([...value, [a, b]]);
    setA(null);
    setB(null);
  };
  return (
    <div className="space-y-2">
      <Label>Jamais ensemble dans un plan</Label>
      <p className="text-xs text-muted-foreground">Pour des personnages joués par la même référence, ou qu’un modèle confond.</p>
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {value.map((pair, i) => (
            <li key={pair.join('-')} className="inline-flex items-center gap-1.5 rounded-sm border px-2 py-1 text-sm">
              {pair.map((c, j) => (
                <span key={c} className="inline-flex items-center gap-1">
                  {j > 0 && <span className="text-muted-foreground">×</span>}
                  <Code>{c}</Code>
                  {name(c) ?? <span className="text-warning">inconnu</span>}
                </span>
              ))}
              <button type="button" onClick={() => onChange(value.filter((_, k) => k !== i))} className="text-muted-foreground hover:text-foreground" aria-label="Retirer la paire">
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {characters.length < 2 ? (
        <p className="text-sm text-muted-foreground">Il faut au moins deux personnages dans la bible.</p>
      ) : (
        <div className="flex flex-wrap items-end gap-2">
          <Choice value={a} onChange={setA} options={options.filter((o) => o.value !== b)} placeholder="Personnage" className="w-56" />
          <Choice value={b} onChange={setB} options={options.filter((o) => o.value !== a)} placeholder="Personnage" className="w-56" />
          <Button type="button" variant="outline" onClick={add} disabled={!a || !b}>
            <Plus /> Ajouter la paire
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * Blocs de règles injectés dans tous les prompts d'image. Édités en liste
 * locale (une clé vide ou en double ne doit pas écraser un autre bloc pendant
 * la frappe), enregistrés en objet { clé: texte }.
 */
function Blocks({ value, onChange }: { value: Record<string, string>; onChange: (v: Record<string, string>) => void }) {
  const [rows, setRows] = useState(() => Object.entries(value).map(([k, text]) => ({ k, text })));
  const commit = (next: { k: string; text: string }[]) => {
    setRows(next);
    const out: Record<string, string> = {};
    for (const r of next) if (r.k.trim() && !(r.k.trim() in out)) out[r.k.trim()] = r.text;
    onChange(out);
  };
  const dup = (k: string) => k.trim() && rows.filter((r) => r.k.trim() === k.trim()).length > 1;
  return (
    <div className="space-y-2">
      <Label>Blocs injectés dans tous les prompts d’image</Label>
      <p className="text-xs text-muted-foreground">Des règles qui valent pour chaque image : morphologie (« build »), latéralité (« handedness »), texture de peau… En anglais.</p>
      {rows.length === 0 && <p className="text-sm text-muted-foreground">Aucun bloc.</p>}
      <div className="space-y-3">
        {rows.map((r, i) => (
          <div key={i} className="grid gap-2 rounded-md border p-3 md:grid-cols-[200px_1fr_auto]">
            <TextField value={r.k} onChange={(k) => commit(rows.map((x, j) => (j === i ? { ...x, k } : x)))} placeholder="clé" mono hint={dup(r.k) ? 'Clé en double : seul le premier compte.' : undefined} />
            <AreaField value={r.text} onChange={(text) => commit(rows.map((x, j) => (j === i ? { ...x, text } : x)))} rows={2} mono placeholder="Both characters keep the exact same build in every shot…" />
            <Button type="button" variant="ghost" size="icon-sm" onClick={() => commit(rows.filter((_, j) => j !== i))} aria-label="Supprimer le bloc" className="text-muted-foreground hover:text-destructive">
              <Trash2 />
            </Button>
          </div>
        ))}
      </div>
      <Button type="button" variant="outline" size="sm" onClick={() => setRows([...rows, { k: '', text: '' }])}>
        <Plus /> Ajouter un bloc
      </Button>
    </div>
  );
}
