'use client';

import Link from 'next/link';
import { useRef } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { GitHubMark } from '@/components/github-mark';
import { Wordmark } from '@/components/wordmark';
import { repoUrl } from '@/lib/shared';
import { gsap, MQ, ScrollTrigger, timecode, useGSAP } from './gsap';

const NAV = [
  { href: '#parcours', label: 'Parcours', n: '02' },
  { href: '#bible', label: 'Bible', n: '03' },
  { href: '#coherence', label: 'Cohérence', n: '04' },
  { href: '#montage', label: 'Montage', n: '05' },
  { href: '#fournisseurs', label: 'Fournisseurs', n: '06' },
  { href: '#open-source', label: 'Open source', n: '07' },
];

/** Durée « projetée » de la page, pour le timecode de la navigation. */
const RUNTIME = 4 * 60 + 50;

export function SiteHeader() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const bar = root.current!.querySelector<HTMLElement>('[data-progress]')!;
      const tc = root.current!.querySelector<HTMLElement>('[data-tc]')!;
      const setBar = gsap.quickSetter(bar, 'scaleX');
      ScrollTrigger.create({
        start: 0,
        end: 'max',
        onUpdate: (self) => {
          setBar(self.progress);
          tc.textContent = timecode(self.progress * RUNTIME);
          root.current!.toggleAttribute('data-compact', self.scroll() > 40);
        },
      });
    },
    { scope: root },
  );

  return (
    <header
      ref={root}
      className="group/h fixed inset-x-0 top-0 z-50 transition-[background-color,border-color] duration-500 data-[compact]:border-b data-[compact]:border-border/70 data-[compact]:bg-background/80 data-[compact]:backdrop-blur-md"
    >
      <div className="mx-auto flex h-16 max-w-[1680px] items-center gap-8 px-4 sm:px-8">
        <Link href="/" className="inline-flex min-h-11 items-center text-[17px]" aria-label="régie, accueil">
          <Wordmark />
        </Link>
        <nav className="hidden items-center gap-6 text-[13px] text-muted-foreground lg:flex" aria-label="Chapitres">
          {NAV.map((n) => (
            <a key={n.href} href={n.href} className="group/l inline-flex min-h-11 items-center gap-1.5 transition-colors hover:text-foreground">
              <span className="font-mono text-[10px] text-faint transition-colors group-hover/l:text-signal-bright">{n.n}</span>
              {n.label}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2 sm:gap-4">
          <span className="hidden items-center gap-2 font-mono text-[11px] tabular-nums text-muted-foreground xl:inline-flex" aria-hidden>
            <span className="size-1.5 rounded-full bg-signal motion-safe:animate-pulse" />
            TC <span data-tc>00:00:00:00</span>
          </span>
          <Link href="/docs" className="inline-flex min-h-11 items-center px-2 text-[13px] font-medium transition-colors hover:text-signal-bright">
            Documentation
          </Link>
          <a
            href={repoUrl}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border-strong px-4 text-[13px] font-medium transition-colors hover:border-foreground hover:bg-foreground hover:text-background"
          >
            <GitHubMark className="size-4" />
            <span className="hidden sm:inline">GitHub</span>
            <span className="sr-only sm:hidden">GitHub</span>
          </a>
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0 h-px">
        <div data-progress className="h-full origin-left scale-x-0 bg-signal" />
      </div>
    </header>
  );
}

const CREDITS: [string, string][] = [
  ['Réalisation', 'vous'],
  ['Scénario', 'vous, avec l’assistant si vous le voulez'],
  ['Bible', 'personnages, lieux, objets, style, lumière'],
  ['Compilation des prompts', 'packages/core'],
  ['Contrôle de continuité', 'à chaque affichage'],
  ['Moteurs', 'ceux que vous choisissez'],
  ['Hébergement', 'chez vous'],
  ['Licence', 'MIT'],
];

const LINKS = [
  { href: '/docs', label: 'Documentation' },
  { href: '/docs/demarrage-rapide', label: 'Démarrage rapide' },
  { href: '/docs/contribuer', label: 'Contribuer' },
  { href: '/docs/feuille-de-route', label: 'Feuille de route' },
  { href: repoUrl, label: 'GitHub', external: true },
  { href: `${repoUrl}/issues`, label: 'Signaler un problème', external: true },
  { href: `${repoUrl}/blob/main/LICENSE`, label: 'Licence MIT', external: true },
];

/** Générique de fin : les crédits montent au défilement. */
export function SiteFooter() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MQ.motion, () => {
        gsap.fromTo(
          '[data-credits]',
          { yPercent: 35 },
          {
            yPercent: -10,
            ease: 'none',
            scrollTrigger: { trigger: root.current, start: 'top bottom', end: 'bottom bottom', scrub: 1 },
          },
        );
        gsap.from('[data-credit]', {
          autoAlpha: 0,
          duration: 1,
          ease: 'power3.out',
          stagger: 0.07,
          scrollTrigger: { trigger: '[data-credits]', start: 'top 85%' },
        });
      });
    },
    { scope: root },
  );

  return (
    <footer ref={root} className="relative overflow-hidden border-t border-border bg-code">
      <div className="mx-auto max-w-[1680px] px-4 pb-10 pt-28 sm:px-8 md:pt-40">
        <div data-credits className="mx-auto max-w-2xl text-center">
          <p data-credit className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
            Une production
          </p>
          <p data-credit className="display mt-4 text-[clamp(4rem,12vw,10rem)]">
            régie
          </p>
          <dl className="mt-16 space-y-7">
            {CREDITS.map(([role, who]) => (
              <div key={role} data-credit>
                <dt className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted-foreground">{role}</dt>
                <dd className="display mt-1.5 text-[clamp(1.6rem,3vw,2.25rem)] leading-tight">{who}</dd>
              </div>
            ))}
          </dl>
          <p data-credit className="mt-20 font-mono text-[11px] uppercase tracking-[0.3em] text-signal-bright">
            Fin
          </p>
        </div>

        <nav aria-label="Pied de page" className="mt-28 border-t border-border pt-8">
          <ul className="flex flex-wrap gap-x-7 gap-y-1 text-sm text-muted-foreground">
            {LINKS.map((l) => (
              <li key={l.label}>
                {l.external ? (
                  <a href={l.href} className="inline-flex min-h-11 items-center gap-1 transition-colors hover:text-foreground">
                    {l.label}
                    <ArrowUpRight className="size-3" aria-hidden />
                  </a>
                ) : (
                  <Link href={l.href} className="inline-flex min-h-11 items-center transition-colors hover:text-foreground">
                    {l.label}
                  </Link>
                )}
              </li>
            ))}
          </ul>
          <div className="mt-6 flex flex-col gap-2 font-mono text-[11px] text-muted-foreground sm:flex-row sm:justify-between">
            <span>régie — logiciel libre sous licence MIT · edwinfranck/regie</span>
            <span aria-hidden>
              FIN DE BOBINE · <span className="text-signal-bright">●</span> REC
            </span>
          </div>
        </nav>
      </div>
    </footer>
  );
}
