'use client';

import { useQuery } from '@tanstack/react-query';
import { Check, CircleAlert, Clapperboard, Loader2, Moon, Search, Settings, Sun } from 'lucide-react';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import { signOut } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useLiveInvalidation } from '@/hooks/use-events';
import { useSaveStatus } from '@/hooks/use-project';
import { get } from '@/lib/client';
import { cn } from '@/lib/utils';
import { openCommandPalette } from './command-palette';
import { Notifications } from './notifications';

export interface SessionUser {
  id: string;
  name: string | null;
  email: string;
  isAdmin: boolean;
}

function SaveIndicator() {
  const state = useSaveStatus((s) => s.state);
  if (state === 'idle') return null;
  return (
    <span className={cn('flex items-center gap-1.5 text-sm', state === 'error' ? 'text-destructive' : 'text-muted-foreground')}>
      {state === 'saving' && <Loader2 className="size-3.5 animate-spin" />}
      {state === 'saved' && <Check className="size-3.5" />}
      {state === 'error' && <CircleAlert className="size-3.5" />}
      {state === 'saving' ? 'Enregistrement…' : state === 'saved' ? 'Enregistré' : 'Non enregistré'}
    </span>
  );
}

/** Nombre de générations en cours, tous projets confondus. */
function GenerationIndicator() {
  const { data } = useQuery({ queryKey: ['generations', 'active-global'], queryFn: () => get('/api/generations/active'), refetchInterval: 15_000 });
  const n = data?.count ?? 0;
  if (!n) return null;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link href={data.href ?? '#'} className="flex items-center gap-1.5 rounded-md bg-signal/10 px-2 py-1 text-sm font-medium text-signal">
          <Loader2 className="size-3.5 animate-spin" />
          {n} génération{n > 1 ? 's' : ''}
        </Link>
      </TooltipTrigger>
      <TooltipContent>En file ou en cours. Vous pouvez continuer à travailler.</TooltipContent>
    </Tooltip>
  );
}

export function TopBar({ user, children }: { user: SessionUser; children?: React.ReactNode }) {
  useLiveInvalidation();
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <div className="sticky top-0 z-30 flex h-12 items-center gap-3 border-b bg-background/95 px-3 backdrop-blur">
      <Link href="/" className="flex items-center gap-2 px-1 font-semibold tracking-tight">
        <Clapperboard className="size-5" />
        régie
      </Link>
      <div className="flex min-w-0 flex-1 items-center gap-2 text-sm">{children}</div>
      <SaveIndicator />
      <GenerationIndicator />
      <Button variant="outline" size="sm" className="w-56 justify-between text-muted-foreground" onClick={openCommandPalette}>
        <span className="flex items-center gap-2">
          <Search className="size-4" /> Rechercher, agir…
        </span>
        <kbd className="rounded-sm border px-1 font-mono text-[11px]">⌘K</kbd>
      </Button>
      <Notifications />
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon-sm" onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')} aria-label="Changer de thème">
            {resolvedTheme === 'dark' ? <Sun /> : <Moon />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>Thème {resolvedTheme === 'dark' ? 'clair' : 'sombre'}</TooltipContent>
      </Tooltip>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-2">
            <span className="flex size-6 items-center justify-center rounded-full bg-foreground text-xs font-semibold text-background">{(user.name ?? user.email)[0]?.toUpperCase()}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="font-normal">
            <div className="font-medium">{user.name}</div>
            <div className="text-xs text-muted-foreground">{user.email}</div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/settings/providers">
              <Settings /> Providers IA
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/settings/usage">Coûts et usage</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/settings/templates">Templates de prompts</Link>
          </DropdownMenuItem>
          {user.isAdmin && (
            <DropdownMenuItem asChild>
              <Link href="/admin">Administration</Link>
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => signOut({ callbackUrl: '/login' })}>Se déconnecter</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
