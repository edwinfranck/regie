'use client';

import Link from 'next/link';
import { useRef } from 'react';
import { ArrowRight } from 'lucide-react';
import { GitHubMark } from '@/components/github-mark';
import { repoUrl } from '@/lib/shared';
import { gsap, MQ, SplitText, useGSAP } from './gsap';

export function Hero() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const q = gsap.utils.selector(root);
      const html = document.documentElement;
      const mm = gsap.matchMedia();

      mm.add(MQ.motion, () => {
        const split = SplitText.create(q('[data-split]'), { type: 'chars,words', charsClass: 'inline-block will-change-transform' });
        const intro = q('.cine-intro')[0] as HTMLElement | undefined;
        const armed = html.classList.contains('intro-armed');

        const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });

        // 1. Amorce de projection : 3, 2, 1, puis les barres 2.39:1 s'ouvrent.
        if (armed && intro) {
          const nums = q('[data-count]');
          tl.set(nums, { autoAlpha: 0 })
            .to(q('[data-sweep]'), { rotate: 360 * 3, duration: 1.5, ease: 'none' }, 0)
            .to(nums[0], { autoAlpha: 1, duration: 0.01 }, 0)
            .to(nums[0], { autoAlpha: 0, duration: 0.01 }, 0.5)
            .to(nums[1], { autoAlpha: 1, duration: 0.01 }, 0.5)
            .to(nums[1], { autoAlpha: 0, duration: 0.01 }, 1)
            .to(nums[2], { autoAlpha: 1, duration: 0.01 }, 1)
            .to(q('[data-leader]'), { autoAlpha: 0, scale: 1.08, duration: 0.35, ease: 'power2.in' }, 1.45)
            .to(q('[data-bar="top"]'), { yPercent: -100, duration: 1.3, ease: 'expo.inOut' }, 1.6)
            .to(q('[data-bar="bottom"]'), { yPercent: 100, duration: 1.3, ease: 'expo.inOut' }, 1.6)
            .set(intro, { display: 'none' })
            .call(() => html.classList.remove('intro-armed'));
        }
        const at = armed ? 2.05 : 0.1;

        // 2. Le titre, lettre par lettre.
        tl.from(split.chars, { yPercent: 115, rotate: 6, autoAlpha: 0, duration: 1.2, stagger: 0.022 }, at)
          .from(q('[data-hero-fade]'), { autoAlpha: 0, y: 18, duration: 1, stagger: 0.1, ease: 'power3.out' }, at + 0.55)
          // 3. Le cadre s'allume comme un projecteur.
          .from(q('[data-frame]'), { autoAlpha: 0, y: 60, duration: 1.4 }, at + 0.7)
          // Lampe qui chauffe : quelques battements avant la pleine lumière.
          .fromTo(
            q('[data-lamp]'),
            { opacity: 1 },
            { keyframes: { opacity: [1, 0.55, 0.85, 0.25, 0.5, 0.1, 0] }, duration: 1.2, ease: 'none' },
            at + 1.05,
          )
          .from(q('[data-beam]'), { autoAlpha: 0, duration: 1.6, ease: 'power2.out' }, at + 1.05);

        // Parallaxe douce du cadre au défilement.
        gsap.to(q('[data-frame-wrap]'), {
          yPercent: -8,
          ease: 'none',
          scrollTrigger: { trigger: root.current, start: 'top top', end: 'bottom top', scrub: 1 },
        });

        return () => {
          split.revert();
          html.classList.remove('intro-armed');
        };
      });

      // Inclinaison à la souris : pointeur fin seulement.
      mm.add(MQ.fine, () => {
        const frame = q('[data-tilt]')[0] as HTMLElement;
        gsap.set(frame, { transformPerspective: 1600 });
        const rx = gsap.quickTo(frame, 'rotationX', { duration: 0.9, ease: 'power3.out' });
        const ry = gsap.quickTo(frame, 'rotationY', { duration: 0.9, ease: 'power3.out' });
        const onMove = (e: PointerEvent) => {
          const r = frame.getBoundingClientRect();
          const x = (e.clientX - r.left) / r.width - 0.5;
          const y = (e.clientY - r.top) / r.height - 0.5;
          ry(gsap.utils.clamp(-1, 1, x) * 5);
          rx(gsap.utils.clamp(-1, 1, y) * -4);
        };
        const onLeave = () => {
          rx(0);
          ry(0);
        };
        window.addEventListener('pointermove', onMove);
        document.addEventListener('pointerleave', onLeave);
        return () => {
          window.removeEventListener('pointermove', onMove);
          document.removeEventListener('pointerleave', onLeave);
        };
      });
    },
    { scope: root },
  );

  return (
    <section ref={root} className="relative overflow-hidden pt-28 md:pt-36" aria-labelledby="hero-title">
      {/* Ouverture : amorce et barres de cadrage. Décor pur, retiré en fin de séquence. */}
      <div className="cine-intro fixed inset-0 z-[55]" aria-hidden>
        <div data-bar="top" className="absolute inset-x-0 top-0 h-1/2 bg-[oklch(0.07_0.004_60)]" />
        <div data-bar="bottom" className="absolute inset-x-0 bottom-0 h-1/2 bg-[oklch(0.07_0.004_60)]" />
        <div data-leader className="absolute inset-0 flex items-center justify-center">
          <div className="relative flex size-[min(56vw,320px)] items-center justify-center">
            <svg viewBox="0 0 200 200" className="absolute inset-0 size-full text-faint">
              <circle cx="100" cy="100" r="96" fill="none" stroke="currentColor" strokeWidth="1" />
              <circle cx="100" cy="100" r="78" fill="none" stroke="currentColor" strokeWidth="1" />
              <line x1="0" y1="100" x2="200" y2="100" stroke="currentColor" strokeWidth="1" />
              <line x1="100" y1="0" x2="100" y2="200" stroke="currentColor" strokeWidth="1" />
              <g data-sweep style={{ transformOrigin: '100px 100px' }}>
                <path d="M100 100 L100 4 A96 96 0 0 1 183 52 Z" fill="oklch(0.95 0.01 85 / 0.08)" />
                <line x1="100" y1="100" x2="100" y2="4" stroke="var(--signal)" strokeWidth="1.5" />
              </g>
            </svg>
            {['3', '2', '1'].map((n) => (
              <span key={n} data-count className="display absolute text-[min(30vw,180px)] text-foreground">
                {n}
              </span>
            ))}
          </div>
          <span className="absolute bottom-[12vh] font-mono text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
            régie · bobine 1 · 2.39:1
          </span>
        </div>
      </div>

      <div data-beam className="beam pointer-events-none absolute inset-x-0 top-0 h-[120vh]" aria-hidden />

      <div className="relative mx-auto max-w-[1680px] px-4 sm:px-8">
        <div data-hero-fade className="mb-8 flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          <span className="inline-flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-signal" />
            Open source · MIT · auto-hébergé
          </span>
          <span className="hidden sm:inline">SC. 00 — Ouverture</span>
        </div>

        <h1 id="hero-title" data-split className="display text-[clamp(3.5rem,13vw,15.5rem)] text-balance">
          <span className="block">
            Une <em>bible</em>,
          </span>
          <span className="block sm:pl-[8vw]">
            un <em>découpage</em>,
          </span>
          <span className="block">
            <span className="text-signal">N</span> moteurs.
          </span>
        </h1>

        <div className="mt-10 grid gap-10 md:mt-14 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <p data-hero-fade className="max-w-xl text-lg leading-relaxed text-muted-foreground text-pretty sm:text-xl">
            Le studio open source pour faire un film avec l’IA, de l’idée au montage, sans que vos personnages changent de visage d’un plan à
            l’autre.
          </p>
          <div data-hero-fade className="flex flex-col gap-3 sm:flex-row">
            <a
              href={repoUrl}
              className="group inline-flex h-12 items-center justify-center gap-2.5 rounded-full bg-foreground px-6 text-[15px] font-medium text-background transition-colors hover:bg-signal hover:text-foreground"
            >
              <GitHubMark className="size-[18px]" />
              Voir sur GitHub
            </a>
            <Link
              href="/docs"
              className="group inline-flex h-12 items-center justify-center gap-2 rounded-full border border-border-strong px-6 text-[15px] font-medium transition-colors hover:border-foreground"
            >
              Lire la documentation
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden />
            </Link>
          </div>
        </div>
      </div>

      {/* Le cadre de projection */}
      <div data-frame-wrap className="relative mx-auto mt-20 max-w-[1440px] px-4 sm:px-8 md:mt-28">
        <div className="glow-signal pointer-events-none absolute -inset-x-20 -bottom-20 top-1/3 opacity-60" aria-hidden />
        <div data-frame className="relative">
          <div className="mb-3 flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            <span>
              <span className="text-signal-bright">●</span> Projection — vue d’ensemble du projet
            </span>
            <span className="hidden sm:inline">1920 × 1200</span>
          </div>
          <div data-tilt className="crop will-change-transform">
            <span className="crop-b" aria-hidden />
            <figure className="relative overflow-hidden rounded-[4px] bg-black shadow-[0_60px_160px_-40px_oklch(0.6_0.19_40/0.35),var(--shadow-frame)] ring-1 ring-white/10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/screens/hero.webp"
                alt="Capture de régie : la vue d’ensemble d’un projet, avec le parcours de fabrication en dix étapes et le panneau de contrôle de continuité."
                width={1920}
                height={1200}
                fetchPriority="high"
                className="block aspect-[16/10] h-auto w-full"
              />
              <div data-lamp className="absolute inset-0 bg-[oklch(0.06_0.004_60)] opacity-0" aria-hidden />
            </figure>
          </div>
        </div>
      </div>

      {/* Principes, façon carton de générique */}
      <div className="relative mx-auto max-w-[1440px] px-4 pb-8 pt-24 sm:px-8 md:pt-32">
        <dl className="grid gap-10 border-t border-border pt-10 md:grid-cols-3 md:gap-8">
          {[
            ['Aucune génération simulée', 'Sans fournisseur configuré, l’interface le dit et propose de le configurer. Rien ne fait semblant.'],
            ['Aucun fournisseur câblé', 'Chaque fournisseur est un adapter derrière une interface commune. On en change sans toucher au reste.'],
            ['Contrôler avant de dépenser', 'Le contrôle de continuité bloque les plans sans référence, avant qu’ils ne coûtent des crédits.'],
          ].map(([t, d], i) => (
            <div key={t} data-reveal data-delay={i * 0.1}>
              <span className="font-mono text-[11px] text-signal-bright">0{i + 1}</span>
              <dt className="display mt-3 text-[2rem] leading-none sm:text-[2.4rem]">{t}</dt>
              <dd className="mt-3 max-w-sm text-[15px] leading-relaxed text-muted-foreground">{d}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
