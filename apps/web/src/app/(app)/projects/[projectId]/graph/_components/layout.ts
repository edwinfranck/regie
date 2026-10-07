import type { GraphEdge, GraphNode, GraphNodeType } from './types';

// Disposition en colonnes : Projet | Bible | Scènes | Plans | Assets | Générations.
// Pas de moteur de layout : la bible et les plans sont empilés dans l'ordre du
// film, et les autres colonnes se calent sur la hauteur moyenne de leurs
// voisins déjà placés (barycentre), ce qui suffit à limiter les croisements.

export const NODE_W = 240;
export const NODE_H = 60;
const COL_GAP = 90;
const ROW = NODE_H + 14;
const GROUP_GAP = 36;

export const COLUMN: Record<GraphNodeType, number> = { project: 0, character: 1, location: 1, prop: 1, scene: 2, shot: 3, asset: 4, generation: 5 };
const BIBLE_ORDER: GraphNodeType[] = ['character', 'location', 'prop'];

export function layoutColumns(nodes: GraphNode[], edges: GraphEdge[]) {
  const pos = new Map<string, { x: number; y: number }>();
  const neighbors = new Map<string, string[]>();
  for (const e of edges) {
    (neighbors.get(e.source) ?? neighbors.set(e.source, []).get(e.source)!).push(e.target);
    (neighbors.get(e.target) ?? neighbors.set(e.target, []).get(e.target)!).push(e.source);
  }
  const col = (c: number) => nodes.filter((n) => COLUMN[n.type] === c).sort((a, b) => a.order - b.order);
  const x = (c: number) => c * (NODE_W + COL_GAP);

  // Empilement simple, dans l'ordre donné.
  const stack = (list: GraphNode[], c: number, gapBetweenTypes = false) => {
    let y = 0;
    let prev: GraphNodeType | null = null;
    for (const n of list) {
      if (gapBetweenTypes && prev && prev !== n.type) y += GROUP_GAP;
      pos.set(n.id, { x: x(c), y });
      y += ROW;
      prev = n.type;
    }
    return y;
  };

  // Placement au barycentre des voisins déjà placés, sans chevauchement.
  const settle = (list: GraphNode[], c: number) => {
    const bary = (n: GraphNode) => {
      const ys = (neighbors.get(n.id) ?? []).map((id) => pos.get(id)?.y).filter((v): v is number => v !== undefined);
      return ys.length ? ys.reduce((a, b) => a + b, 0) / ys.length : Number.POSITIVE_INFINITY;
    };
    const scored = list.map((n) => ({ n, b: bary(n) })).sort((a, b) => a.b - b.b || a.n.order - b.n.order);
    let y = Number.NEGATIVE_INFINITY;
    for (const { n, b } of scored) {
      const target = Number.isFinite(b) ? b : y + ROW;
      y = Math.max(target, y + ROW);
      if (!Number.isFinite(y)) y = 0;
      pos.set(n.id, { x: x(c), y });
    }
  };

  const bible = col(1).sort((a, b) => BIBLE_ORDER.indexOf(a.type) - BIBLE_ORDER.indexOf(b.type) || a.order - b.order);
  const hBible = stack(bible, 1, true);
  const hShots = stack(col(3), 3);
  // La colonne la plus courte des deux est centrée sur l'autre.
  const shift = (c: number, dy: number) => { for (const n of nodes) if (COLUMN[n.type] === c) { const p = pos.get(n.id); if (p) p.y += dy; } };
  if (hBible < hShots) shift(1, (hShots - hBible) / 2);
  else shift(3, (hBible - hShots) / 2);

  settle(col(2), 2);
  settle(col(4), 4);
  settle(col(5), 5);

  const all = [...pos.values()].map((p) => p.y);
  const mid = all.length ? (Math.min(...all) + Math.max(...all)) / 2 : 0;
  for (const n of col(0)) pos.set(n.id, { x: x(0), y: mid });
  return pos;
}

/** Tout ce dont le nœud dépend (amont) et tout ce qui dépend de lui (aval). */
export function lineage(id: string, edges: GraphEdge[]) {
  const down = new Map<string, string[]>();
  const up = new Map<string, string[]>();
  for (const e of edges) {
    (down.get(e.source) ?? down.set(e.source, []).get(e.source)!).push(e.target);
    (up.get(e.target) ?? up.set(e.target, []).get(e.target)!).push(e.source);
  }
  const walk = (start: string, next: Map<string, string[]>) => {
    const seen = new Set<string>();
    const queue = [start];
    while (queue.length) {
      const cur = queue.shift()!;
      for (const n of next.get(cur) ?? []) if (!seen.has(n) && n !== id) (seen.add(n), queue.push(n));
    }
    return seen;
  };
  return { upstream: walk(id, up), downstream: walk(id, down) };
}
