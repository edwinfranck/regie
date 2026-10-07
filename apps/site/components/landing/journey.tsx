'use client';

import { useRef } from 'react';
import { gsap, MQ, ScrollTrigger, timecode, useGSAP } from './gsap';
import { ChapterHead } from './chapter';

type Frame = {
  name: string;
  text: string;
  /** Capture réelle de l'application, ou intertitre quand il n'y en a pas. */
  screen?: { file: string; alt: string };
  card?: string;
};

const FRAMES: Frame[] = [
  {
    name: 'Concept',
    text: 'Une idée devient logline, synopsis, pitch et personnages proposés. Vous gardez ce qui vous convient, champ par champ.',
    screen: { file: 'concept', alt: 'Capture de régie : l’étape Concept, avec logline, synopsis et propositions de l’assistant.' },
  },
  {
    name: 'Histoire',
    text: 'Sept structures : trois actes, voyage du héros, Save the Cat, Story Circle… Les temps forts sont reliés aux scènes.',
    card: 'Trois actes, sept temps forts.',
  },
  {
    name: 'Bible',
    text: 'Personnages, lieux, objets, monde, styles et lumières. Description gelée, costume, silhouette, interdits.',
    screen: { file: 'characters', alt: 'Capture de régie : la bible du projet, liste des personnages avec leurs codes et leurs feuilles.' },
  },
  {
    name: 'Scénario',
    text: 'Éditeur au format cinéma (Fountain), assistance sur sélection, versions, export PDF, Word et Final Draft.',
    screen: { file: 'script', alt: 'Capture de régie : l’éditeur de scénario au format cinéma.' },
  },
  {
    name: 'Découpage',
    text: 'Scènes, dépouillement, mise en scène, puis les plans avec un vocabulaire caméra que le compilateur comprend.',
    screen: { file: 'scene', alt: 'Capture de régie : le découpage d’une scène en plans.' },
  },
  {
    name: 'Storyboard',
    text: 'Une case par plan dans l’ordre du film, ou une planche entière dessinée en une passe, avec les mêmes personnages.',
    screen: { file: 'storyboard', alt: 'Capture de régie : le storyboard, une case par plan.' },
  },
  {
    name: 'Génération',
    text: 'Image, vidéo, audio : file de jobs, progression en temps réel, coût réel, relance ou changement de modèle.',
    card: 'Rien ne part sans référence.',
  },
  {
    name: 'Montage',
    text: 'Un espace plein écran : pistes, chutier, coupe, fondus, assemblage automatique depuis le découpage.',
    card: 'Un clip par plan, dans l’ordre.',
  },
  {
    name: 'Export',
    text: 'Scénario PDF, Final Draft, storyboard, film MP4 ou MOV, sous-titres SRT, liste de montage EDL.',
    card: 'Fin de bobine.',
  },
];

/** Durée fictive du « film » parcouru par la bande : 9 plans de 8 secondes. */
const RUN = FRAMES.length * 8;

