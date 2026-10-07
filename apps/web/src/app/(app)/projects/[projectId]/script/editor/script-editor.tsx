'use client';

import { characterName, type ElementType, type ScriptElement, toFountain } from '@regie/core';
import Placeholder from '@tiptap/extension-placeholder';
import { EditorContent, type JSONContent, useEditor, useEditorState } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useQueryClient } from '@tanstack/react-query';
import { Download, FileUp, MoreHorizontal, PanelRightClose, PanelRightOpen, Save, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { RevisionsButton } from '@/components/project/revisions';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAutosave } from '@/hooks/use-autosave';
import { useBible, useProjectId } from '@/hooks/use-project';
import { put, toastError } from '@/lib/client';
import { cn } from '@/lib/utils';
import { AiMenu, SelectionAi, useAiAssist } from './ai-assist';
import { Autocomplete, type KeyHandler } from './autocomplete';
import { PageMarkers, SearchHighlight } from './plugins';
import { currentEl, docToElements, fountainToDoc, jsonToElements, labelOf, MAIN_TYPES, OTHER_TYPES, PLACEHOLDERS, ScreenplayBlock, setEl, shortcutFor } from './schema';
import { type PanelTab, SidePanel, useTextModels } from './side-panel';

export interface ScriptRow {
  id: string;
  fountain: string;
  doc: unknown;
  version: number;
}

const PANEL_KEY = 'regie.script.panel';

function readPanel(): { open: boolean; tab: PanelTab } {
  try {
    const v = JSON.parse(localStorage.getItem(PANEL_KEY) ?? 'null');
    if (v && typeof v.open === 'boolean') return v;
  } catch {
    /* stockage indisponible */
  }
  return { open: true, tab: 'scenes' };
}

