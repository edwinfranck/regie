'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowUp, Bot, ExternalLink, Loader2, Plus, Trash2, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { del, get, post, toastError } from '@/lib/client';
import { cn, fmtUsd } from '@/lib/utils';
import { useAssistantOpen } from '../app/command-palette';
import { ModelPicker } from '../common/model-picker';

interface Msg {
  role: 'user' | 'assistant';
  content: string;
}

type Action = { type: 'create_shots'; sceneId: string; shots: any[] } | { type: 'open'; href: string; label?: string };

const SUGGESTIONS = [
  'Quels plans manquent à la scène 1 ?',
  'Quels personnages n’ont pas encore de feuille de référence ?',
  'Analyse les problèmes de continuité.',
  'Transforme la scène 1 en 8 plans.',
];

/** Sépare le texte de la réponse et son bloc d'actions proposées. */
function splitActions(text: string): { body: string; actions: Action[] } {
  const m = text.match(/```regie-actions\s*([\s\S]*?)```/);
  if (!m) return { body: text.replace(/```regie-actions[\s\S]*$/, '').trim(), actions: [] };
  try {
    const parsed = JSON.parse(m[1]);
    return { body: text.replace(m[0], '').trim(), actions: Array.isArray(parsed) ? parsed : [] };
  } catch {
    return { body: text.replace(m[0], '').trim(), actions: [] };
  }
}

/** Rendu minimal du markdown des réponses : paragraphes, listes, gras, code. */
function Markdown({ text }: { text: string }) {
  const inline = (s: string) =>
    s.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, i) =>
      part.startsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : part.startsWith('`') ? <code key={i} className="rounded-sm bg-secondary px-1 font-mono text-[12px]">{part.slice(1, -1)}</code> : part,
    );
  const blocks = text.split(/\n{2,}/);
  return (
    <div className="space-y-2">
      {blocks.map((b, i) => {
        const lines = b.split('\n');
        if (lines.every((l) => /^\s*([-*]|\d+\.)\s/.test(l)))
          return (
            <ul key={i} className="list-disc space-y-0.5 pl-5">
              {lines.map((l, j) => (
                <li key={j}>{inline(l.replace(/^\s*([-*]|\d+\.)\s/, ''))}</li>
              ))}
            </ul>
          );
        if (/^#{1,3}\s/.test(b)) return <p key={i} className="font-semibold">{inline(b.replace(/^#{1,3}\s/, ''))}</p>;
        return (
          <p key={i} className="whitespace-pre-wrap">
            {inline(b)}
          </p>
        );
      })}
    </div>
  );
}

function ActionButton({ action, projectId }: { action: Action; projectId: string }) {
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  if (action.type === 'open')
    return (
      <Button variant="outline" size="sm" asChild>
        <Link href={action.href}>
          <ExternalLink /> {action.label || 'Ouvrir'}
        </Link>
      </Button>
    );
  return (
    <Button
      size="sm"
      variant={done ? 'secondary' : 'default'}
      disabled={done || busy}
      onClick={async () => {
        setBusy(true);
        try {
          await post(`/api/projects/${projectId}/shots`, { sceneId: action.sceneId, shots: action.shots });
          setDone(true);
          qc.invalidateQueries({ queryKey: ['project', projectId] });
          toast.success(`${action.shots.length} plan(s) ajouté(s).`);
        } catch (e) {
          toastError(e);
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? <Loader2 className="animate-spin" /> : <Plus />}
      {done ? 'Plans ajoutés' : `Ajouter ${action.shots.length} plan${action.shots.length > 1 ? 's' : ''}`}
    </Button>
  );
}

export function AssistantPanel({ projectId }: { projectId: string }) {
  const { open, prompt, set } = useAssistantOpen();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [modelId, setModelId] = useState('auto');
  const [meta, setMeta] = useState<string>();
  const scroller = useRef<HTMLDivElement>(null);
  const abort = useRef<AbortController | null>(null);

  const history = useQuery({ queryKey: ['assistant', projectId], queryFn: () => get(`/api/projects/${projectId}/assistant`), enabled: open });
  useEffect(() => {
    if (history.data?.messages) setMessages(history.data.messages.map((m: any) => ({ role: m.role, content: m.content })));
  }, [history.data]);
  useEffect(() => {
    if (open && prompt) {
      setInput(prompt);
      set(true, undefined);
    }
  }, [open, prompt, set]);
  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [messages]);

  async function send(text: string) {
    if (!text.trim() || busy) return;
    setInput('');
    setBusy(true);
    setMeta(undefined);
    setMessages((m) => [...m, { role: 'user', content: text }, { role: 'assistant', content: '' }]);
    abort.current = new AbortController();
    try {
      const res = await fetch(`/api/projects/${projectId}/assistant`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: text, modelId: modelId === 'auto' ? undefined : modelId }), signal: abort.current.signal });
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: `Erreur ${res.status}` }));
        throw Object.assign(new Error(err.error), { action: err.action });
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, i);
          buf = buf.slice(i + 1);
          if (!line) continue;
          const ev = JSON.parse(line);
          if (ev.delta) setMessages((m) => [...m.slice(0, -1), { role: 'assistant', content: m[m.length - 1].content + ev.delta }]);
          if (ev.done) setMeta(`${ev.done.model}${ev.done.costUsd ? ` · ${fmtUsd(ev.done.costUsd)}` : ''}`);
          if (ev.error) throw Object.assign(new Error(ev.error.error), { action: ev.error.action });
        }
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        setMessages((m) => (m[m.length - 1]?.content ? m : m.slice(0, -1)));
        toast.error(e.message, { action: e.action ? { label: e.action.label, onClick: () => (window.location.href = e.action.href) } : undefined, duration: 10000 });
      }
    } finally {
      setBusy(false);
      abort.current = null;
    }
  }

  if (!open) return null;
  return (
    <aside className="sticky top-12 flex h-[calc(100vh-3rem)] w-[400px] shrink-0 flex-col border-l bg-background">
      <div className="flex items-center justify-between border-b px-4 py-2.5">
        <div className="flex items-center gap-2 font-medium">
          <Bot className="size-4" /> Assistant de production
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            title="Effacer la conversation"
            onClick={async () => {
              await del(`/api/projects/${projectId}/assistant`);
              setMessages([]);
            }}
          >
            <Trash2 />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={() => set(false)} aria-label="Fermer">
            <X />
          </Button>
        </div>
      </div>
      <div ref={scroller} className="flex-1 space-y-4 overflow-y-auto px-4 py-4 text-sm">
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-muted-foreground">Je connais la bible, les scènes, les plans et le contrôle de ce projet. Je propose ; vous appliquez d’un clic.</p>
            <div className="space-y-1.5">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => send(s)} className="block w-full rounded-md border px-3 py-2 text-left hover:bg-accent">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => {
          if (m.role === 'user')
            return (
              <div key={i} className="ml-8 rounded-md bg-secondary px-3 py-2 whitespace-pre-wrap">
                {m.content}
              </div>
            );
          const { body, actions } = splitActions(m.content);
          return (
            <div key={i} className="space-y-2">
              {body ? <Markdown text={body} /> : busy && i === messages.length - 1 ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : null}
              {actions.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {actions.map((a, j) => (
                    <ActionButton key={j} action={a} projectId={projectId} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {meta && <p className="text-xs text-muted-foreground">{meta}</p>}
      </div>
      <div className="space-y-2 border-t p-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="relative"
        >
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            rows={3}
            placeholder="Demandez… (Entrée pour envoyer)"
            className="resize-none pr-11"
          />
          <Button type={busy ? 'button' : 'submit'} size="icon-sm" className={cn('absolute right-2 bottom-2')} onClick={busy ? () => abort.current?.abort() : undefined} aria-label={busy ? 'Arrêter' : 'Envoyer'}>
            {busy ? <X /> : <ArrowUp />}
          </Button>
        </form>
        <ModelPicker capability="TEXT" mode="text" value={modelId} onChange={setModelId} label="" />
      </div>
    </aside>
  );
}
