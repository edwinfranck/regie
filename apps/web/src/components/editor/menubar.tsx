'use client';

import { ASPECT_RATIOS } from '@regie/core';
import { AlertCircle, ArrowLeft, Check, Clapperboard, Loader2, PanelLeft, PanelRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { actions } from './actions';
import type { ProjectInfo } from './inspector';
import { setFormat } from './ops';
import type { TimelineRow } from './sequence-dialogs';
import { useEditor } from './store';

export interface MenuHandlers {
  onNew: () => void;
  onOpenSequence: (id: string) => void;
  onDuplicate: () => void;
  onRename: () => void;
  onReassemble: () => void;
  onExport: (format: 'srt' | 'edl') => void;
  onRender: () => void;
  onBack: () => void;
  onRetrySave: () => void;
}

const Menu = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <DropdownMenu modal={false}>
    <DropdownMenuTrigger asChild>
      <button type="button" className="h-7 rounded-sm px-2.5 text-sm text-foreground/80 outline-none hover:bg-accent hover:text-foreground data-[state=open]:bg-accent data-[state=open]:text-foreground">
        {label}
      </button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="start" className="min-w-64">
      {children}
    </DropdownMenuContent>
  </DropdownMenu>
);

export function MenuBar({ projectTitle, timelines, timelineId, project, rendering, h }: { projectTitle: string; timelines: TimelineRow[]; timelineId: string | null; project?: ProjectInfo; rendering: number | null; h: MenuHandlers }) {
  const canUndo = useEditor((s) => s.past.length > 0);
  const canRedo = useEditor((s) => s.future.length > 0);
  const hasSel = useEditor((s) => s.selection.length > 0);
  const snapping = useEditor((s) => s.snapping);
  const showBin = useEditor((s) => s.showBin);
  const showInspector = useEditor((s) => s.showInspector);
  const aspect = useEditor((s) => s.doc?.aspectRatio ?? null);
  const loaded = useEditor((s) => !!s.doc);
  const set = useEditor((s) => s.set);
  const off = !loaded;

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b bg-background px-2">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon-sm" onClick={h.onBack} aria-label="Retour au projet">
            <ArrowLeft />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Retour au projet</TooltipContent>
      </Tooltip>
      <div className="flex min-w-0 items-center gap-2 pr-2">
        <Clapperboard className="size-4 shrink-0 text-muted-foreground" />
        <span className="max-w-48 truncate text-sm font-medium" title={projectTitle}>
          {projectTitle}
        </span>
      </div>
      <div className="h-5 w-px bg-border" />
      <nav className="flex items-center" aria-label="Menus">
        <Menu label="Fichier">
          <DropdownMenuItem onSelect={h.onNew}>Nouvelle séquence…</DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Ouvrir une séquence</DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="max-h-80 min-w-56 overflow-y-auto">
              {timelines.map((t) => (
                <DropdownMenuItem key={t.id} onSelect={() => h.onOpenSequence(t.id)} className={cn(t.id === timelineId && 'font-medium')}>
                  {t.id === timelineId ? <Check /> : <span className="size-4" />}
                  <span className="truncate">{t.name}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled={off} onSelect={h.onDuplicate}>
            Dupliquer la séquence
          </DropdownMenuItem>
          <DropdownMenuItem disabled={off} onSelect={h.onRename}>
            Renommer…
          </DropdownMenuItem>
          <DropdownMenuItem disabled={off} onSelect={h.onReassemble}>
            Réassembler depuis le découpage
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled={off} onSelect={() => h.onExport('srt')}>
            Exporter les sous-titres (SRT)
          </DropdownMenuItem>
          <DropdownMenuItem disabled={off} onSelect={() => h.onExport('edl')}>
            Exporter l’EDL (CMX3600)
          </DropdownMenuItem>
          <DropdownMenuItem disabled={off} onSelect={h.onRender}>
            Rendre la vidéo…
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={h.onBack}>Retour au projet</DropdownMenuItem>
        </Menu>
        <Menu label="Édition">
          <DropdownMenuItem disabled={!canUndo} onSelect={actions.undo}>
            Annuler <DropdownMenuShortcut>Ctrl+Z</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem disabled={!canRedo} onSelect={actions.redo}>
            Rétablir <DropdownMenuShortcut>Ctrl+Maj+Z</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled={off} onSelect={actions.split}>
            Couper à la tête de lecture <DropdownMenuShortcut>S</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem disabled={!hasSel} onSelect={actions.duplicate}>
            Dupliquer <DropdownMenuShortcut>Ctrl+D</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem disabled={!hasSel} onSelect={actions.remove}>
            Supprimer <DropdownMenuShortcut>Suppr</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled={off} onSelect={actions.selectAll}>
            Tout sélectionner <DropdownMenuShortcut>Ctrl+A</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem disabled={off} onSelect={() => actions.addSubtitle()}>
            Ajouter un sous-titre à la tête de lecture
          </DropdownMenuItem>
        </Menu>
        <Menu label="Séquence">
          <DropdownMenuItem disabled={off} onSelect={() => actions.addTrack('VIDEO')}>
            Ajouter une piste vidéo
          </DropdownMenuItem>
          <DropdownMenuItem disabled={off} onSelect={() => actions.addTrack('AUDIO')}>
            Ajouter une piste audio
          </DropdownMenuItem>
          <DropdownMenuItem disabled={off} onSelect={() => actions.addTrack('SUBTITLE')}>
            Ajouter une piste de sous-titres
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuCheckboxItem checked={snapping} onCheckedChange={() => actions.toggleSnap()} onSelect={(e) => e.preventDefault()}>
            Aimantation <DropdownMenuShortcut>N</DropdownMenuShortcut>
          </DropdownMenuCheckboxItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger disabled={off}>Format</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuRadioGroup
                value={aspect ?? '__project'}
                onValueChange={(v) => useEditor.getState().commit((d) => setFormat(d, v === '__project' ? null : v, { aspectRatio: project?.aspectRatio ?? '16:9', resolution: project?.resolution }))}
              >
                <DropdownMenuRadioItem value="__project">Celui du projet ({project?.aspectRatio ?? '16:9'})</DropdownMenuRadioItem>
                <DropdownMenuSeparator />
                {ASPECT_RATIOS.map((r) => (
                  <DropdownMenuRadioItem key={r} value={r}>
                    {r}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </Menu>
        <Menu label="Affichage">
          <DropdownMenuItem onSelect={() => actions.zoomBy(1.4)}>
            Zoom avant <DropdownMenuShortcut>+</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => actions.zoomBy(1 / 1.4)}>
            Zoom arrière <DropdownMenuShortcut>−</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={actions.fit}>
            Ajuster la timeline <DropdownMenuShortcut>Maj+Z</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuCheckboxItem checked={showBin} onCheckedChange={(v) => set({ showBin: v })}>
            Médias
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem checked={showInspector} onCheckedChange={(v) => set({ showInspector: v })}>
            Inspecteur
          </DropdownMenuCheckboxItem>
        </Menu>
      </nav>

      <div className="flex-1" />

      <SequenceName />
      <SaveBadge onRetry={h.onRetrySave} />
      <div className="mx-1 h-5 w-px bg-border" />
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon-sm" onClick={() => set({ showBin: !showBin })} aria-pressed={showBin} aria-label="Afficher ou masquer les médias" className={cn(!showBin && 'text-muted-foreground')}>
            <PanelLeft />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Médias</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon-sm" onClick={() => set({ showInspector: !showInspector })} aria-pressed={showInspector} aria-label="Afficher ou masquer l’inspecteur" className={cn(!showInspector && 'text-muted-foreground')}>
            <PanelRight />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Inspecteur</TooltipContent>
      </Tooltip>
      <Button size="sm" onClick={h.onRender} disabled={off} className="ml-1 bg-signal text-signal-foreground hover:bg-signal/90">
        {rendering !== null ? (
          <>
            <Loader2 className="animate-spin" /> Rendu {rendering} %
          </>
        ) : (
          'Rendre'
        )}
      </Button>
      <Button size="sm" variant="outline" onClick={h.onBack}>
        Retour au projet
      </Button>
    </header>
  );
}

/** Nom de la séquence, modifiable sur place. */
function SequenceName() {
  const name = useEditor((s) => s.doc?.name ?? '');
  const [value, setValue] = useState(name);
  const [focus, setFocus] = useState(false);
  useEffect(() => {
    if (!focus) setValue(name);
  }, [name, focus]);
  if (!name) return null;
  const commit = () => {
    const v = value.trim();
    if (v && v !== name) useEditor.getState().commit((d) => ({ ...d, name: v }));
    else setValue(name);
  };
  return (
    <input
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onFocus={() => setFocus(true)}
      onBlur={() => {
        setFocus(false);
        commit();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'Escape') {
          setValue(name);
          setTimeout(() => (e.target as HTMLInputElement).blur());
        }
      }}
      maxLength={160}
      aria-label="Nom de la séquence"
      className="h-8 min-w-0 truncate rounded-sm border border-transparent bg-transparent px-2 text-right text-sm font-medium outline-none hover:border-border focus:border-input focus:text-left"
      style={{ width: `${Math.min(28, Math.max(10, value.length + 2))}ch` }}
    />
  );
}

function SaveBadge({ onRetry }: { onRetry: () => void }) {
  const save = useEditor((s) => s.save);
  const loaded = useEditor((s) => !!s.doc);
  if (!loaded) return null;
  if (save === 'error')
    return (
      <button type="button" onClick={onRetry} className="flex items-center gap-1.5 text-xs text-destructive hover:underline">
        <AlertCircle className="size-3.5" /> Non enregistré — réessayer
      </button>
    );
  return (
    <span className="flex w-28 items-center gap-1.5 text-xs text-muted-foreground" aria-live="polite">
      {save === 'saved' ? <Check className="size-3.5" /> : <Loader2 className={cn('size-3.5', save === 'saving' ? 'animate-spin' : 'opacity-0')} />}
      {save === 'saved' ? 'Enregistré' : save === 'saving' ? 'Enregistrement…' : 'Modifié'}
    </span>
  );
}
