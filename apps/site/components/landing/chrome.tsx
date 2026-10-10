import Link from 'next/link';
import { ArrowRight, BookOpen } from 'lucide-react';
import { GitHubMark } from '@/components/github-mark';
import { Wordmark } from '@/components/wordmark';
import { appUrl, repoUrl } from '@/lib/shared';

const NAV = [
  { href: '#parcours', label: 'Parcours' },
  { href: '#la-bible', label: 'Bible' },
  { href: '#coherence', label: 'Cohérence' },
  { href: '#fournisseurs', label: 'Fournisseurs' },
  { href: '#open-source', label: 'Open source' },
];

export function SiteHeader() {
  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-40 flex justify-center px-4 pt-3 sm:pt-4">
      <div className="pointer-events-auto flex h-12 w-full max-w-4xl items-center gap-2 rounded-full border border-border/80 bg-background/80 px-2 pl-4 shadow-[0_1px_2px_oklch(0_0_0/0.05),0_12px_28px_-16px_oklch(0_0_0/0.3)] backdrop-blur-xl sm:gap-4">
        <Link href="/" className="text-[16px]" aria-label="régie, accueil">
          <Wordmark />
        </Link>
        <nav className="ml-1 hidden items-center gap-4 text-[13.5px] text-muted-foreground lg:flex" aria-label="Sections">
          {NAV.map((n) => (
            <a key={n.href} href={n.href} className="transition-colors hover:text-foreground">
              {n.label}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1.5">
          <a
            href={repoUrl}
            aria-label="Dépôt GitHub"
            className="hidden size-8 items-center justify-center rounded-full border border-border transition-colors hover:bg-secondary sm:inline-flex"
          >
            <GitHubMark className="size-4" />
          </a>
          <a
            href={appUrl}
            className="group inline-flex h-8 items-center gap-1.5 rounded-full bg-foreground px-3.5 text-[13.5px] font-medium text-background transition-opacity hover:opacity-90"
          >
            Essayer
            <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
          </a>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="panel-dark border-t border-border">
      <div className="mx-auto max-w-[1600px] px-4 py-12 sm:px-6 lg:px-10">
        <div className="flex flex-col gap-7 sm:flex-row sm:items-end sm:justify-between">
          {/* Texte au-dessus : titre en blanc, baseline sur deux lignes, en gris atténué */}
          <div>
            <Wordmark className="text-[17px]" />
            <p className="mt-3 max-w-md text-[13px] leading-relaxed text-muted-foreground/80">
              Studio de production audiovisuelle assistée par IA. Une bible, un découpage, N moteurs.
            </p>
          </div>
          {/* GitHub et doc sur la même ligne */}
          <div className="flex items-center gap-2.5">
            <a
              href={repoUrl}
              className="inline-flex h-9 items-center gap-2 rounded-full border border-border-strong px-4 text-[13.5px] font-medium transition-colors hover:bg-secondary"
            >
              <GitHubMark className="size-4" />
              GitHub
            </a>
            <Link
              href="/docs"
              className="inline-flex h-9 items-center gap-2 rounded-full border border-border-strong px-4 text-[13.5px] font-medium transition-colors hover:bg-secondary"
            >
              <BookOpen className="size-4" strokeWidth={1.75} />
              Documentation
            </Link>
          </div>
        </div>
        <div className="mt-8 flex flex-col gap-2 border-t border-border pt-5 text-xs text-muted-foreground/70 sm:flex-row sm:items-center sm:justify-between">
          <span>régie — logiciel libre sous licence MIT.</span>
          <a href={repoUrl} className="font-mono transition-colors hover:text-foreground">
            edwinfranck/regie
          </a>
        </div>
      </div>
    </footer>
  );
}
