'use client';

import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useEffect } from 'react';
import { create } from 'zustand';

type Crumb = { label: string; href?: string };
const useCrumbStore = create<{ crumbs: Crumb[]; set: (c: Crumb[]) => void }>((set) => ({ crumbs: [], set: (crumbs) => set({ crumbs }) }));

/** Déclare le fil d'Ariane affiché dans la barre du haut. */
export function SetCrumbs({ crumbs }: { crumbs: Crumb[] }) {
  const set = useCrumbStore((s) => s.set);
  const key = JSON.stringify(crumbs);
  useEffect(() => {
    set(JSON.parse(key));
    return () => set([]);
  }, [key, set]);
  return null;
}

export function Crumbs() {
  const crumbs = useCrumbStore((s) => s.crumbs);
  return (
    <nav className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
      {crumbs.map((c, i) => (
        <span key={i} className="flex min-w-0 items-center gap-1.5">
          <ChevronRight className="size-3.5 shrink-0" />
          {c.href ? (
            <Link href={c.href} className="truncate hover:text-foreground">
              {c.label}
            </Link>
          ) : (
            <span className="truncate text-foreground">{c.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
