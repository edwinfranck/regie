'use client';

import { useRef } from 'react';
import { gsap, MQ, useGSAP } from './gsap';
import { ChapterHead } from './chapter';

/**
 * Le même personnage, quatre plans. Schéma abstrait, pas une image :
 * une tête, une coiffure, des épaules. À gauche ce que donne un prompt écrit
 * à la main plan par plan (la silhouette dérive au défilement), à droite ce
 * que donne un prompt compilé depuis la bible (rien ne bouge).
 */
const DRIFT = [
  { shot: '1A', hand: 'woman, long brown hair' },
  { shot: '1B', hand: 'young woman in a coat' },
  { shot: '1C', hand: 'girl, blonde, umbrella' },
  { shot: '1D', hand: 'woman, red jacket' },
];

/** Déformations appliquées à chaque silhouette « écrite à la main ». */
const DRIFT_TO = [
  { long: 1, bob: 0, head: { scaleX: 1, scaleY: 1.04 }, body: { scaleX: 0.92 } },
  { long: 0, bob: 1, head: { scaleX: 0.86, y: -3 }, body: { scaleX: 1.28, scaleY: 1.08 } },
  { long: 0.6, bob: 0.4, head: { scaleX: 1.12, rotate: -8, x: 4 }, body: { scaleX: 1, skewX: -6 } },
  { long: 0, bob: 0, head: { scaleX: 0.94, scaleY: 0.92, y: 4 }, body: { scaleX: 1.16, scaleY: 0.9 } },
];

function Figure({ i, locked }: { i: number; locked?: boolean }) {
  return (
    <svg viewBox="0 0 160 90" className="absolute inset-0 size-full" aria-hidden>
      <g data-body={locked ? undefined : i} style={{ transformOrigin: '80px 90px' }}>
        <path d="M34 90 C38 68 54 60 80 60 C106 60 122 68 126 90 Z" fill="currentColor" opacity="0.32" />
        <rect x="74" y="50" width="12" height="12" fill="currentColor" opacity="0.32" />
      </g>
      <g data-head={locked ? undefined : i} style={{ transformOrigin: '80px 40px' }}>
        <path data-long={locked ? undefined : i} d="M58 36 C58 16 102 16 102 36 L106 70 L54 70 Z" fill="currentColor" opacity="0" />
        <ellipse cx="80" cy="38" rx="15" ry="18" fill="currentColor" opacity="0.55" />
        <path data-bob={locked ? undefined : i} d="M63 40 C61 18 99 18 97 40 L97 46 L91 46 C92 32 68 32 69 46 L63 46 Z" fill="currentColor" />
      </g>
    </svg>
  );
}

