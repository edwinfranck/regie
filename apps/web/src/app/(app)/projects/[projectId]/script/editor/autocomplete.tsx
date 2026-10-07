'use client';

import { characterName, parseHeading } from '@regie/core';
import type { Editor } from '@tiptap/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { blockText } from './schema';

// Autocomplétion à la Final Draft : noms dans un bloc personnage, préfixes,
// lieux et moments dans un en-tête de scène.

const PREFIXES = ['INT. ', 'EXT. ', 'INT./EXT. '];
const TIMES = ['JOUR', 'NUIT', 'MATIN', 'SOIR', 'AUBE', 'CRÉPUSCULE', 'CONTINU', 'PLUS TARD'];
const PREFIX_RE = /^(INT\.\/EXT\.|INT\/EXT\.?|I\/E\.?|INT\.|EXT\.|EST\.)\s+/i;

interface Suggestion {
  label: string;
  text: string;
}
interface Open {
  items: Suggestion[];
  from: number;
  to: number;
  left: number;
  top: number;
  key: string;
}

export type KeyHandler = (e: KeyboardEvent) => boolean;

function uniq(list: string[]) {
  return [...new Set(list.map((s) => s.trim().toUpperCase()).filter(Boolean))];
}

function compute(editor: Editor, characters: string[], locations: string[]): Omit<Open, 'left' | 'top'> | null {
  const { state } = editor;
  const { selection } = state;
  if (!selection.empty || !editor.isFocused) return null;
  const { $from } = selection;
  const node = $from.parent;
  const el = node.attrs.el;
  if (el !== 'character' && el !== 'scene_heading') return null;
  if ($from.parentOffset !== node.content.size) return null;
  const text = blockText(node).toUpperCase();
  const from = $from.start();
  const to = $from.end();
  const key = `${from}:${text}`;

  // Ce qui est déjà écrit ailleurs dans le texte compte aussi.
  const others: string[] = [];
  state.doc.forEach((n, pos) => {
    if (pos + 1 === from || n.attrs.el !== el) return;
    const t = blockText(n);
    if (!t.trim()) return;
    others.push(el === 'character' ? characterName(t) : parseHeading(t).location);
  });

  let items: Suggestion[] = [];
  if (el === 'character') {
    const q = text.trim();
    items = uniq([...characters, ...others])
      .filter((n) => n.startsWith(q) && n !== q)
      .map((n) => ({ label: n, text: n }));
  } else {
    const m = text.match(PREFIX_RE);
    if (!m) {
      const q = text.trimStart();
      items = PREFIXES.filter((p) => p.startsWith(q) && p !== q).map((p) => ({ label: p.trim(), text: p }));
    } else {
      const prefix = text.slice(0, m[0].length);
      const rest = text.slice(m[0].length);
      const dash = rest.match(/^(.*?\S)\s+[-–—]\s*(.*)$/);
      if (!dash) {
        const q = rest.trim();
        items = uniq([...locations, ...others])
          .filter((l) => l.startsWith(q) && l !== q)
          .map((l) => ({ label: l, text: `${prefix}${l} - ` }));
      } else {
        const q = dash[2].trim();
        items = TIMES.filter((t) => t.startsWith(q) && t !== q).map((t) => ({ label: t, text: `${prefix}${dash[1]} - ${t}` }));
      }
    }
  }
  if (!items.length) return null;
  return { items: items.slice(0, 8), from, to, key };
}

export function Autocomplete({ editor, characters, locations, handlerRef }: { editor: Editor; characters: string[]; locations: string[]; handlerRef: React.RefObject<KeyHandler | null> }) {
  const [open, setOpen] = useState<Open | null>(null);
  const [active, setActive] = useState(0);
  const dismissed = useRef<string | null>(null);
  const lastKey = useRef<string | null>(null);
  const data = useRef({ characters, locations });
  data.current = { characters, locations };

  const refresh = useCallback(() => {
    const r = compute(editor, data.current.characters, data.current.locations);
    if (!r || r.key === dismissed.current) return setOpen(null);
    const c = editor.view.coordsAtPos(editor.state.selection.from);
    if (lastKey.current !== r.key) {
      lastKey.current = r.key;
      setActive(0);
    }
    setOpen({ ...r, left: c.left, top: c.bottom + 4 });
  }, [editor]);

  useEffect(() => {
    editor.on('transaction', refresh);
    editor.on('focus', refresh);
    editor.on('blur', refresh);
    window.addEventListener('scroll', refresh, true);
    return () => {
      editor.off('transaction', refresh);
      editor.off('focus', refresh);
      editor.off('blur', refresh);
      window.removeEventListener('scroll', refresh, true);
    };
  }, [editor, refresh]);

  const accept = useCallback(
    (s: Suggestion) => {
      if (!open) return;
      // Pas de nouvelle proposition sur un texte complet qu'on vient d'accepter ;
      // après « INT. » ou « LIEU - », la suite (lieux, moments) doit s'afficher.
      if (!s.text.endsWith(' ')) dismissed.current = `${open.from}:${s.text.toUpperCase()}`;
      editor.chain().focus().insertContentAt({ from: open.from, to: open.to }, s.text).run();
    },
    [editor, open],
  );

  // Les touches sont interceptées avant les raccourcis de l'éditeur.
  useEffect(() => {
    handlerRef.current = (e) => {
      if (!open) return false;
      if (e.key === 'ArrowDown') setActive((a) => (a + 1) % open.items.length);
      else if (e.key === 'ArrowUp') setActive((a) => (a - 1 + open.items.length) % open.items.length);
      else if (e.key === 'Enter' || e.key === 'Tab') accept(open.items[active] ?? open.items[0]);
      else if (e.key === 'Escape') {
        dismissed.current = open.key;
        setOpen(null);
      } else return false;
      return true;
    };
    return () => {
      handlerRef.current = null;
    };
  }, [open, active, accept, handlerRef]);

  if (!open) return null;
  return (
    <ul role="listbox" className="fixed z-40 min-w-48 overflow-hidden rounded-md border bg-popover py-1 text-sm text-popover-foreground shadow-md" style={{ left: open.left, top: open.top }}>
      {open.items.map((s, i) => (
        <li key={s.label}>
          <button
            type="button"
            role="option"
            aria-selected={i === active}
            onMouseDown={(e) => {
              e.preventDefault();
              accept(s);
            }}
            onMouseEnter={() => setActive(i)}
            className={cn('block w-full px-3 py-1 text-left font-mono', i === active && 'bg-accent')}
          >
            {s.label}
          </button>
        </li>
      ))}
      <li className="border-t px-3 pt-1 text-xs text-muted-foreground">Entrée ou Tab pour choisir · Échap pour fermer</li>
    </ul>
  );
}
