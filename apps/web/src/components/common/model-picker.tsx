'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { get } from '@/lib/client';
import { cn } from '@/lib/utils';

export interface ModelOption {
  id: string;
  label: string;
  modelId: string;
  capability: string;
  modes: string[];
  pricing: { unit?: string; usd?: number };
  maxDuration?: number | null;
  aspectRatios: string[];
  enabled: boolean;
  provider: { id: string; name: string; adapter: string; configured: boolean; enabled: boolean };
}

/** Les modèles utilisables, tous providers confondus. */
export function useModels(capability?: string) {
  return useQuery({
    queryKey: ['providers'],
    queryFn: () => get('/api/providers'),
    staleTime: 60_000,
    select: (d: any) => {
      const models: ModelOption[] = d.providers.flatMap((p: any) => p.models.map((m: any) => ({ ...m, provider: { id: p.id, name: p.name, adapter: p.adapter, configured: p.configured, enabled: p.enabled } })));
      return capability ? models.filter((m) => m.capability === capability) : models;
    },
  });
}

export const usable = (m: ModelOption) => m.enabled && m.provider.enabled && m.provider.configured;

const price = (m: ModelOption) => (m.pricing?.usd === undefined ? '' : m.pricing.usd === 0 ? 'gratuit' : `${m.pricing.usd} $/${{ image: 'image', second: 's', '1k_tokens': '1k tok', request: 'appel', '1k_chars': '1k car.' }[m.pricing.unit ?? 'request'] ?? m.pricing.unit}`);

/**
 * AUTO ou un modèle précis. Les modèles d'un provider non configuré restent
 * visibles mais inactifs, avec le lien pour le configurer.
 */
export function ModelPicker({ capability, mode, value, onChange, label = 'Modèle', className }: { capability: string; mode?: string; value: string; onChange: (v: string) => void; label?: string; className?: string }) {
  const { data: models = [], isLoading } = useModels(capability);
  // L'avertissement dépend de données client : jamais au rendu serveur (hydratation).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const fitting = models.filter((m) => !mode || !m.modes.length || m.modes.includes(mode));
  const ready = fitting.filter(usable);
  const byProvider = new Map<string, ModelOption[]>();
  for (const m of fitting) byProvider.set(m.provider.name, [...(byProvider.get(m.provider.name) ?? []), m]);
  return (
    <div className={cn('space-y-1.5', className)}>
      {label && <Label>{label}</Label>}
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Modèle" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="auto">
            AUTO <span className="ml-1 text-xs text-muted-foreground">le routeur choisit ({ready.length} disponible{ready.length > 1 ? 's' : ''})</span>
          </SelectItem>
          {[...byProvider.entries()].map(([provider, list]) => (
            <SelectGroup key={provider}>
              <SelectLabel>{provider}</SelectLabel>
              {list.map((m) => (
                <SelectItem key={m.id} value={m.id} disabled={!usable(m)}>
                  {m.label}
                  <span className="ml-2 text-xs text-muted-foreground">{usable(m) ? price(m) : m.provider.configured ? 'désactivé' : 'non configuré'}</span>
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
      {mounted && !isLoading && ready.length === 0 && (
        <p className="text-xs text-destructive">
          Provider non configuré pour ce type de génération.{' '}
          <Link href="/settings/providers" className="underline underline-offset-2">
            Configurer un provider
          </Link>
        </p>
      )}
    </div>
  );
}
