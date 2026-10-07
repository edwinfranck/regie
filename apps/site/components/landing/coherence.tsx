'use client';

import type { CSSProperties } from 'react';
import { useRef } from 'react';
import { gsap, MQ, useGSAP } from './gsap';
import { ChapterHead } from './chapter';

/* Tableau de câblage : références à gauche, plans à droite, dans un repère 1000 × 520. */
const REFS = [
  { id: 'CH1', kind: 'Feuille de personnage', detail: 'face · trois-quarts · dos', y: 30 },
  { id: 'L1', kind: 'Plaque du lieu', detail: 'rue pavée, mouillée', y: 205 },
  { id: 'P1', kind: 'Planche d’objets', detail: 'à échelle commune', y: 380 },
];
const SHOTS = [
  { id: '1A', text: 'plan taille · 35 mm · fixe', y: 10, refs: ['CH1', 'L1', 'P1'] },
  { id: '1B', text: 'gros plan · 85 mm', y: 140, refs: ['CH1', 'L1'] },
  { id: '1C', text: 'plan large · travelling', y: 270, refs: ['CH1', 'L1', 'P1'] },
  { id: '2A', text: 'plan moyen · L2', y: 400, refs: ['CH1'], blocked: 'L2 sans plaque' },
];
const H = 110;
const pct = (v: number, of: number) => `${(v / of) * 100}%`;

const CHECKS = [
  ['bloquant', 'Personnage ou lieu du plan sans référence', 'bg-signal text-signal-foreground font-semibold'],
  ['erreur', 'Mouvement interdit, plan trop long, trop de personnages', 'border border-foreground text-foreground'],
  ['avert.', 'Lumière qui contredit l’heure de la scène', 'border border-border-strong text-muted-foreground'],
  ['info', 'Personnage jamais utilisé, scène sans plan', 'text-muted-foreground'],
] as const;

