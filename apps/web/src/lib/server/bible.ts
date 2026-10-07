import { CODE_PREFIX, characterSchema, lightSchema, locationSchema, nextCode, propSchema, styleSchema } from '@regie/core';
import { prisma } from '@regie/db';
import type { Action, Versioned } from '@regie/studio';
import type { ZodObject } from 'zod';
import { HttpError } from '@/lib/api';

// Les cinq familles de la bible partagent le même cycle de vie : code court
// attribué à la création, révision à chaque modification, image de référence.

export interface BibleKind {
  schema: ZodObject<any>;
  delegate: any;
  prefix: string;
  revision: Versioned | null;
  action: Action;
  include?: object;
  /** Un seul élément du projet peut porter ce drapeau (style actif, lumière par défaut). */
  exclusive?: 'active' | 'isDefault';
  /** La table a une colonne `order` (tri manuel). */
  ordered?: boolean;
}

const withRef = { ref: { select: { id: true, storageKey: true, width: true, height: true } } };

export const KINDS: Record<string, BibleKind> = {
  characters: { ordered: true, schema: characterSchema, delegate: prisma.character, prefix: CODE_PREFIX.character, revision: 'character', action: 'project.edit', include: { ...withRef, _count: { select: { shots: true, scenes: true, assetLinks: true } } } },
  locations: { ordered: true, schema: locationSchema, delegate: prisma.location, prefix: CODE_PREFIX.location, revision: 'location', action: 'project.edit', include: { ...withRef, _count: { select: { shots: true, scenes: true, assetLinks: true } } } },
  props: { ordered: true, schema: propSchema, delegate: prisma.prop, prefix: CODE_PREFIX.prop, revision: 'prop', action: 'project.edit', include: { ...withRef, _count: { select: { shots: true } } } },
  styles: { schema: styleSchema, delegate: prisma.style, prefix: CODE_PREFIX.style, revision: 'style', action: 'art.edit', include: withRef, exclusive: 'active' },
  lights: { schema: lightSchema, delegate: prisma.lightState, prefix: '', revision: null, action: 'art.edit', exclusive: 'isDefault' },
};

export function kind(name: string): BibleKind {
  const k = KINDS[name];
  if (!k) throw new HttpError(404, `Famille inconnue : ${name}.`, 'not_found');
  return k;
}

export async function assignCode(k: BibleKind, projectId: string, input: { code?: string; name: string }) {
  if (input.code) return input.code.toUpperCase();
  if (!k.prefix)
    return (
      input.name
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '_')
        .replace(/^_|_$/g, '')
        .slice(0, 20) || 'LIGHT'
    );
  const taken = (await k.delegate.findMany({ where: { projectId }, select: { code: true } })).map((r: { code: string }) => r.code);
  return nextCode(k.prefix, taken);
}
