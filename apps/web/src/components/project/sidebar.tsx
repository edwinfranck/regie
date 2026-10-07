'use client';

import {
  BookOpen,
  Bot,
  Boxes,
  ChevronsLeft,
  ChevronsRight,
  Clapperboard,
  Download,
  Film,
  Globe,
  Image as ImageIcon,
  LayoutDashboard,
  LayoutGrid,
  Lightbulb,
  ListTree,
  MapPin,
  Music,
  Network,
  Package,
  Settings,
  ShieldCheck,
  SquareKanban,
  Users,
  Video,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useAssistantOpen } from '../app/command-palette';

type Item = { href: string; label: string; icon: React.ComponentType<{ className?: string }>; soon?: boolean };

// Le parcours principal : de l'idée au film, dans l'ordre de fabrication.
// On peut revenir à n'importe quelle étape.
export const NAV: { title: string; items: Item[] }[] = [
  { title: '', items: [{ href: '', label: 'Vue d’ensemble', icon: LayoutDashboard }] },
  {
    title: 'Développement',
    items: [
      { href: '/concept', label: 'Concept', icon: Lightbulb },
      { href: '/story', label: 'Histoire', icon: ListTree },
      { href: '/characters', label: 'Personnages', icon: Users },
      { href: '/locations', label: 'Lieux', icon: MapPin },
      { href: '/props', label: 'Objets et costumes', icon: Package },
      { href: '/world', label: 'Monde', icon: Globe },
      { href: '/script', label: 'Scénario', icon: BookOpen },
    ],
  },
  {
    title: 'Préproduction',
    items: [
      { href: '/scenes', label: 'Scènes', icon: Film },
      { href: '/storyboard', label: 'Storyboard', icon: LayoutGrid },
      { href: '/continuity', label: 'Continuité', icon: ShieldCheck },
    ],
  },
  {
    title: 'Fabrication',
    items: [
      { href: '/assets', label: 'Assets', icon: Boxes },
      { href: '/images', label: 'Images', icon: ImageIcon },
      { href: '/videos', label: 'Vidéos', icon: Video },
      { href: '/audio', label: 'Audio', icon: Music },
    ],
  },
  {
    title: 'Production',
    items: [
      { href: '/production', label: 'Tableau de production', icon: SquareKanban },
      { href: '/timeline', label: 'Montage', icon: Clapperboard },
      { href: '/graph', label: 'Graphe du projet', icon: Network },
      { href: '/export', label: 'Export', icon: Download },
      { href: '/settings', label: 'Réglages du projet', icon: Settings },
    ],
  },
];

export function ProjectSidebar({ projectId }: { projectId: string }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const assistant = useAssistantOpen();
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem('regie:sidebar') === '1');
    } catch {}
  }, []);
  const toggle = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem('regie:sidebar', c ? '0' : '1');
      } catch {}
      return !c;
    });
  };
  const base = `/projects/${projectId}`;

  return (
    <aside className={cn('sticky top-12 flex h-[calc(100vh-3rem)] shrink-0 flex-col border-r bg-sidebar transition-[width]', collapsed ? 'w-14' : 'w-60')}>
      <nav className="no-scrollbar flex-1 space-y-4 overflow-y-auto px-2 py-3">
        {NAV.map((group) => (
          <div key={group.title} className="space-y-0.5">
            {group.title && !collapsed && <div className="px-2 pb-1 text-xs font-medium text-muted-foreground">{group.title}</div>}
            {group.items.map((item) => {
              const href = base + item.href;
              const active = item.href === '' ? pathname === base : pathname === href || pathname.startsWith(`${href}/`);
              const link = (
                <Link
                  key={item.href}
                  href={href}
                  className={cn(
                    'flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors',
                    active ? 'bg-sidebar-accent font-medium text-foreground' : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-foreground',
                    collapsed && 'justify-center px-0',
                  )}
                >
                  <item.icon className={cn('size-4 shrink-0', active && 'text-signal')} />
                  {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
                  {!collapsed && item.soon && <span className="rounded-sm border px-1 text-[10px] text-muted-foreground">phase 2</span>}
                </Link>
              );
              return collapsed ? (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>{link}</TooltipTrigger>
                  <TooltipContent side="right">{item.label}</TooltipContent>
                </Tooltip>
              ) : (
                link
              );
            })}
          </div>
        ))}
      </nav>
      <div className="space-y-1 border-t p-2">
        <button
          onClick={() => assistant.set(!assistant.open)}
          className={cn('flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-sm font-medium transition-colors', assistant.open ? 'bg-foreground text-background' : 'bg-secondary hover:bg-accent', collapsed && 'justify-center px-0')}
        >
          <Bot className="size-4" />
          {!collapsed && 'Assistant IA'}
        </button>
        <button onClick={toggle} className={cn('flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent', collapsed && 'justify-center px-0')} aria-label={collapsed ? 'Déplier' : 'Replier'}>
          {collapsed ? <ChevronsRight className="size-4" /> : <ChevronsLeft className="size-4" />}
          {!collapsed && 'Replier'}
        </button>
      </div>
    </aside>
  );
}
