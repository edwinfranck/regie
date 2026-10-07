import { ELEMENT_LABELS, type ElementType, parseFountain, type ScriptElement, toFountain } from '@regie/core';
import type { Node as PMNode } from '@tiptap/pm/model';
import { type Editor, type JSONContent, mergeAttributes, Node } from '@tiptap/react';

// Le document de l'éditeur : une suite de blocs `paragraph` portant chacun un
// type screenplay (`el`). Garder le nom `paragraph` laisse les commandes de
// TipTap (découpe, collage, contenu par défaut) fonctionner sans adaptation.

export const MAIN_TYPES: ElementType[] = ['scene_heading', 'action', 'character', 'parenthetical', 'dialogue', 'transition'];
export const OTHER_TYPES: ElementType[] = ['centered', 'note'];

// Ordre de Tab, comme dans Final Draft.
const TAB_CYCLE: ElementType[] = ['action', 'character', 'dialogue', 'parenthetical', 'transition', 'scene_heading'];

// Le bloc qui suit logiquement quand on appuie sur Entrée en fin de bloc.
const NEXT: Record<ElementType, ElementType> = {
  scene_heading: 'action',
  action: 'action',
  character: 'dialogue',
  parenthetical: 'dialogue',
  dialogue: 'character',
  transition: 'scene_heading',
  centered: 'action',
  note: 'action',
  page_break: 'action',
};

export const UPPER = new Set<ElementType>(['scene_heading', 'character', 'transition']);

export const PLACEHOLDERS: Record<ElementType, string> = {
  scene_heading: 'INT. LIEU - JOUR',
  action: 'Ce que l’on voit, au présent.',
  character: 'NOM',
  parenthetical: '(didascalie)',
  dialogue: 'Réplique',
  transition: 'COUPE FRANCHE.',
  centered: 'Texte centré',
  note: 'Note (n’apparaît pas à l’écran)',
  page_break: '',
};

export const shortcutFor = (el: ElementType) => {
  const i = MAIN_TYPES.indexOf(el);
  return i < 0 ? null : `Ctrl+${i + 1}`;
};

export const labelOf = (el: ElementType) => ELEMENT_LABELS[el] ?? el;

export function currentEl(editor: Editor): ElementType {
  const n = editor.state.selection.$from.parent;
  return (n.type.name === 'paragraph' ? n.attrs.el : 'action') as ElementType;
}

/** Change le type du bloc courant ; une didascalie reçoit ses parenthèses. */
export function setEl(editor: Editor, el: ElementType, focus = true) {
  const chain = focus ? editor.chain().focus() : editor.chain();
  chain.updateAttributes('paragraph', { el }).run();
  if (el !== 'parenthetical') return true;
  const { selection } = editor.state;
  if (!selection.empty) return true;
  const { $from } = selection;
  const text = $from.parent.textContent;
  const start = $from.start();
  if (!text.trim()) {
    editor.chain().insertContentAt({ from: start, to: $from.end() }, '()').setTextSelection(start + 1).run();
    return true;
  }
  const tr = editor.state.tr;
  if (!text.trimEnd().endsWith(')')) tr.insertText(')', $from.end());
  if (!text.trimStart().startsWith('(')) tr.insertText('(', start);
  if (tr.docChanged) editor.view.dispatch(tr);
  return true;
}

function cycle(editor: Editor, dir: 1 | -1) {
  const el = currentEl(editor);
  const i = TAB_CYCLE.indexOf(el);
  const next = i < 0 ? 'action' : TAB_CYCLE[(i + dir + TAB_CYCLE.length) % TAB_CYCLE.length];
  // En quittant une didascalie vide, on retire les parenthèses posées d'office.
  const { $from } = editor.state.selection;
  if (el === 'parenthetical' && $from.parent.textContent === '()') editor.commands.deleteRange({ from: $from.start(), to: $from.end() });
  return setEl(editor, next, false);
}

