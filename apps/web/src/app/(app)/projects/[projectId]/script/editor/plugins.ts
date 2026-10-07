import type { ElementType } from '@regie/core';
import type { Node as PMNode } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { type Editor, Extension } from '@tiptap/react';
import { blockText } from './schema';

// ---- Recherche : surlignage des occurrences ----

export interface Match {
  from: number;
  to: number;
}
interface SearchState {
  query: string;
  current: number;
  matches: Match[];
}

export const searchKey = new PluginKey<SearchState>('script-search');

export function findMatches(doc: PMNode, query: string): Match[] {
  const q = query.toLowerCase();
  if (!q) return [];
  const out: Match[] = [];
  // Pas de marques dans ce document : chaque nœud texte est un morceau de ligne.
  doc.descendants((n, pos) => {
    if (!n.isText || !n.text) return;
    const t = n.text.toLowerCase();
    let i = t.indexOf(q);
    while (i >= 0) {
      out.push({ from: pos + i, to: pos + i + q.length });
      i = t.indexOf(q, i + q.length);
    }
  });
  return out;
}

export const SearchHighlight = Extension.create({
  name: 'scriptSearch',
  addProseMirrorPlugins() {
    return [
      new Plugin<SearchState>({
        key: searchKey,
        state: {
          init: () => ({ query: '', current: -1, matches: [] }),
          apply(tr, prev) {
            const meta = tr.getMeta(searchKey) as Partial<SearchState> | undefined;
            if (!meta && !tr.docChanged) return prev;
            const query = meta?.query ?? prev.query;
            const matches = findMatches(tr.doc, query);
            let current = meta?.current ?? prev.current;
            if (current >= matches.length || current < 0) current = matches.length ? 0 : -1;
            return { query, current, matches };
          },
        },
        props: {
          decorations(state) {
            const s = searchKey.getState(state);
            if (!s?.matches.length) return null;
            return DecorationSet.create(
              state.doc,
              s.matches.map((m, i) => Decoration.inline(m.from, m.to, { class: i === s.current ? 'bg-warning/60 outline outline-1 outline-warning' : 'bg-warning/25' })),
            );
          },
        },
      }),
    ];
  },
});

export const searchState = (editor: Editor) => searchKey.getState(editor.state) ?? { query: '', current: -1, matches: [] };

export function setSearch(editor: Editor, patch: Partial<Pick<SearchState, 'query' | 'current'>>) {
  editor.view.dispatch(editor.state.tr.setMeta(searchKey, patch));
}

// ---- Pagination indicative : un repère toutes les ~55 lignes ----

const LINES_PER_PAGE = 55;
// Largeurs en caractères d'une page au format standard (Courier 12).
const WIDTH: Partial<Record<ElementType, number>> = { character: 38, parenthetical: 25, dialogue: 35 };
const SPACED = new Set<ElementType>(['scene_heading', 'action', 'transition', 'character', 'centered']);

function pageMarkers(doc: PMNode) {
  const decos: Decoration[] = [];
  let lines = 0;
  let page = 1;
  doc.forEach((n, pos) => {
    const el = n.attrs.el as ElementType;
    if (el === 'note') return;
    const width = WIDTH[el] ?? 61;
    const h = blockText(n)
      .split('\n')
      .reduce((a, l) => a + Math.max(1, Math.ceil(l.length / width)), 0);
    const add = h + (SPACED.has(el) ? 1 : 0);
    if (lines + add > LINES_PER_PAGE * page && lines > 0) {
      page++;
      const n2 = page;
      decos.push(
        Decoration.widget(
          pos,
          () => {
            const d = document.createElement('div');
            d.contentEditable = 'false';
            d.className = 'pointer-events-none mt-6 -mb-2 select-none border-t border-dashed border-border pt-1 text-right font-sans text-xs text-muted-foreground';
            d.textContent = `page ${n2}`;
            return d;
          },
          { side: -1, key: `page-${n2}`, ignoreSelection: true },
        ),
      );
    }
    lines += add;
  });
  return DecorationSet.create(doc, decos);
}

const pagesKey = new PluginKey<DecorationSet>('script-pages');

export const PageMarkers = Extension.create({
  name: 'scriptPages',
  addProseMirrorPlugins() {
    return [
      new Plugin<DecorationSet>({
        key: pagesKey,
        state: {
          init: (_, state) => pageMarkers(state.doc),
          apply: (tr, prev) => (tr.docChanged ? pageMarkers(tr.doc) : prev),
        },
        props: { decorations: (state) => pagesKey.getState(state) },
      }),
    ];
  },
});
