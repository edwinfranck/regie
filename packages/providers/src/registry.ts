import { anthropic } from './adapters/anthropic';
import { comfyui } from './adapters/comfyui';
import { customHttp } from './adapters/custom-http';
import { elevenlabs } from './adapters/elevenlabs';
import { fal } from './adapters/fal';
import { google } from './adapters/google';
import { luma } from './adapters/luma';
import { ollama } from './adapters/ollama';
import { openai, openaiCompatible } from './adapters/openai';
import { replicate } from './adapters/replicate';
import { runway } from './adapters/runway';
import { ProviderError } from './errors';
import type { Capability, ProviderAdapter } from './types';

// Le registre des adapters. Ajouter un fournisseur = écrire un fichier dans
// adapters/ et l'inscrire ici. Rien d'autre ne bouge dans l'application.
export const ADAPTERS: Record<string, ProviderAdapter> = Object.fromEntries(
  [openai, anthropic, google, fal, replicate, runway, luma, elevenlabs, ollama, comfyui, openaiCompatible, customHttp].map((a) => [a.meta.id, a]),
);

export function getAdapter(id: string): ProviderAdapter {
  const a = ADAPTERS[id];
  if (!a) throw new ProviderError('not_configured', `Adapter inconnu : ${id}.`);
  return a;
}

export const listAdapters = () => Object.values(ADAPTERS).map((a) => a.meta);

const KEY: Record<Capability, keyof ProviderAdapter> = { TEXT: 'text', IMAGE: 'image', VIDEO: 'video', AUDIO: 'audio', EMBEDDING: 'text' };
export const supports = (a: ProviderAdapter, c: Capability) => !!a[KEY[c]];