export function Coherence() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const q = gsap.utils.selector(root);
      const mm = gsap.matchMedia();
      mm.add(MQ.motion, () => {
        const board = q('[data-board]')[0];
        const tl = gsap.timeline({
          defaults: { ease: 'none' },
          scrollTrigger: { trigger: board, start: 'top 75%', end: 'bottom 45%', scrub: 1 },
        });
        tl.from(q('[data-ref-card]'), { autoAlpha: 0, x: -30, stagger: 0.1, duration: 0.4 })
          .from(q('[data-shot-card]'), { autoAlpha: 0, x: 30, stagger: 0.1, duration: 0.4 }, 0.1)
          .fromTo(q('[data-wire]'), { strokeDashoffset: 1 }, { strokeDashoffset: 0, stagger: 0.06, duration: 0.8 }, 0.45)
          .from(q('[data-blocked]'), { autoAlpha: 0, scale: 0.6, duration: 0.25, ease: 'back.out(3)' }, '-=0.2');

        gsap.from(q('[data-check]'), {
          autoAlpha: 0,
          x: -20,
          duration: 0.7,
          ease: 'power3.out',
          stagger: 0.12,
          scrollTrigger: { trigger: q('[data-checks]')[0], start: 'top 80%', toggleActions: 'play none none reverse' },
        });

        q('[data-shot-img]').forEach((el) => {
          gsap.fromTo(el, { yPercent: 6 }, { yPercent: -6, ease: 'none', scrollTrigger: { trigger: el, scrub: 1 } });
        });
      });
    },
    { scope: root },
  );

  return (
    <section ref={root} id="coherence" className="relative scroll-mt-16 border-t border-border py-28 md:py-40" aria-labelledby="coherence-title">
      <div className="mx-auto max-w-[1440px] px-4 sm:px-8">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-end">
          <ChapterHead
            n="04"
            label="Cohérence"
            id="coherence-title"
            lines={[
              'Les références',
              <>
                <em>voyagent</em> avec
              </>,
              'chaque plan.',
            ]}
          />
          <p data-reveal className="max-w-md text-[17px] leading-relaxed text-muted-foreground text-pretty">
            Générer la feuille d’un personnage en fait sa référence. Elle est ensuite chargée automatiquement dans chaque plan où il apparaît,
            avec la plaque du lieu et les objets, dans l’ordre où un moteur à références multiples les pondère.
          </p>
        </div>

        {/* Le câblage */}
        <div data-board className="relative mt-20 grid gap-4 lg:block lg:aspect-[1000/520]">
          <svg viewBox="0 0 1000 520" className="absolute inset-0 hidden size-full lg:block" aria-hidden>
            {SHOTS.flatMap((s) =>
              s.refs.map((r) => {
                const ref = REFS.find((x) => x.id === r)!;
                const y1 = ref.y + H / 2;
                const y2 = s.y + H / 2;
                return (
                  <path
                    key={`${r}-${s.id}`}
                    data-wire
                    d={`M300 ${y1} C 500 ${y1}, 500 ${y2}, 700 ${y2}`}
                    pathLength={1}
                    strokeDasharray="1"
                    fill="none"
                    stroke={r === 'CH1' ? 'var(--signal)' : 'var(--faint)'}
                    strokeWidth={r === 'CH1' ? 1.5 : 1}
                    vectorEffect="non-scaling-stroke"
                  />
                );
              }),
            )}
            <path d="M600 455 L700 455" stroke="var(--signal)" strokeDasharray="4 5" fill="none" vectorEffect="non-scaling-stroke" />
          </svg>

          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground lg:hidden">Références</p>
          {REFS.map((r) => (
            <div
              key={r.id}
              data-ref-card
              style={{ '--t': pct(r.y, 520), '--h': pct(H, 520) } as CSSProperties}
              className="flex flex-col justify-between rounded-[3px] border border-border-strong bg-stage p-4 lg:absolute lg:left-0 lg:top-[var(--t)] lg:h-[var(--h)] lg:w-[30%]"
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-mono text-sm font-semibold text-signal-bright">{r.id}</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">référence</span>
              </div>
              <div>
                <p className="display text-[1.6rem] leading-none xl:text-[1.9rem]">{r.kind}</p>
                <p className="mt-1 font-mono text-[11px] text-muted-foreground">{r.detail}</p>
              </div>
            </div>
          ))}

          <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground lg:hidden">Plans</p>
          {SHOTS.map((s) => (
            <div
              key={s.id}
              data-shot-card
              style={{ '--t': pct(s.y, 520), '--h': pct(H, 520) } as CSSProperties}
              className={`relative flex flex-col justify-between rounded-[3px] border p-4 lg:absolute lg:right-0 lg:top-[var(--t)] lg:h-[var(--h)] lg:w-[30%] ${
                s.blocked ? 'border-signal bg-[oklch(0.6_0.19_40/0.08)]' : 'border-foreground/60 bg-stage'
              }`}
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-mono text-sm font-semibold">plan {s.id}</span>
                <span className="font-mono text-[11px] text-muted-foreground">{s.refs.join(' · ')}</span>
              </div>
              <p className="font-mono text-[12px] text-muted-foreground">{s.text}</p>
              {s.blocked ? (
                <span
                  data-blocked
                  className="absolute -top-3 right-3 rounded-[2px] bg-signal px-2 py-0.5 font-mono text-[11px] font-semibold text-signal-foreground"
                >
                  bloquant · {s.blocked}
                </span>
              ) : null}
            </div>
          ))}
          <p className="pointer-events-none absolute left-1/2 top-[44%] hidden -translate-x-1/2 text-center font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground lg:block">
            chargées à chaque plan
          </p>
        </div>

        {/* Contrôle de continuité */}
        <div className="mt-32 grid gap-14 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20">
          <div>
            <h3 data-reveal className="display text-[clamp(2.25rem,4.5vw,4rem)]">
              Contrôler <em>avant</em> de brûler des crédits.
            </h3>
            <p data-reveal className="mt-6 max-w-md text-[17px] leading-relaxed text-muted-foreground text-pretty">
              Le contrôle de continuité tourne à chaque affichage, gratuitement, de façon déterministe. Un plan bloqué ne part pas. Ce qui
              demande de lire le texte (une blessure qui disparaît, un costume décrit autrement) relève de l’analyse IA, lancée à la demande.
            </p>
            <ul data-checks className="mt-10 divide-y divide-border border-y border-border">
              {CHECKS.map(([k, t, cls]) => (
                <li key={k} data-check className="flex items-center gap-4 py-3.5 text-[15px]">
                  <span className={`inline-flex w-[5.5rem] shrink-0 justify-center rounded-[2px] px-1.5 py-1 font-mono text-[11px] ${cls}`}>{k}</span>
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="grid gap-10">
            <figure data-reveal>
              <div className="overflow-hidden rounded-[3px] ring-1 ring-white/10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  data-shot-img
                  src="/screens/prompts.webp"
                  alt="Capture de régie : le prompt compilé d’un plan, affiché avant la génération, avec les références jointes."
                  width={1920}
                  height={1200}
                  loading="lazy"
                  decoding="async"
                  className="block aspect-[16/10] h-auto w-full motion-safe:scale-[1.12]"
                />
              </div>
              <figcaption className="mt-4 grid gap-1 sm:grid-cols-[auto_1fr] sm:gap-6">
                <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-signal-bright">Vous gardez la main</span>
                <span className="text-[15px] leading-relaxed text-muted-foreground">
                  Le prompt s’affiche tel qu’il partira. Une réécriture manuelle est enregistrée sur le plan, pour cette cible, et l’emporte sur
                  la compilation.
                </span>
              </figcaption>
            </figure>
            <figure data-reveal>
              <div className="overflow-hidden rounded-[3px] ring-1 ring-white/10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  data-shot-img
                  src="/screens/graph.webp"
                  alt="Capture de régie : le graphe du projet reliant bible, scènes, plans, assets et générations."
                  width={1920}
                  height={1200}
                  loading="lazy"
                  decoding="async"
                  className="block aspect-[16/10] h-auto w-full motion-safe:scale-[1.12]"
                />
              </div>
              <figcaption className="mt-4 grid gap-1 sm:grid-cols-[auto_1fr] sm:gap-6">
                <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-signal-bright">Qui dépend de qui</span>
                <span className="text-[15px] leading-relaxed text-muted-foreground">
                  Le graphe relie bible, scènes, plans, assets et générations : quand une fiche change, on sait ce qu’il faut refaire.
                </span>
              </figcaption>
            </figure>
          </div>
        </div>
      </div>
    </section>
  );
}
