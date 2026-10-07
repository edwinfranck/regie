'use client';

import { characterName, type ScriptElement, scenesOf, scriptStats, toFountain } from '@regie/core';
import { useQueryClient } from '@tanstack/react-query';
import { type Editor, useEditorState } from '@tiptap/react';
import { ChevronDown, ChevronUp, Loader2, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { usable, useModels } from '@/components/common/model-picker';
import { IssueList, type IssueLike } from '@/components/common/status';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAiTask } from '@/hooks/use-ai';
import { useProjectId } from '@/hooks/use-project';
import { post, toastError } from '@/lib/client';
import { cn } from '@/lib/utils';
import { searchState, setSearch } from './plugins';

export type PanelTab = 'scenes' | 'stats' | 'search' | 'coherence';

export function SidePanel({ editor, elements, tab, onTab, initialQuery, flush }: { editor: Editor; elements: ScriptElement[]; tab: PanelTab; onTab: (t: PanelTab) => void; initialQuery?: string; flush: () => Promise<void> }) {
  return (
    <Tabs value={tab} onValueChange={(v) => onTab(v as PanelTab)} className="flex h-full min-h-0 flex-col gap-0">
      <div className="border-b px-3 py-2">
        <TabsList className="w-full">
          <TabsTrigger value="scenes">Scènes</TabsTrigger>
          <TabsTrigger value="stats">Stats</TabsTrigger>
          <TabsTrigger value="search">Recherche</TabsTrigger>
          <TabsTrigger value="coherence">Cohérence</TabsTrigger>
        </TabsList>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <TabsContent value="scenes" className="mt-0">
          <ScenesTab editor={editor} elements={elements} flush={flush} />
        </TabsContent>
        <TabsContent value="stats" className="mt-0">
          <StatsTab elements={elements} />
        </TabsContent>
        <TabsContent value="search" className="mt-0" forceMount hidden={tab !== 'search'}>
          <SearchTab editor={editor} initialQuery={initialQuery} active={tab === 'search'} />
        </TabsContent>
        <TabsContent value="coherence" className="mt-0" forceMount hidden={tab !== 'coherence'}>
          <CoherenceTab elements={elements} />
        </TabsContent>
      </div>
    </Tabs>
  );
}

function scrollToPos(editor: Editor, pos: number) {
  // Le défilement de ProseMirror (focus) contrarierait le nôtre : on le coupe.
  editor.chain().setTextSelection(pos + 1).focus(undefined, { scrollIntoView: false }).run();
  const dom = editor.view.nodeDOM(pos);
  if (dom instanceof HTMLElement) dom.scrollIntoView({ block: 'start', behavior: 'smooth' });
}

