import { createFromSource } from 'fumadocs-core/search/server';
import { source } from '@/lib/source';

// Recherche plein texte sur l'index des pages, en mémoire : aucun service externe.
export const { GET } = createFromSource(source);
