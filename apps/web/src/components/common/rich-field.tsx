'use client';

import { toRich } from '@regie/core';
import Placeholder from '@tiptap/extension-placeholder';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Bold, Heading2, Italic, List, ListOrdered, Quote, Strikethrough, Undo2 } from 'lucide-react';
import { useEffect, useId, useRef } from 'react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

/**
 * Éditeur riche pour les champs d'écriture (synopsis, pitch, univers…).
 * Stocke du HTML ; le serveur le ramène en texte brut avant de l'envoyer aux
 * modèles. Accepte aussi du texte brut (anciennes valeurs, propositions de
 * l'IA), converti en paragraphes.
 */
export function RichField({ label, hint, value, onChange, placeholder, minHeight = 120, className }: { label?: React.ReactNode; hint?: React.ReactNode; value: string | null | undefined; onChange: (html: string) => void; placeholder?: string; minHeight?: number; className?: string }) {
  const id = useId();
  const lastEmitted = useRef<string | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [StarterKit.configure({ heading: { levels: [2, 3] }, codeBlock: false, code: false, horizontalRule: false }), Placeholder.configure({ placeholder: placeholder ?? '' })],
    content: toRich(value),
    editorProps: { attributes: { id, class: 'rich-content outline-none', style: `min-height:${minHeight}px` } },
    onUpdate: ({ editor }) => {
      const html = editor.isEmpty ? '' : editor.getHTML();
      lastEmitted.current = html;
      onChangeRef.current(html);
    },
  });

  // Une valeur qui change de l'extérieur (proposition appliquée, restauration)
  // remplace le contenu ; nos propres frappes, non.
  useEffect(() => {
    if (!editor || editor.isFocused) return;
    const next = toRich(value);
    if (next === lastEmitted.current || next === (editor.isEmpty ? '' : editor.getHTML())) return;
    editor.commands.setContent(next, { emitUpdate: false });
  }, [value, editor]);

  const state = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      e
        ? { bold: e.isActive('bold'), italic: e.isActive('italic'), strike: e.isActive('strike'), h: e.isActive('heading'), ul: e.isActive('bulletList'), ol: e.isActive('orderedList'), quote: e.isActive('blockquote'), undo: e.can().undo() }
        : null,
  });

  const btn = (active: boolean | undefined, onClick: () => void, icon: React.ReactNode, title: string, disabled?: boolean) => (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn('flex size-7 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40 [&_svg]:size-3.5', active && 'bg-accent text-foreground')}
    >
      {icon}
    </button>
  );

  return (
    <div className={cn('space-y-1.5', className)}>
      {label && <Label htmlFor={id}>{label}</Label>}
      <div className="rounded-md border border-input bg-background focus-within:ring-[3px] focus-within:ring-ring/30">
        <div className="flex flex-wrap items-center gap-0.5 border-b px-1.5 py-1">
          {btn(state?.bold, () => editor?.chain().focus().toggleBold().run(), <Bold />, 'Gras (Ctrl+B)')}
          {btn(state?.italic, () => editor?.chain().focus().toggleItalic().run(), <Italic />, 'Italique (Ctrl+I)')}
          {btn(state?.strike, () => editor?.chain().focus().toggleStrike().run(), <Strikethrough />, 'Barré')}
          <span className="mx-1 h-4 w-px bg-border" />
          {btn(state?.h, () => editor?.chain().focus().toggleHeading({ level: 3 }).run(), <Heading2 />, 'Intertitre')}
          {btn(state?.ul, () => editor?.chain().focus().toggleBulletList().run(), <List />, 'Liste à puces')}
          {btn(state?.ol, () => editor?.chain().focus().toggleOrderedList().run(), <ListOrdered />, 'Liste numérotée')}
          {btn(state?.quote, () => editor?.chain().focus().toggleBlockquote().run(), <Quote />, 'Citation')}
          <span className="ml-auto" />
          {btn(false, () => editor?.chain().focus().undo().run(), <Undo2 />, 'Annuler (Ctrl+Z)', !state?.undo)}
        </div>
        <EditorContent editor={editor} className="px-3 py-2 text-sm leading-relaxed" />
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Affichage en lecture seule d'un champ riche (ou de texte brut). */
export function RichText({ value, className }: { value: string | null | undefined; className?: string }) {
  return <div className={cn('rich-content text-sm leading-relaxed', className)} dangerouslySetInnerHTML={{ __html: sanitize(toRich(value)) }} />;
}

// Le HTML vient de notre propre éditeur, mais on n'affiche que ses balises.
const ALLOWED = /^(p|br|strong|em|s|h2|h3|ul|ol|li|blockquote)$/i;
function sanitize(html: string) {
  return html.replace(/<\/?([a-z0-9]+)[^>]*>/gi, (tag, name) => (ALLOWED.test(name) ? tag.replace(/\s+[a-z-]+=("[^"]*"|'[^']*')/gi, '') : ''));
}
