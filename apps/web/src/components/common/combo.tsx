'use client';

import type { Preset, PresetGroup } from '@regie/core';
import { Check, ChevronsUpDown, Plus, X } from 'lucide-react';
import { useState } from 'react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

type Options = Preset[] | PresetGroup[];
const isGrouped = (o: Options): o is PresetGroup[] => !!o.length && 'group' in o[0];
const groupsOf = (o: Options): PresetGroup[] => (isGrouped(o) ? o : [{ group: '', items: o as Preset[] }]);

function OptionList({ options, selected, onPick, query, setQuery, placeholder }: { options: Options; selected: string[]; onPick: (v: string) => void; query: string; setQuery: (q: string) => void; placeholder: string }) {
  const q = query.trim();
  const known = groupsOf(options).some((g) => g.items.some((i) => i.value.toLowerCase() === q.toLowerCase()));
  return (
    <Command>
      <CommandInput placeholder={placeholder} value={query} onValueChange={setQuery} />
      <CommandList>
        <CommandEmpty>{q ? 'Aucune suggestion.' : 'Rien à proposer.'}</CommandEmpty>
        {groupsOf(options).map((g) => (
          <CommandGroup key={g.group || 'all'} heading={g.group || undefined}>
            {g.items.map((i) => (
              <CommandItem key={i.value} value={`${i.value} ${i.label ?? ''} ${i.hint ?? ''}`} onSelect={() => onPick(i.value)}>
                <Check className={cn(selected.includes(i.value) ? 'opacity-100' : 'opacity-0')} />
                <span>{i.label ?? i.value}</span>
                {i.hint && <span className="ml-auto text-xs text-muted-foreground">{i.hint}</span>}
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
        {/* La saisie libre en dernier : Entrée choisit d'abord une suggestion. */}
        {q && !known && (
          <CommandGroup>
            <CommandItem value={`__free__${q}`} onSelect={() => onPick(q)}>
              <Plus /> Utiliser « {q} »
            </CommandItem>
          </CommandGroup>
        )}
      </CommandList>
    </Command>
  );
}

/**
 * Une valeur, choisie dans des suggestions ou tapée librement. Les
 * suggestions aident sans enfermer : « Utiliser … » garde toute saisie.
 */
export function ComboField({ label, hint, value, onChange, options, placeholder = 'Choisir ou saisir…', display, className }: { label?: React.ReactNode; hint?: React.ReactNode; value: string | null | undefined; onChange: (v: string | null) => void; options: Options; placeholder?: string; display?: (v: string) => React.ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const current = groupsOf(options).flatMap((g) => g.items).find((i) => i.value === value);
  return (
    <div className={cn('space-y-1.5', className)}>
      {label && <Label>{label}</Label>}
      <Popover
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setQuery('');
        }}
      >
        <PopoverTrigger asChild>
          <button type="button" className="flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-left text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30">
            <span className={cn('truncate', !value && 'text-muted-foreground')}>{value ? (display ? display(value) : (current?.label ?? value)) : placeholder}</span>
            <span className="flex shrink-0 items-center gap-1 text-muted-foreground">
              {value && (
                <X
                  className="size-3.5 hover:text-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange(null);
                  }}
                />
              )}
              <ChevronsUpDown className="size-3.5" />
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-(--radix-popover-trigger-width) min-w-64 p-0" align="start">
          <OptionList
            options={options}
            selected={value ? [value] : []}
            query={query}
            setQuery={setQuery}
            placeholder="Rechercher ou saisir…"
            onPick={(v) => {
              onChange(v);
              setOpen(false);
              setQuery('');
            }}
          />
        </PopoverContent>
      </Popover>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Plusieurs valeurs (thèmes, tons, inspirations), en pastilles, avec suggestions et saisie libre. */
export function ComboTags({ label, hint, value, onChange, options, placeholder = 'Ajouter…', className }: { label?: React.ReactNode; hint?: React.ReactNode; value: string[]; onChange: (v: string[]) => void; options: Options; placeholder?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const toggle = (v: string) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  return (
    <div className={cn('space-y-1.5', className)}>
      {label && <Label>{label}</Label>}
      <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1.5">
        {value.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 rounded-sm bg-secondary px-2 py-0.5 text-sm">
            {t}
            <button type="button" onClick={() => toggle(t)} className="text-muted-foreground hover:text-foreground" aria-label={`Retirer ${t}`}>
              <X className="size-3" />
            </button>
          </span>
        ))}
        <Popover
          open={open}
          onOpenChange={(o) => {
            setOpen(o);
            if (!o) setQuery('');
          }}
        >
          <PopoverTrigger asChild>
            <button type="button" className="inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground">
              <Plus className="size-3.5" /> {value.length ? 'Ajouter' : placeholder}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-0" align="start">
            <OptionList
              options={options}
              selected={value}
              query={query}
              setQuery={setQuery}
              placeholder="Rechercher ou saisir…"
              onPick={(v) => {
                toggle(v);
                setQuery('');
              }}
            />
          </PopoverContent>
        </Popover>
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Pour les champs texte qui stockent plusieurs valeurs : « a, b, c » ↔ ['a', 'b', 'c']. */
export const splitList = (s: string | null | undefined) =>
  (s ?? '')
    .split(/[,\n]/)
    .map((x) => x.trim())
    .filter(Boolean);
export const joinList = (a: string[]) => a.join(', ');
