'use client';

import { useMutation } from '@tanstack/react-query';
import { BookOpen, Loader2, Sparkles, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAiTask } from '@/hooks/use-ai';
import { useProjectId } from '@/hooks/use-project';
import { post, toastError } from '@/lib/client';
import { AssetThumb } from '../common/media';
import { useModels, usable } from '../common/model-picker';
import type { CompiledPrompt } from './quick-generate';

type Enriched = CompiledPrompt & { detected?: { characters: string[]; locations: string[] } };
type Rewrite = { subject: string; action: string; environment: string; lighting: string; camera: string; lens: string; composition: string; mood: string; style: string; continuity: string; prompt: string };

const REWRITE_FIELDS: [keyof Rewrite, string][] = [
  ['subject', 'Sujet'],
  ['action', 'Action'],
  ['environment', 'Environnement'],
  ['lighting', 'Lumière'],
  ['camera', 'Caméra'],
  ['lens', 'Objectif'],
  ['composition', 'Composition'],
  ['mood', 'Ambiance'],
  ['style', 'Style'],
  ['continuity', 'Continuité'],
];

/**
 * Deux aides au prompt. « Enrichir depuis la bible » est déterministe et
 * gratuit : il injecte les descriptions gelées des entités citées. « Réécrire
 * avec l'IA » passe par un modèle texte et ne fait que proposer.
 */
export function PromptHelpers({
  text,
  kind,
  onApply,
  onAddRefs,
  onDetected,
}: {
  text: string;
  kind: 'image' | 'video' | null;
  onApply: (p: { text: string; negative?: string[] }) => void;
  onAddRefs: (refs: { assetId: string; label: string }[]) => void;
  onDetected?: (d: { characters: string[]; locations: string[] }) => void;
}) {
  const projectId = useProjectId();
  const [enriched, setEnriched] = useState<Enriched | null>(null);
  const [rewrite, setRewrite] = useState<Rewrite | null>(null);
  const { data: textModels = [] } = useModels('TEXT');
  const canRewrite = textModels.some(usable);

  const enrich = useMutation({
    mutationFn: () => post<Enriched>(`/api/projects/${projectId}/prompts`, { kind: 'freeform', text }),
    onSuccess: (p) => {
      setEnriched(p);
      setRewrite(null);
    },
    onError: (e) => toastError(e, 'Enrichissement impossible'),
  });
  const ai = useAiTask<Rewrite>('enrich', {
    onSuccess: (d) => {
      setRewrite(d);
      setEnriched(null);
    },
  });

  const refs = (enriched?.refs ?? []).filter((r) => r.assetId);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        <Button type="button" variant="outline" size="sm" onClick={() => enrich.mutate()} disabled={!text.trim() || enrich.isPending}>
          {enrich.isPending ? <Loader2 className="animate-spin" /> : <BookOpen />} Enrichir depuis la bible
        </Button>
        {kind && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => ai.mutate({ text, kind })}
            disabled={!text.trim() || ai.isPending || !canRewrite}
            title={canRewrite ? undefined : 'Aucun modèle texte configuré'}
          >
            {ai.isPending ? <Loader2 className="animate-spin" /> : <Sparkles />} Réécrire avec l’IA
          </Button>
        )}
      </div>

      {enriched && (
        <div className="space-y-2 rounded-md border bg-muted/40 p-3">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium">Prompt enrichi par la bible</p>
            <button type="button" onClick={() => setEnriched(null)} className="text-muted-foreground hover:text-foreground" aria-label="Fermer">
              <X className="size-4" />
            </button>
          </div>
          <pre className="max-h-48 overflow-y-auto font-mono text-xs leading-relaxed whitespace-pre-wrap">{enriched.text}</pre>
          {enriched.notes.map((n) => (
            <p key={n} className="text-xs text-muted-foreground">
              {n}
            </p>
          ))}
          {refs.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">Références disponibles pour les entités citées :</p>
              <div className="flex flex-wrap gap-1.5">
                {refs.map((r) => (
                  <div key={r.assetId} className="w-16 space-y-0.5">
                    <AssetThumb asset={{ id: r.assetId!, type: 'IMAGE' }} ratio="1:1" className="rounded-sm" />
                    <p className="truncate text-[10px] text-muted-foreground">{r.id}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="flex flex-wrap gap-1.5">
            <Button
              type="button"
              size="sm"
              onClick={() => {
                onApply({ text: enriched.text, negative: enriched.negative });
                if (enriched.detected) onDetected?.(enriched.detected);
                setEnriched(null);
              }}
            >
              Appliquer
            </Button>
            {refs.length > 0 && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  onApply({ text: enriched.text, negative: enriched.negative });
                  onAddRefs(refs.map((r) => ({ assetId: r.assetId!, label: r.id })));
                  if (enriched.detected) onDetected?.(enriched.detected);
                  setEnriched(null);
                }}
              >
                Appliquer et ajouter les {refs.length} référence{refs.length > 1 ? 's' : ''}
              </Button>
            )}
          </div>
        </div>
      )}

      {rewrite && (
        <div className="space-y-2 rounded-md border bg-muted/40 p-3">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium">Proposition de l’IA</p>
            <button type="button" onClick={() => setRewrite(null)} className="text-muted-foreground hover:text-foreground" aria-label="Fermer">
              <X className="size-4" />
            </button>
          </div>
          <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-1 text-xs">
            {REWRITE_FIELDS.filter(([k]) => rewrite[k]).map(([k, label]) => (
              <div key={k} className="contents">
                <dt className="text-muted-foreground">{label}</dt>
                <dd>{rewrite[k]}</dd>
              </div>
            ))}
          </dl>
          <pre className="max-h-48 overflow-y-auto border-t pt-2 font-mono text-xs leading-relaxed whitespace-pre-wrap">{rewrite.prompt}</pre>
          <Button
            type="button"
            size="sm"
            onClick={() => {
              onApply({ text: rewrite.prompt });
              setRewrite(null);
            }}
            disabled={!rewrite.prompt}
          >
            Appliquer le prompt
          </Button>
        </div>
      )}
    </div>
  );
}