export function Problem() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const q = gsap.utils.selector(root);
      const mm = gsap.matchMedia();
      mm.add(MQ.motion, () => {
        const tl = gsap.timeline({
          defaults: { ease: 'none' },
          scrollTrigger: { trigger: q('[data-drift-row]')[0], start: 'top 80%', end: 'bottom 35%', scrub: 1 },
        });
        DRIFT_TO.forEach((d, i) => {
          const at = i * 0.12;
          tl.to(q(`[data-head="${i}"]`), { ...d.head, duration: 1 }, at)
            .to(q(`[data-body="${i}"]`), { ...d.body, duration: 1 }, at)
            .to(q(`[data-long="${i}"]`), { opacity: d.long * 0.85, duration: 1 }, at)
            .to(q(`[data-bob="${i}"]`), { opacity: d.bob, duration: 1 }, at)
            .fromTo(q(`[data-label-base="${i}"]`), { autoAlpha: 1, y: 0 }, { autoAlpha: 0, y: -8, duration: 0.4 }, at + 0.3)
            .from(q(`[data-label-hand="${i}"]`), { autoAlpha: 0, y: 8, duration: 0.4 }, at + 0.45);
        });

        // Les plans compilés se verrouillent un à un.
        gsap.from(q('[data-lock]'), {
          autoAlpha: 0,
          scale: 1.6,
          duration: 0.6,
          ease: 'expo.out',
          stagger: 0.12,
          scrollTrigger: { trigger: q('[data-locked-row]')[0], start: 'top 75%', toggleActions: 'play none none reverse' },
        });
      });

      // Mouvement réduit : l'état final, directement.
      mm.add(MQ.reduce, () => {
        DRIFT_TO.forEach((d, i) => {
          gsap.set(q(`[data-head="${i}"]`), d.head);
          gsap.set(q(`[data-body="${i}"]`), d.body);
          gsap.set(q(`[data-long="${i}"]`), { opacity: d.long * 0.85 });
          gsap.set(q(`[data-bob="${i}"]`), { opacity: d.bob });
        });
      });
    },
    { scope: root },
  );

  return (
    <section ref={root} id="probleme" className="relative scroll-mt-16 py-28 md:py-40" aria-labelledby="probleme-title">
      <div className="mx-auto max-w-[1440px] px-4 sm:px-8">
        <ChapterHead n="01" label="Le problème" id="probleme-title" lines={[
            'Un modèle n’a aucune',
            <>
              <em>mémoire</em> entre deux
            </>,
            'générations.',
          ]} />

        <div className="mt-12 grid gap-8 md:grid-cols-2 md:gap-16">
          <p data-reveal className="max-w-xl text-lg leading-relaxed text-muted-foreground text-pretty">
            Tout ce qui n’est ni écrit ni montré en image est réinventé, différemment à chaque fois. Vingt plans générés isolément, ce sont
            vingt visages, vingt manteaux, vingt rues.
          </p>
        </div>

        {/* Prompt écrit à la main : la silhouette dérive. */}
        <div data-drift-row className="mt-20">
          <p className="mb-4 flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            <span className="h-px w-8 bg-border-strong" />
            Prompt écrit à la main, plan par plan
          </p>
          <ol className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-5">
            {DRIFT.map((d, i) => (
              <li key={d.shot} className="relative aspect-video overflow-hidden rounded-[3px] border border-dashed border-border-strong bg-stage text-muted-foreground">
                <Figure i={i} />
                <span className="absolute left-3 top-2.5 font-mono text-[11px] text-muted-foreground">plan {d.shot}</span>
                <span className="absolute inset-x-3 bottom-2.5 grid font-mono text-[11px] leading-snug sm:text-[12px]">
                  <span data-label-base={i} className="invisible col-start-1 row-start-1" aria-hidden>
                    CH1 · short black bob
                  </span>
                  <span data-label-hand={i} className="col-start-1 row-start-1 text-foreground">
                    {d.hand}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </div>

        {/* Prompt compilé : rien ne bouge. */}
        <div data-locked-row className="mt-12">
          <p className="mb-4 flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.2em] text-foreground">
            <span className="h-px w-8 bg-signal" />
            Prompt compilé depuis la bible
          </p>
          <ol className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-5">
            {DRIFT.map((d) => (
              <li key={d.shot} className="relative aspect-video overflow-hidden rounded-[3px] border border-foreground/70 bg-stage text-foreground">
                <Figure i={0} locked />
                <span className="absolute left-3 top-2.5 font-mono text-[11px] text-muted-foreground">plan {d.shot}</span>
                <span
                  data-lock
                  className="absolute right-2.5 top-2 rounded-[2px] border border-signal px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-signal-bright"
                >
                  CH1
                </span>
                <span className="absolute inset-x-3 bottom-2.5 font-mono text-[11px] leading-snug sm:text-[12px]">CH1 · short black bob</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="mt-28 grid gap-10 md:mt-36 md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] md:items-end">
          <p data-lines className="display text-[clamp(2.75rem,7vw,7rem)]">
            <span className="mask-line">
              <span>La réponse :</span>
            </span>
            <span className="mask-line">
              <span>
                une seule <em className="text-signal">source</em>
              </span>
            </span>
            <span className="mask-line">
              <span>de vérité.</span>
            </span>
          </p>
          <p data-reveal className="max-w-md text-[17px] leading-relaxed text-muted-foreground text-pretty">
            Vous décrivez le film une fois : sa bible. Chaque prompt en est compilé, jamais écrit à la main, et les références de chaque
            personnage et de chaque lieu partent avec chaque plan.
          </p>
        </div>
      </div>
    </section>
  );
}