export function ScriptEditor({ script, initial, initialQuery, onRestored }: { script: ScriptRow; initial: JSONContent; initialQuery?: string; onRestored: () => void }) {
  const projectId = useProjectId();
  const qc = useQueryClient();
  const keyHandler = useRef<KeyHandler | null>(null);
  const [elements, setElements] = useState<ScriptElement[]>(() => jsonToElements(initial));
  const [panel, setPanel] = useState<{ open: boolean; tab: PanelTab }>({ open: true, tab: 'scenes' });
  const [importText, setImportText] = useState<{ name: string; text: string } | null>(null);
  const [snapOpen, setSnapOpen] = useState(false);
  const [snapMsg, setSnapMsg] = useState('');
  const [snapBusy, setSnapBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const statsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { ready: aiReady } = useTextModels();

  const { data: bibleChars = [] } = useBible<{ name: string }>('characters');
  const { data: bibleLocs = [] } = useBible<{ name: string }>('locations');
  const charNames = useMemo(() => bibleChars.map((c) => characterName(c.name)), [bibleChars]);
  const locNames = useMemo(() => bibleLocs.map((l) => l.name.toUpperCase()), [bibleLocs]);

  useEffect(() => {
    const p = readPanel();
    setPanel(initialQuery ? { open: true, tab: 'search' } : p);
  }, [initialQuery]);
  const updatePanel = (p: Partial<typeof panel>) =>
    setPanel((cur) => {
      const next = { ...cur, ...p };
      try {
        localStorage.setItem(PANEL_KEY, JSON.stringify(next));
      } catch {
        /* stockage indisponible */
      }
      return next;
    });

  const scriptKey = ['project', projectId, 'script'];
  // Le JSON part avec la modification ; le Fountain en est dérivé à l'envoi.
  const { queue, flush } = useAutosave<{ doc: JSONContent }>(async ({ doc }) => {
    if (!doc) return;
    const fountain = toFountain(jsonToElements(doc));
    const row = await put(`/api/projects/${projectId}/script`, { fountain, doc });
    qc.setQueryData(scriptKey, (old: any) => (old ? { ...old, fountain, doc, version: row.version } : old));
  }, 1500);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        paragraph: false,
        heading: false,
        blockquote: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
        listKeymap: false,
        codeBlock: false,
        horizontalRule: false,
        bold: false,
        italic: false,
        strike: false,
        code: false,
        underline: false,
        link: false,
        trailingNode: false,
      }),
      ScreenplayBlock,
      Placeholder.configure({ placeholder: ({ node }) => PLACEHOLDERS[node.attrs.el as ElementType] ?? '' }),
      SearchHighlight,
      PageMarkers,
    ],
    content: initial,
    editorProps: {
      attributes: { class: 'min-h-[9in] outline-none', spellcheck: 'true', lang: 'fr', 'aria-label': 'Scénario' },
      handleKeyDown: (_view, event) => keyHandler.current?.(event) ?? false,
    },
    onUpdate: ({ editor: e }) => {
      queue({ doc: e.getJSON() });
      if (statsTimer.current) clearTimeout(statsTimer.current);
      statsTimer.current = setTimeout(() => setElements(docToElements(e.state.doc)), 400);
    },
  });

  const el = useEditorState({ editor, selector: ({ editor: e }) => (e ? currentEl(e) : 'action') }) ?? 'action';
  const ai = useAiAssist(editor);

  const replaceAll = (text: string) => {
    if (!editor) return;
    editor.commands.setContent(fountainToDoc(text));
    toast.success('Scénario importé');
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    if (f.size > 5_000_000) return toast.error('Fichier trop volumineux (5 Mo maximum).');
    const text = await f.text();
    if (editor && docToElements(editor.state.doc).length === 0) replaceAll(text);
    else setImportText({ name: f.name, text });
  };

  const snapshot = async () => {
    if (!editor) return;
    setSnapBusy(true);
    try {
      await flush();
      const doc = editor.getJSON();
      const fountain = toFountain(jsonToElements(doc));
      const row = await put(`/api/projects/${projectId}/script`, { fountain, doc, snapshot: true, message: snapMsg.trim() || undefined });
      qc.setQueryData(scriptKey, (old: any) => (old ? { ...old, fountain, doc, version: row.version } : old));
      qc.invalidateQueries({ queryKey: ['revisions', 'script', script.id] });
      toast.success(`Version ${row.version} enregistrée`);
      setSnapOpen(false);
      setSnapMsg('');
    } catch (e) {
      toastError(e, 'Version non enregistrée');
    } finally {
      setSnapBusy(false);
    }
  };

  const exportUrl = (format: string) => `/api/projects/${projectId}/export?format=${format}`;

  return (
    <div className="flex h-[calc(100vh-3rem)] flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b px-6 py-3">
        <div className="flex items-baseline gap-3">
          <h1 className="text-xl font-semibold tracking-tight">Scénario</h1>
          <span className="text-sm text-muted-foreground">version {script.version}</span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {editor && (
            <AiMenu
              editor={editor}
              ready={aiReady}
              onPick={ai.start}
              trigger={
                <Button size="sm" variant="ghost" disabled={ai.pending}>
                  <Sparkles /> Écrire avec l’IA
                </Button>
              }
            />
          )}
          <Button size="sm" variant="ghost" onClick={() => fileRef.current?.click()}>
            <FileUp /> Importer
          </Button>
          <input ref={fileRef} type="file" accept=".fountain,.txt,.md,.spmd,text/plain,text/markdown" className="hidden" onChange={(e) => (void onFile(e.target.files?.[0]), (e.target.value = ''))} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost">
                <Download /> Exporter
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuItem asChild>
                <a href={exportUrl('fountain')} download onClick={() => void flush()}>
                  Fountain (.fountain)
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href={exportUrl('txt')} download onClick={() => void flush()}>
                  Texte brut (.txt)
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href={exportUrl('pdf')} download onClick={() => void flush()}>
                  PDF
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href={exportUrl('docx')} download onClick={() => void flush()}>
                  Word (.docx)
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href={exportUrl('fdx')} download onClick={() => void flush()}>
                  Final Draft (.fdx)
                </a>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <RevisionsButton entityType="script" entityId={script.id} onRestored={onRestored} />
          <Button size="sm" variant="outline" onClick={() => setSnapOpen(true)}>
            <Save /> Enregistrer une version
          </Button>
          <Button size="icon-sm" variant="ghost" onClick={() => updatePanel({ open: !panel.open })} aria-label={panel.open ? 'Masquer le panneau' : 'Afficher le panneau'} title={panel.open ? 'Masquer le panneau' : 'Afficher le panneau'}>
            {panel.open ? <PanelRightClose /> : <PanelRightOpen />}
          </Button>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-1 border-b px-6 py-1.5">
        {MAIN_TYPES.map((t) => (
          <Tooltip key={t}>
            <TooltipTrigger asChild>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => editor && setEl(editor, t)}
                aria-pressed={el === t}
                className={cn('rounded-sm px-2 py-1 text-sm transition-colors', el === t ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-accent hover:text-foreground')}
              >
                {labelOf(t)}
              </button>
            </TooltipTrigger>
            <TooltipContent>{shortcutFor(t)}</TooltipContent>
          </Tooltip>
        ))}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" onMouseDown={(e) => e.preventDefault()} className={cn('flex items-center gap-1 rounded-sm px-2 py-1 text-sm', OTHER_TYPES.includes(el) ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-accent hover:text-foreground')}>
              {OTHER_TYPES.includes(el) ? labelOf(el) : <MoreHorizontal className="size-4" />}
              <span className="sr-only">Autres types</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" onCloseAutoFocus={(e) => e.preventDefault()}>
            {OTHER_TYPES.map((t) => (
              <DropdownMenuItem key={t} onSelect={() => editor && setEl(editor, t)}>
                {labelOf(t)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <span className="ml-auto hidden text-xs text-muted-foreground lg:inline">Tab : type suivant · Entrée : bloc suivant · Maj+Entrée : retour à la ligne</span>
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1 overflow-y-auto bg-muted/50" onMouseDown={(e) => e.target === e.currentTarget && editor?.commands.focus('end')}>
          <div className="screenplay mx-auto my-8 min-h-[11in] w-[8.5in] max-w-[calc(100%-2rem)] border bg-card py-[1in] pr-[1in] pl-[1.5in] text-card-foreground shadow-sm max-lg:px-10">
            <EditorContent editor={editor} />
          </div>
        </div>
        {panel.open && editor && (
          <aside className="w-88 shrink-0 border-l bg-background">
            <SidePanel editor={editor} elements={elements} tab={panel.tab} onTab={(tab) => updatePanel({ tab })} initialQuery={initialQuery} flush={flush} />
          </aside>
        )}
      </div>

      {editor && <Autocomplete editor={editor} characters={charNames} locations={locNames} handlerRef={keyHandler} />}
      {editor && <SelectionAi editor={editor} ready={aiReady} onPick={ai.start} />}
      {ai.dialog}

      <AlertDialog open={!!importText} onOpenChange={(o) => !o && setImportText(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remplacer le scénario ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le contenu actuel sera remplacé par « {importText?.name} ». Pensez à enregistrer une version avant si vous voulez pouvoir y revenir.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (importText) replaceAll(importText.text);
                setImportText(null);
              }}
            >
              Remplacer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={snapOpen} onOpenChange={setSnapOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Enregistrer une version</DialogTitle>
            <DialogDescription>Une version se retrouve dans l’historique et peut être restaurée à tout moment.</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void snapshot();
            }}
            className="space-y-4"
          >
            <Input autoFocus value={snapMsg} onChange={(e) => setSnapMsg(e.target.value)} placeholder="Ce qui a changé (facultatif)" maxLength={200} />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setSnapOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={snapBusy}>
                Enregistrer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
