'use client';

import { Fragment, useCallback, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { BIBLE, TARGETS } from './compiler-data';
import { gsap, MQ, ScrollTrigger, useGSAP } from './gsap';

type TargetId = (typeof TARGETS)[number]['id'];

/** Part du segment de chaque cible consacrée à l'écriture des lignes. */
const WRITE = 0.72;

/**
 * Découpe un prompt en unités de révélation sans changer un caractère :
 * par ligne quand le texte en a, par phrase pour les prompts d'un seul tenant.
 */
function units(text: string): { parts: string[]; block: boolean } {
  if (text.includes('\n')) return { parts: text.split('\n'), block: true };
  const parts = text.split(/(?<=\.)\s(?=\S)/);
  return { parts: parts.map((p, i) => (i < parts.length - 1 ? `${p} ` : p)), block: false };
}

/** L'entrée de la bible dont provient une unité de prompt (pour l'éclairer). */
function sourceOf(unit: string): string | null {
  const u = unit.toLowerCase();
  if (/ch1|marie|woman|raincoat/.test(u)) return 'CH1';
  if (/p1|umbrella/.test(u)) return 'P1';
  if (/street|scene|setting/.test(u)) return 'L1';
  if (/look|style|anime|format/.test(u)) return 'S1';
  if (/shot|camera|lens|duration|action|rain/.test(u)) return '1A';
  return null;
}

/** Les codes de la bible ressortent dans le prompt compilé. */
function codes(s: string) {
  return s.split(/\b(CH1|P1|1A)\b/).map((part, i) =>
    i % 2 ? (
      <span key={i} className="text-signal-bright">
        {part}
      </span>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}

export function CompilerDemo() {
  const root = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<TargetId>('still');
  const target = TARGETS.find((t) => t.id === active)!;
  const { parts, block } = units(target.text);

  // Progression d'écriture dans la cible courante (1 = tout est écrit).
  const written = useRef(1);
  const st = useRef<ScrollTrigger | null>(null);

  const paint = useCallback(() => {
    const el = root.current;
    if (!el) return;
    const lines = el.querySelectorAll<HTMLElement>('[data-ln]');
    const shown = Math.ceil(written.current * lines.length);
    let source: string | null = null;
    lines.forEach((ln, i) => {
      const on = i < shown;
      ln.toggleAttribute('data-on', on);
      ln.toggleAttribute('data-last', on && i === shown - 1);
      if (on) source = sourceOf(ln.textContent ?? '') ?? source;
    });
    el.querySelectorAll<HTMLElement>('[data-entry]').forEach((e) => e.toggleAttribute('data-lit', e.dataset.entry === source));
    const neg = el.querySelector<HTMLElement>('[data-neg]');
    neg?.toggleAttribute('data-on', written.current >= 1);
    const count = el.querySelector<HTMLElement>('[data-count-lines]');
    if (count) count.textContent = `${String(shown).padStart(2, '0')}/${String(lines.length).padStart(2, '0')}`;
  }, []);

  // Nouvelle cible affichée : on repeint l'état d'écriture sur ses lignes.
  useLayoutEffect(paint, [active, paint]);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MQ.pin, () => {
        const el = root.current!;
        el.classList.add('is-compiling');
        st.current = ScrollTrigger.create({
          trigger: el.closest('[data-compile-stage]'),
          start: 'top top',
          end: '+=320%',
          pin: true,
          scrub: 0.8,
          anticipatePin: 1,
          onUpdate: (self) => {
            const p = self.progress * TARGETS.length;
            const seg = Math.min(TARGETS.length - 1, Math.floor(p));
            written.current = Math.min(1, (p - seg) / WRITE);
            const id = TARGETS[seg].id;
            setActive((cur) => (cur === id ? cur : id));
            paint();
          },
        });
        written.current = 0;
        paint();
        return () => {
          el.classList.remove('is-compiling');
          st.current = null;
          written.current = 1;
          paint();
        };
      });
    },
    { scope: root },
  );

  const select = (i: number) => {
    const t = st.current;
    if (t) {
      // Épinglé : l'onglet emmène au moment où cette cible est entièrement écrite.
      const y = t.start + (t.end - t.start) * ((i + WRITE + 0.02) / TARGETS.length);
      const lenis = (window as unknown as { __lenis?: { scrollTo: (y: number, o?: object) => void } }).__lenis;
      if (lenis) lenis.scrollTo(y, { duration: 1.2 });
      else window.scrollTo({ top: y, behavior: 'smooth' });
    } else {
      setActive(TARGETS[i].id);
    }
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = TARGETS.findIndex((t) => t.id === active);
    const next = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : -1;
    if (next < 0 || next >= TARGETS.length) return;
    e.preventDefault();
    select(next);
    root.current?.querySelector<HTMLButtonElement>(`#tab-${TARGETS[next].id}`)?.focus();
  };

  return (
    <div
      ref={root}
      className="group/c grid overflow-hidden rounded-[4px] border border-border-strong bg-code shadow-[var(--shadow-frame)] lg:grid-cols-[minmax(0,5fr)_auto_minmax(0,7fr)]"
    >
      {/* La bible */}
      <div className="border-b border-border lg:border-b-0 lg:border-r">
        <div className="flex h-11 items-center justify-between border-b border-border px-5">
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-foreground">Bible du projet</span>
          <span className="font-mono text-[11px] text-muted-foreground">entrée</span>
        </div>
        <dl className="divide-y divide-border">
          {BIBLE.map((e) => (
            <div
              key={e.code}
              data-entry={e.code}
              className="relative px-5 py-3 transition-colors duration-300 before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:origin-top before:scale-y-0 before:bg-signal before:transition-transform before:duration-300 data-[lit]:bg-[oklch(0.6_0.19_40/0.08)] data-[lit]:before:scale-y-100"
            >
              <dt className="mb-1 flex items-baseline gap-2">
                <span className="font-mono text-xs font-semibold text-signal-bright">{e.code}</span>
                <span className="text-xs text-muted-foreground">{e.kind}</span>
              </dt>
              {e.lines.map(([k, v]) => (
                <dd key={k} className="grid grid-cols-[4.5rem_1fr] gap-2 font-mono text-[12px] leading-relaxed">
                  <span className="text-muted-foreground">{k}</span>
                  <span className="break-words">{v}</span>
                </dd>
              ))}
            </div>
          ))}
        </dl>
      </div>

      <div className="hidden items-center justify-center border-r border-border px-3 lg:flex" aria-hidden>
        <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground [writing-mode:vertical-rl]">
          compile(spec, cible) <span className="text-signal-bright">→</span>
        </span>
      </div>

      {/* Le prompt compilé */}
      <div className="flex min-w-0 flex-col">
        <div className="flex min-h-11 items-center gap-1 overflow-x-auto border-b border-border px-2" role="tablist" aria-label="Cible de compilation" onKeyDown={onKey}>
          {TARGETS.map((t, i) => (
            <button
              key={t.id}
              id={`tab-${t.id}`}
              type="button"
              role="tab"
              aria-selected={t.id === active}
              aria-controls="compiled-prompt"
              tabIndex={t.id === active ? 0 : -1}
              onClick={() => select(i)}
              className="relative inline-flex min-h-11 shrink-0 items-center px-3 font-mono text-[12px] text-muted-foreground transition-colors hover:text-foreground aria-selected:text-foreground"
            >
              {t.id}
              <span className="absolute inset-x-2 bottom-0 h-0.5 origin-left scale-x-0 bg-signal transition-transform duration-500 [[aria-selected=true]>&]:scale-x-100" />
            </button>
          ))}
          <span className="ml-auto hidden pr-3 font-mono text-[11px] tabular-nums text-muted-foreground sm:inline" aria-hidden>
            lignes <span data-count-lines className="text-foreground">00/00</span>
          </span>
        </div>
        <div className="flex items-baseline justify-between gap-4 px-5 pt-4 text-xs text-muted-foreground">
          <span>
            <span className="font-medium text-foreground">{target.label}</span> · {target.engines}
          </span>
          <span className="font-mono text-[11px]">sortie</span>
        </div>
        <pre
          id="compiled-prompt"
          role="tabpanel"
          aria-labelledby={`tab-${active}`}
          aria-live="off"
          className="m-0 min-h-[20rem] flex-1 overflow-x-auto whitespace-pre-wrap break-words px-5 py-4 font-mono text-[12.5px] leading-[1.7]"
        >
          {parts.map((part, i) => (
            <span
              key={`${active}-${i}`}
              data-ln
              className={`${block ? 'block min-h-[1.7em]' : ''} transition-opacity duration-300 group-[.is-compiling]/c:opacity-0 group-[.is-compiling]/c:data-[on]:opacity-100 group-[.is-compiling]/c:data-[last]:after:ml-0.5 group-[.is-compiling]/c:data-[last]:after:inline-block group-[.is-compiling]/c:data-[last]:after:h-[1.1em] group-[.is-compiling]/c:data-[last]:after:w-[0.55em] group-[.is-compiling]/c:data-[last]:after:translate-y-[0.2em] group-[.is-compiling]/c:data-[last]:after:bg-signal group-[.is-compiling]/c:data-[last]:after:content-['']`}
            >
              {block && part === '' ? ' ' : codes(part)}
            </span>
          ))}
        </pre>
        <div
          data-neg
          className="border-t border-border px-5 py-3 font-mono text-[12px] transition-opacity duration-500 group-[.is-compiling]/c:opacity-25 group-[.is-compiling]/c:data-[on]:opacity-100"
        >
          <span className="text-muted-foreground">negative </span>
          <span>{target.negative}</span>
        </div>
      </div>
    </div>
  );
}