const titleCase = (s: string) => s.toLowerCase().replace(/(^|[\s'’-])(\p{L})/gu, (_, a, b) => a + b.toUpperCase());

function ScenesTab({ editor, elements, flush }: { editor: Editor; elements: ScriptElement[]; flush: () => Promise<void> }) {
  const projectId = useProjectId();
  const qc = useQueryClient();
  const scenes = scenesOf(elements);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ created: number; updated: number; total: number; extra: number; unknownCharacters: string[] } | null>(null);

  const goTo = (n: number) => {
    let i = 0;
    let target = -1;
    editor.state.doc.forEach((node, pos) => {
      if (target >= 0 || node.attrs.el !== 'scene_heading' || !node.textContent.trim()) return;
      if (i++ === n) target = pos;
    });
    if (target >= 0) scrollToPos(editor, target);
  };

  const sync = async () => {
    setBusy(true);
    try {
      // Le serveur lit le scénario enregistré : on vide d'abord la file.
      await flush();
      const r = await post(`/api/projects/${projectId}/scenes/sync`);
      setResult(r);
      qc.invalidateQueries({ queryKey: ['project', projectId] });
      return r;
    } catch (e) {
      toastError(e, 'Synchronisation impossible');
    } finally {
      setBusy(false);
    }
  };

  const createUnknown = async () => {
    if (!result) return;
    setBusy(true);
    try {
      for (const name of result.unknownCharacters) await post(`/api/projects/${projectId}/bible/characters`, { name: titleCase(name) });
      toast.success(`${result.unknownCharacters.length} personnage(s) ajouté(s) à la bible`);
      qc.invalidateQueries({ queryKey: ['project', projectId, 'bible/characters'] });
    } catch (e) {
      toastError(e, 'Création impossible');
      setBusy(false);
      return;
    }
    // Relancer pour les distribuer dans les scènes.
    await sync();
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Button size="sm" variant="outline" className="w-full" onClick={sync} disabled={busy || !scenes.length}>
          {busy ? <Loader2 className="animate-spin" /> : <RefreshCw />} Synchroniser les scènes
        </Button>
        <p className="text-xs text-muted-foreground">Chaque en-tête crée ou met à jour une scène du découpage, avec son lieu et sa distribution. Les plans existants sont conservés ; rien n’est supprimé.</p>
      </div>
      {result && (
        <div className="space-y-2 rounded-md border p-3 text-sm">
          <p>
            {result.created} scène(s) créée(s), {result.updated} mise(s) à jour.
            {result.extra > 0 && ` ${result.extra} scène(s) du découpage n’ont plus d’en-tête dans le scénario.`}
          </p>
          <Link href={`/projects/${projectId}/scenes`} className="text-sm underline underline-offset-4">
            Ouvrir le découpage
          </Link>
          {result.unknownCharacters.length > 0 && (
            <div className="space-y-2 border-t pt-2">
              <p className="text-muted-foreground">Absents de la bible : {result.unknownCharacters.join(', ')}.</p>
              <Button size="sm" onClick={createUnknown} disabled={busy}>
                Créer {result.unknownCharacters.length > 1 ? `ces ${result.unknownCharacters.length} personnages` : 'ce personnage'}
              </Button>
            </div>
          )}
        </div>
      )}
      {scenes.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune scène pour l’instant. Un en-tête (Ctrl+1, ou « INT. » / « EXT. ») ouvre une scène.</p>
      ) : (
        <ol className="space-y-0.5">
          {scenes.map((s, i) => (
            <li key={i}>
              <button type="button" onClick={() => goTo(i)} className="flex w-full gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent">
                <span className="w-6 shrink-0 text-right font-mono text-xs leading-5 text-muted-foreground">{s.number}</span>
                <span className="min-w-0">
                  <span className="block truncate font-medium">{s.heading.toUpperCase()}</span>
                  {s.characters.length > 0 && <span className="block truncate text-xs text-muted-foreground">{s.characters.join(', ')}</span>}
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function StatsTab({ elements }: { elements: ScriptElement[] }) {
  const s = scriptStats(elements);
  const speakers = Object.entries(s.dialogueBySpeaker);
  const max = Math.max(1, ...speakers.map(([, w]) => w));
  const totalLines = elements.filter((e) => e.type === 'character').length;
  const lines = new Map<string, number>();
  for (const e of elements) if (e.type === 'character') lines.set(characterName(e.text), (lines.get(characterName(e.text)) ?? 0) + 1);
  return (
    <div className="space-y-5">
      <dl className="grid grid-cols-2 gap-3">
        {[
          ['Pages', s.pages.toLocaleString('fr-FR')],
          ['Durée estimée', `${s.estMinutes.toLocaleString('fr-FR')} min`],
          ['Mots', s.words.toLocaleString('fr-FR')],
          ['Scènes', s.scenes],
          ['Répliques', totalLines],
          ['Personnages', speakers.length],
        ].map(([k, v]) => (
          <div key={k as string} className="rounded-md border p-3">
            <dt className="text-xs text-muted-foreground">{k}</dt>
            <dd className="text-lg font-semibold tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-muted-foreground">Une page au format standard dure environ une minute à l’écran : l’estimation part de là.</p>
      <div className="space-y-2">
        <h3 className="text-sm font-medium">Dialogue par personnage</h3>
        {speakers.length === 0 ? (
          <p className="text-sm text-muted-foreground">Pas encore de dialogue.</p>
        ) : (
          <ul className="space-y-2">
            {speakers.map(([name, w]) => (
              <li key={name} className="space-y-1 text-sm">
                <div className="flex justify-between gap-2">
                  <span className="truncate">{name || '—'}</span>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {w} mots · {lines.get(name) ?? 0} répl.
                  </span>
                </div>
                <div className="h-1.5 rounded-sm bg-secondary">
                  <div className="h-full rounded-sm bg-foreground" style={{ width: `${(w / max) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function SearchTab({ editor, initialQuery, active }: { editor: Editor; initialQuery?: string; active: boolean }) {
  const [query, setQuery] = useState(initialQuery ?? '');
  const [repl, setRepl] = useState('');
  const { current, count } = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      const s = e ? searchState(e) : null;
      return { current: s?.current ?? -1, count: s?.matches.length ?? 0 };
    },
  });

  // Le surlignage ne vit que lorsque l'onglet est ouvert.
  useEffect(() => {
    setSearch(editor, { query: active ? query : '', current: 0 });
  }, [editor, query, active]);

  useEffect(() => {
    if (initialQuery) setQuery(initialQuery);
  }, [initialQuery]);

  const reveal = (i: number) => {
    const m = searchState(editor).matches[i];
    if (!m) return;
    setSearch(editor, { current: i });
    editor.commands.setTextSelection({ from: m.from, to: m.to });
    const { node } = editor.view.domAtPos(m.from);
    const el = node instanceof HTMLElement ? node : node.parentElement;
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  };

  // Aller à la première occurrence quand on arrive avec ?q=.
  useEffect(() => {
    if (!active || !initialQuery) return;
    const t = setTimeout(() => reveal(0), 50);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery, active]);

  const step = (d: 1 | -1) => count && reveal((current + d + count) % count);

  const replaceOne = () => {
    const m = searchState(editor).matches[current];
    if (!m) return;
    if (repl) editor.chain().focus().insertContentAt({ from: m.from, to: m.to }, repl).run();
    else editor.chain().focus().deleteRange(m).run();
    setTimeout(() => reveal(Math.min(current, searchState(editor).matches.length - 1)), 0);
  };

  const replaceAll = () => {
    const matches = searchState(editor).matches;
    if (!matches.length) return;
    const tr = editor.state.tr;
    // De la fin vers le début pour que les positions restent justes.
    for (const m of [...matches].reverse()) {
      if (repl) tr.insertText(repl, m.from, m.to);
      else tr.delete(m.from, m.to);
    }
    editor.view.dispatch(tr);
    toast.success(`${matches.length} occurrence(s) remplacée(s)`);
  };

  return (
    <div className="space-y-3">
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          step(1);
        }}
      >
        <div className="flex gap-1">
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher" autoFocus={active} />
          <Button type="button" size="icon" variant="ghost" onClick={() => step(-1)} disabled={!count} aria-label="Précédente">
            <ChevronUp />
          </Button>
          <Button type="submit" size="icon" variant="ghost" disabled={!count} aria-label="Suivante">
            <ChevronDown />
          </Button>
        </div>
        <p className={cn('text-xs', query && !count ? 'text-destructive' : 'text-muted-foreground')}>{!query ? 'Sans distinction de majuscules.' : count ? `${current + 1} sur ${count}` : 'Aucune occurrence.'}</p>
      </form>
      <div className="space-y-2 border-t pt-3">
        <Input value={repl} onChange={(e) => setRepl(e.target.value)} placeholder="Remplacer par" />
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={replaceOne} disabled={!count}>
            Remplacer
          </Button>
          <Button size="sm" variant="outline" onClick={replaceAll} disabled={!count}>
            Tout remplacer
          </Button>
        </div>
      </div>
    </div>
  );
}

function CoherenceTab({ elements }: { elements: ScriptElement[] }) {
  const task = useAiTask<{ issues: IssueLike[] }>('coherence');
  const { ready } = useTextModels();
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">L’IA relit le scénario avec la bible : chronologie, personnages, objets, blessures, costumes, heure et météo. Elle signale, vous décidez.</p>
      <Button size="sm" variant="outline" className="w-full" disabled={!ready || task.isPending || !elements.length} onClick={() => task.mutate({ fountain: toFountain(elements) })}>
        {task.isPending && <Loader2 className="animate-spin" />} Relire la cohérence
      </Button>
      {!ready && <p className="text-xs text-muted-foreground">Aucun modèle texte configuré.</p>}
      {task.data && <IssueList issues={task.data.data.issues ?? []} empty="Aucune incohérence relevée." />}
    </div>
  );
}

/** Un modèle texte est-il utilisable ? Sinon l'IA est désactivée proprement. */
export function useTextModels() {
  const { data, isLoading } = useModels('TEXT');
  return { ready: !!data?.some(usable), isLoading };
}
