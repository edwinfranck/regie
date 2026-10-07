import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { GitHubMark } from '@/components/github-mark';
import { Wordmark } from '@/components/wordmark';
import { repoUrl } from '@/lib/shared';

const NAV = [
  { href: '#parcours', label: 'Parcours' },
  { href: '#bible', label: 'Bible' },
  { href: '#coherence', label: 'Cohérence' },
  { href: '#fournisseurs', label: 'Fournisseurs' },
  { href: '#open-source', label: 'Open source' },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Link href="/" className="text-[17px]" aria-label="régie, accueil">
          <Wordmark />
        </Link>
        <nav className="hidden items-center gap-5 text-sm text-muted-foreground md:flex" aria-label="Sections">
          {NAV.map((n) => (
            <a key={n.href} href={n.href} className="transition-colors hover:text-foreground">
              {n.label}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Link href="/docs" className="inline-flex h-8 items-center rounded-[3px] px-3 text-sm font-medium transition-colors hover:bg-secondary">
            Documentation
          </Link>
          <a
            href={repoUrl}
            className="inline-flex h-8 items-center gap-2 rounded-[3px] border border-border px-3 text-sm font-medium transition-colors hover:border-border-strong hover:bg-secondary"
          >
            <GitHubMark className="size-4" />
            <span className="hidden sm:inline">GitHub</span>
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
        { href: '#bible', label: 'Bible et compilateur' },
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
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_repeat(3,1fr)]">
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
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span>régie — logiciel libre sous licence MIT.</span>
          <span className="font-mono">edwinfranck/regie</span>
        </div>
      </div>
    </footer>
  );
}
