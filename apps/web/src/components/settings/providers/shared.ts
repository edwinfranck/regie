'use client';

import { GENERATION_MODES } from '@regie/core';

// Types côté interface de GET /api/providers. La clé n'y figure jamais :
// seulement `hasKey` et son indice `apiKeyHint` (« …ab12 »).

export type Capability = 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'EMBEDDING';
export type PriceUnit = 'image' | 'second' | '1k_tokens' | 'request' | '1k_chars';

export interface ConfigField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'json';
  placeholder?: string;
  help?: string;
  required?: boolean;
}

export interface KnownEndpoint {
  id: string;
  label: string;
  baseUrl: string;
  docsUrl?: string;
  capabilities: Capability[];
  note?: string;
}

export interface AdapterMeta {
  id: string;
  label: string;
  description: string;
  capabilities: Capability[];
  local?: boolean;
  needsApiKey: boolean;
  optionalApiKey?: boolean;
  needsBaseUrl?: boolean;
  defaultBaseUrl?: string;
  docsUrl?: string;
  fields?: ConfigField[];
  presets: unknown[];
  endpoints?: KnownEndpoint[];
}

export interface ModelRow {
  id: string;
  providerId: string;
  modelId: string;
  label: string;
  capability: Capability;
  modes: string[];
  pricing: { unit?: PriceUnit; usd?: number };
  quality: number;
  speed: number;
  maxDuration: number | null;
  aspectRatios: string[];
  enabled: boolean;
}

export interface ProviderRow {
  id: string;
  workspaceId: string | null;
  name: string;
  adapter: string;
  baseUrl: string | null;
  apiKeyHint: string | null;
  hasKey: boolean;
  config: Record<string, unknown>;
  isLocal: boolean;
  enabled: boolean;
  configured: boolean;
  canManage: boolean;
  models: ModelRow[];
}

export interface RouteRow {
  id: string;
  task: string;
  modelId: string;
  priority: number;
  workspaceId: string | null;
}

export interface ProvidersData {
  adapters: AdapterMeta[];
  providers: ProviderRow[];
  routes: RouteRow[];
  isAdmin: boolean;
}

export const CAPABILITY_LABELS: Record<Capability, string> = { TEXT: 'Texte', IMAGE: 'Image', VIDEO: 'Vidéo', AUDIO: 'Audio', EMBEDDING: 'Embedding' };
export const CAPABILITY_OPTIONS = (Object.keys(CAPABILITY_LABELS) as Capability[]).map((c) => ({ value: c, label: CAPABILITY_LABELS[c] }));

export const PRICE_UNITS: Record<PriceUnit, string> = { image: 'par image', second: 'par seconde', '1k_tokens': 'par 1k tokens', request: 'par appel', '1k_chars': 'par 1k caractères' };
/** Libellés courts pour le tableau des modèles. */
export const PRICE_UNITS_SHORT: Record<PriceUnit, string> = { image: '/ image', second: '/ seconde', '1k_tokens': '/ 1k tokens', request: '/ appel', '1k_chars': '/ 1k car.' };
export const PRICE_UNIT_OPTIONS = (Object.keys(PRICE_UNITS) as PriceUnit[]).map((u) => ({ value: u, label: PRICE_UNITS[u] }));

/** Les modes qui ont un sens pour chaque capacité. */
export const MODES_BY_CAPABILITY: Record<Capability, string[]> = {
  TEXT: ['text'],
  IMAGE: ['text-to-image', 'image-to-image'],
  VIDEO: ['text-to-video', 'image-to-video', 'first-last-frame', 'reference-to-video'],
  AUDIO: ['text-to-speech', 'sound-effect', 'music'],
  EMBEDDING: ['text'],
};
export const modeLabel = (m: string) => GENERATION_MODES[m as keyof typeof GENERATION_MODES] ?? m;

/** Tâches de routage ↔ capacité des modèles qui peuvent les servir. */
export const TASK_CAPABILITY: Record<string, Capability> = { TEXT: 'TEXT', IMAGE_GENERATION: 'IMAGE', VIDEO_GENERATION: 'VIDEO', AUDIO_GENERATION: 'AUDIO', EMBEDDING: 'EMBEDDING' };

/** Adapters capables de lister eux-mêmes leurs modèles. */
export const DISCOVERABLE = new Set(['ollama', 'comfyui', 'openai-compatible']);

export const fmtUsd = (n: number) => (n === 0 ? '0 $' : n < 0.01 ? `${n.toFixed(4)} $` : `${n.toFixed(2)} $`);

/** Valeur éditable d'un champ de configuration (objet JSON → texte indenté). */
export function fieldToText(f: ConfigField, v: unknown) {
  if (v === undefined || v === null) return '';
  if (f.type === 'json') return typeof v === 'string' ? v : JSON.stringify(v, null, 2);
  return String(v);
}

/**
 * Convertit les valeurs saisies en objet de configuration. Le JSON est validé
 * ici, avant l'envoi, pour que l'erreur pointe le bon champ.
 */
export function buildConfig(fields: ConfigField[], values: Record<string, string>): { config: Record<string, unknown>; error: string | null } {
  const config: Record<string, unknown> = {};
  for (const f of fields) {
    const raw = (values[f.key] ?? '').trim();
    if (!raw) {
      if (f.required) return { config, error: `« ${f.label} » est obligatoire.` };
      continue;
    }
    if (f.type === 'json') {
      try {
        config[f.key] = JSON.parse(raw);
      } catch (e) {
        return { config, error: `« ${f.label} » n’est pas un JSON valide : ${(e as Error).message}` };
      }
    } else if (f.type === 'number') {
      const n = Number(raw);
      if (!Number.isFinite(n)) return { config, error: `« ${f.label} » doit être un nombre.` };
      config[f.key] = n;
    } else config[f.key] = raw;
  }
  return { config, error: null };
}
