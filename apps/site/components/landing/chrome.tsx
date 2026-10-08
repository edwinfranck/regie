import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { GitHubMark } from '@/components/github-mark';
import { Wordmark } from '@/components/wordmark';
import { repoUrl } from '@/lib/shared';

const NAV = [
  { href: '#parcours', label: 'Parcours' },
  { href: '#la-bible', label: 'Bible' },
  { href: '#coherence', label: 'Cohérence' },
  { href: '#fournisseurs', label: 'Fournisseurs' },
  { href: '#open-source', label: 'Open source' },
];

async function stars(): Promise<string | null> {
  try {
    const res = await fetch('https://api.github.com/repos/edwinfranck/regie', { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const n = (await res.json()).stargazers_count as number;
    return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
  } catch {
    return null;
  }
}

export async function SiteHeader() {
  const count = await stars();
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
          <Link href="/docs" className="hidden h-8 items-center rounded-full px-3 text-[13.5px] font-medium transition-colors hover:bg-secondary sm:inline-flex">
            Documentation
          </Link>
          <a
            href={repoUrl}
            className="inline-flex h-8 items-center gap-2 rounded-full bg-foreground px-3.5 text-[13.5px] font-medium text-background transition-opacity hover:opacity-90"
          >
            <GitHubMark className="size-4" />
            GitHub
            {count && <span className="font-mono text-[11px] text-background/60">★ {count}</span>}
          </a>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  const cols = [
    {
      title: 'Produit',
      links: [
        { href: '#parcours', label: 'Le parcours' },
        { href: '#la-bible', label: 'Bible et compilateur' },
        { href: '#fournisseurs', label: 'Fournisseurs' },
        { href: '/docs/feuille-de-route', label: 'Feuille de route' },
      ],
    },
    {
      title: 'Documentation',
      links: [
        { href: '/docs/demarrage-rapide', label: 'Démarrage rapide' },
        { href: '/docs/guide', label: 'Guide d’utilisation' },
        { href: '/docs/providers', label: 'Providers' },
        { href: '/docs/deploiement', label: 'Déploiement' },
      ],
    },
    {
      title: 'Projet',
      links: [
        { href: repoUrl, label: 'Code source', external: true },
        { href: `${repoUrl}/issues`, label: 'Signaler un problème', external: true },
        { href: '/docs/contribuer', label: 'Contribuer' },
        { href: `${repoUrl}/blob/main/LICENSE`, label: 'Licence MIT', external: true },
      ],
    },
  ];

  return (
    <footer className="border-t border-border">
      <div className="mx-auto grid max-w-[1600px] grid-cols-2 gap-10 px-4 py-14 sm:px-6 lg:px-10 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="col-span-2 max-w-xs md:col-span-1">
          <Wordmark className="text-[17px]" />
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Studio de production audiovisuelle assistée par IA. Une bible, un découpage, N moteurs.
          </p>
        </div>
        {cols.map((c) => (
          <div key={c.title}>
            <h3 className="text-sm font-medium">{c.title}</h3>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {c.links.map((l) => (
                <li key={l.label}>
                  {'external' in l ? (
                    <a href={l.href} className="inline-flex items-center gap-1 transition-colors hover:text-foreground">
                      {l.label}
                      <ArrowUpRight className="size-3" />
                    </a>
                  ) : (
                    <Link href={l.href} className="transition-colors hover:text-foreground">
                      {l.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-border">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-2 px-4 py-5 lg:px-10 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span>régie — logiciel libre sous licence MIT.</span>
          <a href={repoUrl} className="font-mono transition-colors hover:text-foreground">edwinfranck/regie</a>
        </div>
      </div>
    </footer>
  );
}
