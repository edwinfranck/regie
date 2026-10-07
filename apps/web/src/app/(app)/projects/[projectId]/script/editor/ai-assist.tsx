'use client';

import { parseFountain, type ScriptElement, toFountain } from '@regie/core';
import type { Editor } from '@tiptap/react';
import { Loader2, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { useAiTask } from '@/hooks/use-ai';
import { elementsToNodes, rangeElements } from './schema';

export type ScriptAction = 'continue' | 'rewrite' | 'shorten' | 'expand' | 'dialogue' | 'tension' | 'humor' | 'tone';

export const AI_ACTIONS: { value: ScriptAction; label: string; needsSelection: boolean }[] = [
  { value: 'continue', label: 'Continuer', needsSelection: false },
  { value: 'rewrite', label: 'Réécrire', needsSelection: true },
  { value: 'shorten', label: 'Raccourcir', needsSelection: true },
  { value: 'expand', label: 'Développer', needsSelection: true },
  { value: 'dialogue', label: 'Améliorer le dialogue', needsSelection: true },
  { value: 'tension', label: 'Créer de la tension', needsSelection: true },
  { value: 'humor', label: 'Ajouter de l’humour', needsSelection: true },
  { value: 'tone', label: 'Changer de ton…', needsSelection: true },
];

interface Job {
  action: ScriptAction;
  // Blocs entiers concernés : on remplace des blocs, jamais un bout de ligne.
  from: number;
  to: number;
  selection: string;
  before: string;
  after: string;
  phase: 'tone' | 'loading' | 'result';
  tone: string;
  result?: { elements: ScriptElement[]; note?: string };
}

function blockBounds(editor: Editor) {
  const { doc, selection } = editor.state;
  const $f = doc.resolve(selection.from);
  const $t = doc.resolve(selection.to);
  return { from: $f.depth ? $f.before(1) : 0, to: $t.depth ? $t.after(1) : doc.content.size, empty: selection.empty };
}

export const hasSelection = (editor: Editor) => !editor.state.selection.empty;

/** L'aide à l'écriture : prépare le contexte, montre la proposition, l'auteur applique. */
export function useAiAssist(editor: Editor | null) {
  const [job, setJob] = useState<Job | null>(null);
  const task = useAiTask<{ fountain: string; note?: string }>('script');

  const run = (j: Job) => {
    setJob({ ...j, phase: 'loading' });
    task.mutate(
      { action: j.action, selection: j.selection, before: j.before, after: j.after, tone: j.action === 'tone' ? j.tone : undefined },
      {
        onSuccess: (r) => setJob((cur) => (cur ? { ...cur, phase: 'result', result: { elements: parseFountain(r.data.fountain ?? ''), note: r.data.note } } : cur)),
        onError: () => setJob(null),
      },
    );
  };

  const start = (action: ScriptAction) => {
    if (!editor) return;
    const { from, to, empty } = blockBounds(editor);
    const doc = editor.state.doc;
    const size = doc.content.size;
    const selection = action === 'continue' && empty ? '' : toFountain(rangeElements(doc, from, to));
    const cut = action === 'continue' && empty ? to : from;
    const j: Job = {
      action,
      from: action === 'continue' && empty ? to : from,
      to,
      selection,
      before: toFountain(rangeElements(doc, 0, cut)).slice(-3000),
      after: toFountain(rangeElements(doc, to, size)).slice(0, 1500),
      phase: action === 'tone' ? 'tone' : 'loading',
      tone: '',
    };
    if (action === 'tone') setJob(j);
    else run(j);
  };

  const apply = (mode: 'replace' | 'after') => {
    if (!editor || !job?.result) return;
    const nodes = elementsToNodes(job.result.elements);
    if (!nodes.length) return setJob(null);
    const size = editor.state.doc.content.size;
    const to = Math.min(job.to, size);
    const from = Math.min(job.from, to);
    if (mode === 'replace' && from < to) editor.chain().focus().insertContentAt({ from, to }, nodes).run();
    else editor.chain().focus().insertContentAt(to, nodes).run();
    setJob(null);
  };

  const label = AI_ACTIONS.find((a) => a.value === job?.action)?.label.replace('…', '');
  const isInsert = job && job.from === job.to;

  const dialog = (
    <Dialog open={!!job} onOpenChange={(o) => !o && !task.isPending && setJob(null)}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
          <DialogDescription>{job?.phase === 'result' ? 'Proposition de l’IA : rien n’est modifié tant que vous ne l’appliquez pas.' : job?.selection ? 'Sur les blocs sélectionnés.' : 'À la suite du bloc courant.'}</DialogDescription>
        </DialogHeader>
        {job?.phase === 'tone' && (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (job.tone.trim()) run(job);
            }}
          >
            <Input autoFocus value={job.tone} onChange={(e) => setJob({ ...job, tone: e.target.value })} placeholder="Plus sec, mélancolique, burlesque, solennel…" />
            <Button type="submit" disabled={!job.tone.trim()}>
              Proposer
            </Button>
          </form>
        )}
        {job?.phase === 'loading' && (
          <p className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> L’IA écrit…
          </p>
        )}
        {job?.phase === 'result' && job.result && (
          <div className="space-y-3">
            <div className="screenplay max-h-[55vh] overflow-y-auto rounded-md border bg-card px-8 py-6">
              {job.result.elements.length ? (
                job.result.elements.map((e, i) => (
                  <p key={i} data-el={e.type} className="whitespace-pre-wrap">
                    {e.text}
                  </p>
                ))
              ) : (
                <p className="font-sans text-sm text-muted-foreground">La réponse est vide.</p>
              )}
            </div>
            {job.result.note && <p className="text-sm text-muted-foreground">{job.result.note}</p>}
          </div>
        )}
        {job?.phase === 'result' && (
          <DialogFooter>
            <Button variant="ghost" onClick={() => setJob(null)}>
              Annuler
            </Button>
            <Button variant="outline" onClick={() => apply('after')} disabled={!job.result?.elements.length}>
              {isInsert ? 'Insérer' : 'Insérer après'}
            </Button>
            {!isInsert && (
              <Button onClick={() => apply('replace')} disabled={!job.result?.elements.length}>
                Remplacer
              </Button>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );

  return { start, dialog, pending: task.isPending };
}

/** Le menu des actions IA, dans la barre d'outils ou près de la sélection. */
export function AiMenu({ editor, ready, onPick, trigger, align = 'end' }: { editor: Editor; ready: boolean; onPick: (a: ScriptAction) => void; trigger: React.ReactNode; align?: 'start' | 'end' }) {
  const [sel, setSel] = useState(false);
  return (
    <DropdownMenu onOpenChange={(o) => o && setSel(hasSelection(editor))}>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-60" onCloseAutoFocus={(e) => e.preventDefault()}>
        {!ready ? (
          <p className="px-2 py-1.5 text-sm text-muted-foreground">Aucun modèle texte configuré. Ajoutez-en un dans les réglages des modèles pour écrire avec l’IA.</p>
        ) : (
          <>
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">{sel ? 'Sur la sélection' : 'Sélectionnez un passage pour plus d’options'}</DropdownMenuLabel>
            {AI_ACTIONS.map((a) => (
              <DropdownMenuItem key={a.value} disabled={a.needsSelection && !sel} onSelect={() => onPick(a.value)}>
                {a.label}
              </DropdownMenuItem>
            ))}
          </>
        )}
        <DropdownMenuSeparator />
        <p className="px-2 py-1 text-xs text-muted-foreground">Sans sélection, « Continuer » écrit la suite du bloc courant.</p>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Petit bouton flottant au bout de la sélection. */
export function SelectionAi({ editor, ready, onPick }: { editor: Editor; ready: boolean; onPick: (a: ScriptAction) => void }) {
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  useEffect(() => {
    const update = () => {
      const { selection } = editor.state;
      if (selection.empty || !editor.state.doc.textBetween(selection.from, selection.to).trim()) return setPos(null);
      const c = editor.view.coordsAtPos(selection.to);
      setPos({ left: c.left, top: c.bottom + 6 });
    };
    editor.on('selectionUpdate', update);
    editor.on('transaction', update);
    window.addEventListener('scroll', update, true);
    return () => {
      editor.off('selectionUpdate', update);
      editor.off('transaction', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [editor]);
  if (!pos) return null;
  return (
    <div className="fixed z-30" style={{ left: pos.left, top: pos.top }}>
      <AiMenu
        editor={editor}
        ready={ready}
        onPick={onPick}
        align="start"
        trigger={
          <Button size="xs" variant="outline" className="bg-background shadow-sm" onMouseDown={(e) => e.preventDefault()}>
            <Sparkles /> IA
          </Button>
        }
      />
    </div>
  );
}