export function Journey() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const q = gsap.utils.selector(root);
      const mm = gsap.matchMedia();

      mm.add(MQ.pin, () => {
        const section = root.current!;
        section.classList.add('is-pinned');
        const track = q('[data-track]')[0] as HTMLElement;
        const tc = q('[data-journey-tc]')[0] as HTMLElement;
        const shot = q('[data-journey-shot]')[0] as HTMLElement;
        const distance = () => track.scrollWidth - window.innerWidth;

        const tween = gsap.to(track, {
          x: () => -distance(),
          ease: 'none',
          scrollTrigger: {
            trigger: q('[data-stage]')[0],
            start: 'top top',
            end: () => `+=${distance()}`,
            pin: true,
            scrub: 1,
            invalidateOnRefresh: true,
            anticipatePin: 1,
            onUpdate: (self) => {
              tc.textContent = timecode(self.progress * RUN);
              shot.textContent = String(Math.min(FRAMES.length, Math.floor(self.progress * FRAMES.length) + 1)).padStart(2, '0');
            },
          },
        });

        // Chaque photogramme s'éclaire en passant devant l'objectif.
        q('[data-frame-img]').forEach((el) => {
          gsap.fromTo(
            el,
            { scale: 1.12, autoAlpha: 0.35 },
            {
              scale: 1,
              autoAlpha: 1,
              ease: 'none',
              scrollTrigger: { trigger: el, containerAnimation: tween, start: 'left 95%', end: 'left 45%', scrub: true },
            },
          );
        });
        // Les perforations défilent un peu plus vite que la piste.
        gsap.to(q('[data-perfs]'), {
          xPercent: -25,
          ease: 'none',
          scrollTrigger: { trigger: q('[data-stage]')[0], start: 'top top', end: () => `+=${distance()}`, scrub: 1 },
        });

        ScrollTrigger.refresh();
        return () => section.classList.remove('is-pinned');
      });
    },
    { scope: root },
  );

  return (
    <section ref={root} id="parcours" className="journey relative scroll-mt-16 border-t border-border" aria-labelledby="parcours-title">
      <div className="mx-auto max-w-[1440px] px-4 pb-16 pt-28 sm:px-8 md:pt-40">
        <ChapterHead
          n="02"
          label="Le parcours"
          id="parcours-title"
          lines={[
            'De l’idée au film,',
            <>
              dans un <em>seul</em> outil.
            </>,
          ]}
        />
        <p data-reveal className="mt-10 max-w-xl text-lg leading-relaxed text-muted-foreground text-pretty">
          Neuf étapes, chacune nourrit la suivante. On peut revenir à n’importe laquelle : tout reste relié.
        </p>
      </div>

      <div data-stage className="relative overflow-hidden lg:min-h-screen lg:[.is-pinned_&]:flex lg:[.is-pinned_&]:flex-col lg:[.is-pinned_&]:justify-center">
        {/* Bande de pellicule : perforations, piste, compteur. */}
        <div className="journey-perfs overflow-hidden" aria-hidden>
          <div data-perfs className="perfs w-[200%] will-change-transform" />
        </div>
        <div className="journey-perfs flex items-center justify-between bg-[oklch(0.08_0.004_60)] px-8 pb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground" aria-hidden>
          <span>
            <span className="text-signal-bright">●</span> Plan <span data-journey-shot className="tabular-nums text-foreground">01</span> / 09
          </span>
          <span className="tabular-nums">
            TC <span data-journey-tc className="text-foreground">00:00:00:00</span>
          </span>
        </div>

        <div className="bg-[oklch(0.08_0.004_60)] px-4 py-6 sm:px-8 lg:[.is-pinned_&]:px-0 lg:[.is-pinned_&]:py-8">
          <ol data-track className="journey-track will-change-transform">
            {FRAMES.map((f, i) => (
              <li key={f.name} className="journey-frame">
                <div className="mb-3 flex items-baseline justify-between font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  <span>
                    Plan <span className="text-signal-bright">{String(i + 1).padStart(2, '0')}</span>
                  </span>
                  <span className="tabular-nums">{timecode(i * 8)}</span>
                </div>
                <div className="relative aspect-[16/10] overflow-hidden rounded-[3px] bg-black ring-1 ring-white/10">
                  {f.screen ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      data-frame-img
                      src={`/screens/${f.screen.file}.webp`}
                      alt={f.screen.alt}
                      width={1920}
                      height={1200}
                      loading="lazy"
                      decoding="async"
                      className="block size-full object-cover object-top"
                    />
                  ) : (
                    <div data-frame-img className="flex size-full flex-col items-center justify-center gap-5 bg-[oklch(0.1_0.004_60)] px-8 text-center">
                      <span className="h-px w-16 bg-border-strong" aria-hidden />
                      <p className="display text-[clamp(1.75rem,3.2vw,3.25rem)] leading-[1.02] text-foreground">
                        <em>{f.card}</em>
                      </p>
                      <span className="h-px w-16 bg-border-strong" aria-hidden />
                    </div>
                  )}
                </div>
                <div className="mt-5 grid gap-2 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:gap-6">
                  <h3 className="display text-[2.4rem] leading-none sm:text-[2.8rem]">{f.name}</h3>
                  <p className="text-[15px] leading-relaxed text-muted-foreground">{f.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <div className="journey-perfs overflow-hidden" aria-hidden>
          <div data-perfs className="perfs w-[200%] will-change-transform" />
        </div>
      </div>
    </section>
  );
}
