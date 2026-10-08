'use client';

import { AnimatePresence, motion, useReducedMotion, useScroll, useTransform } from 'motion/react';
import React from 'react';
import { useEffect, useRef, useState } from 'react';

const V = '?v=2';

// Fenêtre d'application avec onglets : la capture change en fondu croisé.
export function AppWindow({ tabs, priority = false }: { tabs: { name: string; label: string }[]; priority?: boolean }) {
  const [i, setI] = useState(0);
  const active = tabs[i];
  return (
    <div className="overflow-hidden rounded-[16px] border border-border-strong/60 bg-background shadow-[0_2px_8px_oklch(0_0_0/0.06),0_40px_80px_-32px_oklch(0_0_0/0.45)]">
      <div className="flex items-center gap-3 border-b border-border bg-muted/60 px-4 py-2.5">
        <div className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-border-strong" />
          <span className="size-2.5 rounded-full bg-border-strong" />
          <span className="size-2.5 rounded-full bg-border-strong" />
        </div>
        <div className="ml-1 hidden items-center gap-1 overflow-x-auto sm:flex" role="tablist" aria-label="Aperçus de régie">
          {tabs.map((t, n) => (
            <button
              key={t.name}
              role="tab"
              aria-selected={n === i}
              onClick={() => setI(n)}
              className={`shrink-0 rounded-[7px] px-2.5 py-1 text-[13px] font-medium transition-colors ${n === i ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <span className="ml-auto truncate pl-2 font-mono text-[11px] text-muted-foreground">régie — {active.label}</span>
      </div>
      <div className="relative aspect-[16/10] bg-stage">
        <AnimatePresence mode="wait">
          <motion.img
            key={active.name}
            src={`/screens/${active.name}.webp${V}`}
            alt={`régie — ${active.label}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            loading={priority ? 'eager' : 'lazy'}
            className="absolute inset-0 size-full object-cover object-top"
          />
        </AnimatePresence>
      </div>
      {/* Onglets en bas sur mobile. */}
      <div className="flex gap-1 overflow-x-auto border-t border-border px-2 py-2 sm:hidden" role="tablist">
        {tabs.map((t, n) => (
          <button key={t.name} role="tab" aria-selected={n === i} onClick={() => setI(n)} className={`shrink-0 rounded-[7px] px-2.5 py-1 text-[13px] font-medium ${n === i ? 'bg-secondary text-foreground' : 'text-muted-foreground'}`}>
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// Comparaison « à la main » vs « compilé », avec indicateur qui glisse.
const HAND = [
  ['plan 1A', 'woman, long brown hair'],
  ['plan 1B', 'young woman in a coat'],
  ['plan 1C', 'girl, blonde, umbrella'],
  ['plan 1D', 'woman, red jacket'],
];
const COMPILED = [
  ['plan 1A', 'CH1 · short black bob'],
  ['plan 1B', 'CH1 · short black bob'],
  ['plan 1C', 'CH1 · short black bob'],
  ['plan 1D', 'CH1 · short black bob'],
];

export function PromptCompare() {
  const [compiled, setCompiled] = useState(true);
  const rows = compiled ? COMPILED : HAND;
  return (
    <div>
      <div className="inline-flex rounded-[12px] border border-border bg-muted p-1" role="tablist" aria-label="Mode de prompt">
        {[
          ['Écrit à la main', false],
          ['Compilé depuis la bible', true],
        ].map(([label, val]) => {
          const on = compiled === val;
          return (
            <button
              key={String(label)}
              role="tab"
              aria-selected={on}
              onClick={() => setCompiled(val as boolean)}
              className="relative rounded-[9px] px-4 py-2 text-[14px] font-medium transition-colors"
            >
              {on && <motion.span layoutId="compare-pill" className="absolute inset-0 rounded-[9px] bg-background shadow-sm" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
              <span className={`relative ${on ? 'text-foreground' : 'text-muted-foreground'}`}>{label as string}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {rows.map(([plan, desc], n) => (
          <motion.div
            key={plan + n}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: n * 0.05 }}
            className={`rounded-[12px] border p-4 ${compiled ? 'border-signal/40 bg-signal/[0.04]' : 'border-dashed border-border bg-muted/50'}`}
          >
            <p className="font-mono text-[11px] text-muted-foreground">{plan}</p>
            <p className={`mt-2 font-mono text-[13px] leading-snug ${compiled ? 'text-foreground' : 'text-muted-foreground'}`}>{desc}</p>
            <div className={`mt-3 h-1 w-full rounded-full ${compiled ? 'bg-signal/60' : 'bg-border-strong/50'}`} />
          </motion.div>
        ))}
      </div>
      <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
        {compiled
          ? 'Même code, même description gelée, même feuille de référence : le personnage est identique d’un plan à l’autre.'
          : 'Quatre prompts écrits séparément : quatre personnes différentes. Le modèle n’a aucune mémoire entre deux générations.'}
      </p>
    </div>
  );
}

// Barre d'étapes : met en surbrillance l'étape visible pendant le défilement.
export function StepBar({ steps }: { steps: { id: string; label: string }[] }) {
  const [active, setActive] = useState(0);
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (reduce) return;
    const els = steps.map((s) => document.getElementById(s.id)).filter(Boolean) as HTMLElement[];
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(steps.findIndex((s) => s.id === e.target.id));
      },
      { rootMargin: '-45% 0px -45% 0px' },
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [steps, reduce]);
  const mounted = useRef(false);
  useEffect(() => {
    // Ne recentre qu'après le premier rendu, et seulement l'axe horizontal
    // (jamais scrollIntoView, qui ferait défiler la page vers la barre).
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    const el = ref.current?.querySelector<HTMLElement>('[data-on="true"]');
    const box = ref.current;
    if (el && box) box.scrollTo({ left: el.offsetLeft - box.clientWidth / 2 + el.clientWidth / 2, behavior: 'smooth' });
  }, [active]);
  return (
    <div ref={ref} className="no-scrollbar flex gap-1.5 overflow-x-auto">
      {steps.map((s, n) => (
        <a
          key={s.id}
          href={`#${s.id}`}
          data-on={n === active}
          className={`flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors ${n === active ? 'border-signal bg-signal/15 text-foreground' : 'border-border text-muted-foreground hover:text-foreground'}`}
        >
          <span className={`font-mono text-[11px] ${n === active ? 'text-signal' : 'text-muted-foreground'}`}>{String(n + 1).padStart(2, '0')}</span>
          {s.label}
        </a>
      ))}
    </div>
  );
}

// Léger parallaxe vertical sur un élément pendant le défilement.
export function Parallax({ children, amount = 40, className }: { children: React.ReactNode; amount?: number; className?: string }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], [amount, -amount]);
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <div ref={ref} className={className}>
      <motion.div style={{ y }}>{children}</motion.div>
    </div>
  );
}

// Flottement doux et continu (léger va-et-vient vertical). Respecte reduced-motion.
export function Floating({ children, className, amount = 10, duration = 6 }: { children: React.ReactNode; className?: string; amount?: number; duration?: number }) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      animate={{ y: [0, -amount, 0] }}
      transition={{ duration, ease: 'easeInOut', repeat: Infinity }}
    >
      {children}
    </motion.div>
  );
}

// Logo d'un fournisseur (Simple Icons), avec repli sur le nom en toutes lettres.
export function ProviderLogo({ name, slug }: { name: string; slug?: string }) {
  const [failed, setFailed] = useState(!slug);
  if (failed) return <span className="font-display shrink-0 text-lg font-medium text-muted-foreground/80">{name}</span>;
  return (
    <span className="flex shrink-0 items-center gap-2 text-muted-foreground/80">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`https://cdn.simpleicons.org/${slug}/737373`} alt="" aria-hidden width={22} height={22} className="size-[22px] opacity-80" onError={() => setFailed(true)} />
      <span className="font-display text-lg font-medium">{name}</span>
    </span>
  );
}