export const ScreenplayBlock = Node.create({
  name: 'paragraph',
  group: 'block',
  content: 'inline*',
  priority: 1000,

  addAttributes() {
    return {
      el: {
        default: 'action',
        keepOnSplit: false,
        parseHTML: (e) => e.getAttribute('data-el') || 'action',
        renderHTML: (a) => ({ 'data-el': a.el }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'p' }];
  },

  renderHTML({ HTMLAttributes }) {
    const pageBreak = HTMLAttributes['data-el'] === 'page_break';
    return ['p', mergeAttributes(HTMLAttributes, pageBreak ? { class: 'my-4 border-t border-dashed border-border' } : {}), 0];
  },

  addKeyboardShortcuts() {
    const editor = this.editor;
    const shortcuts: Record<string, () => boolean> = {
      Tab: () => cycle(editor, 1),
      'Shift-Tab': () => cycle(editor, -1),
      Enter: () => {
        const { selection } = editor.state;
        if (!selection.empty) return false;
        const { $from } = selection;
        const node = $from.parent;
        if (node.type.name !== 'paragraph') return false;
        const el = node.attrs.el as ElementType;
        // Entrée sur un bloc vide : on revient à l'action.
        if ((!node.textContent.trim() || node.textContent === '()') && el !== 'action') {
          if (node.textContent) editor.commands.deleteRange({ from: $from.start(), to: $from.end() });
          editor.commands.updateAttributes('paragraph', { el: 'action' });
          return true;
        }
        // Dans « (mot|) », la parenthèse fermante ne compte pas comme du texte.
        const rest = node.textContent.slice($from.parentOffset);
        if (el === 'parenthetical' && rest.trim() === ')') editor.commands.setTextSelection($from.end());
        const atEnd = editor.state.selection.$from.parentOffset === node.content.size;
        return editor
          .chain()
          .splitBlock()
          .updateAttributes('paragraph', { el: atEnd ? NEXT[el] : el })
          .scrollIntoView()
          .run();
      },
    };
    MAIN_TYPES.forEach((el, i) => {
      shortcuts[`Mod-${i + 1}`] = () => setEl(editor, el, false);
    });
    return shortcuts;
  },
});

// ---- Conversions document ↔ éléments Fountain ----

export function blockText(node: PMNode) {
  let s = '';
  node.forEach((c) => {
    if (c.isText) s += c.text;
    else if (c.type.name === 'hardBreak') s += '\n';
  });
  return s;
}

function toElement(el: ElementType, text: string): ScriptElement | null {
  if (el === 'page_break') return { type: el, text: '' };
  if (!text.trim()) return null;
  return { type: el, text: UPPER.has(el) ? text.toUpperCase() : text };
}

export function nodesToElements(nodes: PMNode[]): ScriptElement[] {
  return nodes.map((n) => toElement(n.attrs.el as ElementType, blockText(n))).filter((e): e is ScriptElement => !!e);
}

export function docToElements(doc: PMNode): ScriptElement[] {
  const nodes: PMNode[] = [];
  doc.forEach((n) => void nodes.push(n));
  return nodesToElements(nodes);
}

/** Les blocs de premier niveau compris entre deux positions. */
export function rangeElements(doc: PMNode, from: number, to: number): ScriptElement[] {
  const nodes: PMNode[] = [];
  doc.nodesBetween(from, to, (n) => {
    if (n.type.name === 'paragraph') nodes.push(n);
    return false;
  });
  return nodesToElements(nodes);
}

export function jsonToElements(doc: JSONContent): ScriptElement[] {
  return (doc.content ?? [])
    .map((n) => toElement((n.attrs?.el ?? 'action') as ElementType, (n.content ?? []).map((c) => (c.type === 'hardBreak' ? '\n' : (c.text ?? ''))).join('')))
    .filter((e): e is ScriptElement => !!e);
}

export function elementsToNodes(elements: ScriptElement[]): JSONContent[] {
  return elements.map((e) => {
    const lines = e.text.split('\n');
    const content: JSONContent[] = [];
    lines.forEach((l, i) => {
      if (i) content.push({ type: 'hardBreak' });
      if (l) content.push({ type: 'text', text: l });
    });
    return { type: 'paragraph', attrs: { el: e.type }, ...(content.length ? { content } : {}) };
  });
}

export function fountainToDoc(fountain: string): JSONContent {
  const nodes = elementsToNodes(parseFountain(fountain));
  return { type: 'doc', content: nodes.length ? nodes : [{ type: 'paragraph', attrs: { el: 'scene_heading' } }] };
}

export const docToFountain = (doc: JSONContent) => toFountain(jsonToElements(doc));

/**
 * Le Fountain fait foi : le JSON enregistré n'est repris que s'il correspond
 * encore au texte (une restauration de version ou un import ne réécrit que
 * le Fountain).
 */
export function initialDoc(script: { fountain?: string | null; doc?: unknown }): JSONContent {
  const fountain = script.fountain ?? '';
  const doc = script.doc as JSONContent | null | undefined;
  if (doc?.type === 'doc' && Array.isArray(doc.content) && doc.content.length) {
    try {
      if (docToFountain(doc).trim() === fountain.trim()) return doc;
    } catch {
      /* JSON illisible : on repart du Fountain */
    }
  }
  return fountainToDoc(fountain);
}
