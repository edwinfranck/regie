'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, LayoutDashboard } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LAST_PROJECT_KEY } from '@/components/project/remember-project';
import { get } from '@/lib/client';
import { cn } from '@/lib/utils';

const ITEMS = [
  { href: '/settings/providers', label: 'Providers IA' },
  { href: '/settings/usage', label: 'Coûts et usage' },
  { href: '/settings/templates', label: 'Templates de prompts' },
];

export function SettingsNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const items = isAdmin ? [...ITEMS, { href: '/admin', label: 'Administration' }] : ITEMS;
  const [stored, setStored] = useState<{ id: string; title: string } | null>(null);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LAST_PROJECT_KEY);
      if (raw) setStored(JSON.parse(raw));
    } catch {}
  }, []);
  // Sans trace dans ce navigateur : le projet modifié le plus récemment.
  const { data: projects } = useQuery({ queryKey: ['projects'], queryFn: () => get('/api/projects'), enabled: !stored, staleTime: 60_000 });
  const last = stored ?? (projects?.[0] ? { id: projects[0].id, title: projects[0].title } : null);
  return (
    <nav className="no-scrollbar space-y-0.5 overflow-y-auto p-3">
      <div className="mb-3 space-y-0.5 border-b pb-3">
        {last && (
          <Link href={`/projects/${last.id}`} className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm font-medium hover:bg-accent">
            <ArrowLeft className="size-4 shrink-0" />
            <span className="truncate">Retour à {last.title}</span>
          </Link>
        )}
        <Link href="/" className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground">
          <LayoutDashboard className="size-4 shrink-0" /> Tableau de bord
        </Link>
      </div>
      <p className="px-2 pt-2 pb-3 text-sm font-medium">Réglages</p>
      {items.map((i) => {
        const active = pathname.startsWith(i.href);
        return (
          <Link key={i.href} href={i.href} className={cn('block rounded-sm px-2 py-1.5 text-sm transition-colors', active ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-accent hover:text-foreground')}>
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
