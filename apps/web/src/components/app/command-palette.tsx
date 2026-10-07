'use client';

import { useQuery } from '@tanstack/react-query';
import { BookOpen, Bot, Clapperboard, Download, Film, Image as ImageIcon, MapPin, Plus, Search, User, Video } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from '@/components/ui/command';
import { get } from '@/lib/client';

const usePalette = create<{ open: boolean; set: (o: boolean) => void }>((set) => ({ open: false, set: (open) => set({ open }) }));
export const openCommandPalette = () => usePalette.getState().set(true);

// L'assistant s'ouvre depuis la palette : le panneau s'abonne à cet état.
export const useAssistantOpen = create<{ open: boolean; prompt?: string; set: (o: boolean, prompt?: string) => void }>((set) => ({ open: false, set: (open, prompt) => set({ open, prompt }) }));

const ICON: Record<string, React.ComponentType<{ className?: string }>> = { project: Clapperboard, character: User, location: MapPin, scene: Film, shot: Film, asset: ImageIcon, prompt: Search, script: BookOpen };
const TYPE_LABEL: Record<string, string> = { project: 'Projets', character: 'Personnages', location: 'Lieux', scene: 'Scènes', shot: 'Plans', asset: 'Assets', prompt: 'Prompts', script: 'Scénario' };

export function CommandPalette() {
  const { open, set } = usePalette();
  const [q, setQ] = useState('');
  const router = useRouter();
  const { projectId } = useParams<{ projectId?: string }>();
  const assistant = useAssistantOpen((s) => s.set);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        set(!usePalette.getState().open);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [set]);

  const { data } = useQuery({
    queryKey: ['search', q, projectId],
    queryFn: () => get(`/api/search?q=${encodeURIComponent(q)}${projectId ? `&projectId=${projectId}` : ''}`),
    enabled: q.trim().length >= 2,
    staleTime: 10_000,
  });
  const results: { type: string; label: string; href: string }[] = data?.results ?? [];
  const groups = [...new Set(results.map((r) => r.type))];
  const go = (href: string) => {
    set(false);
    setQ('');
    router.push(href);
  };
  const p = projectId ? `/projects/${projectId}` : null;

  return (
    <CommandDialog open={open} onOpenChange={set} title="Palette de commandes" description="Rechercher ou lancer une action">
      <CommandInput placeholder="Rechercher un personnage, une scène, un asset… ou taper une action" value={q} onValueChange={setQ} />
      <CommandList>
        <CommandEmpty>{q.length < 2 ? 'Tapez au moins deux lettres.' : 'Aucun résultat.'}</CommandEmpty>
        {groups.map((g) => {
          const Icon = ICON[g] ?? Search;
          return (
            <CommandGroup key={g} heading={TYPE_LABEL[g] ?? g}>
              {results
                .filter((r) => r.type === g)
                .map((r) => (
                  <CommandItem key={r.href + r.label} value={`${g} ${r.label}`} onSelect={() => go(r.href)}>
                    <Icon className="text-muted-foreground" />
                    <span className="truncate">{r.label}</span>
                  </CommandItem>
                ))}
            </CommandGroup>
          );
        })}
        {groups.length > 0 && <CommandSeparator />}
        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => go('/new')}>
            <Plus /> Nouveau film
          </CommandItem>
          {p && (
            <>
              <CommandItem onSelect={() => go(`${p}/characters?new=1`)}>
                <User /> Créer un personnage
              </CommandItem>
              <CommandItem onSelect={() => go(`${p}/locations?new=1`)}>
                <MapPin /> Créer un lieu
              </CommandItem>
              <CommandItem onSelect={() => go(`${p}/storyboard`)}>
                <Film /> Ouvrir le storyboard
              </CommandItem>
              <CommandItem onSelect={() => go(`${p}/images`)}>
                <ImageIcon /> Générer une image
              </CommandItem>
              <CommandItem onSelect={() => go(`${p}/videos`)}>
                <Video /> Générer une vidéo
              </CommandItem>
              <CommandItem onSelect={() => go(`${p}/assets`)}>
                <Search /> Chercher un asset
              </CommandItem>
              <CommandItem
                onSelect={() => {
                  set(false);
                  assistant(true, q.length > 3 ? q : undefined);
                }}
              >
                <Bot /> Demander à l’assistant{q.length > 3 ? ` : « ${q} »` : ''}
              </CommandItem>
              <CommandItem onSelect={() => go(`${p}/export`)}>
                <Download /> Exporter le projet
              </CommandItem>
            </>
          )}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
