import { toPlain } from '@regie/core';
import { prisma } from '@regie/db';
import { api, project } from '@/lib/api';
import type { GraphEdge, GraphNode } from '@/app/(app)/projects/[projectId]/graph/_components/types';

// Le projet vu comme un graphe de dépendances. Une arête A → B signifie
// « B dépend de A » : modifier A peut affecter B. Le client dispose les
// nœuds en colonnes ; ici on se contente de dire qui touche qui.
type P = { projectId: string };

// Au-delà, le graphe n'est plus lisible : on garde les plus récents.
const ASSETS_PER_ENTITY = 3;
const MAX_GENERATIONS = 40;
const OUTPUTS_PER_GENERATION = 4;
const MAX_ASSETS = 180;

const clip = (s: string | null | undefined, n = 140) => {
  const t = (s ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};

export const GET = api<P>(async ({ params, user }) => {
  await project(params.projectId, user, 'project.read');
  const projectId = params.projectId;
  const base = `/projects/${projectId}`;

  const [p, characters, locations, props, scenes, shots, links, generations, totalAssets, totalGenerations] = await Promise.all([
    prisma.project.findUniqueOrThrow({ where: { id: projectId }, select: { id: true, title: true, kind: true, stage: true } }),
    prisma.character.findMany({ where: { projectId }, orderBy: [{ order: 'asc' }, { code: 'asc' }], select: { id: true, code: true, name: true, role: true, short: true, refAssetId: true } }),
    prisma.location.findMany({ where: { projectId }, orderBy: [{ order: 'asc' }, { code: 'asc' }], select: { id: true, code: true, name: true, short: true, refAssetId: true } }),
    prisma.prop.findMany({ where: { projectId }, orderBy: [{ order: 'asc' }, { code: 'asc' }], select: { id: true, code: true, name: true, short: true, refAssetId: true } }),
    prisma.scene.findMany({ where: { projectId }, orderBy: { order: 'asc' }, select: { id: true, number: true, title: true, setting: true, timeOfDay: true, description: true, locationId: true, status: true } }),
    prisma.shot.findMany({
      where: { projectId },
      orderBy: [{ scene: { order: 'asc' } }, { order: 'asc' }],
      select: { id: true, code: true, sceneId: true, description: true, action: true, durationSec: true, locationId: true, frameAssetId: true, status: true, characters: { select: { characterId: true } }, props: { select: { propId: true } } },
    }),
    prisma.assetLink.findMany({
      where: { asset: { projectId } },
      orderBy: { asset: { createdAt: 'desc' } },
      take: 2000,
      select: { assetId: true, characterId: true, locationId: true, propId: true, sceneId: true, shotId: true },
    }),
    prisma.generation.findMany({
      where: { projectId, capability: { not: 'TEXT' } },
      orderBy: { createdAt: 'desc' },
      take: MAX_GENERATIONS,
      select: { id: true, capability: true, mode: true, status: true, target: true, shotId: true, prompt: true, inputAssetIds: true, createdAt: true, costUsd: true, model: { select: { label: true } }, outputs: { select: { id: true }, orderBy: { createdAt: 'desc' }, take: OUTPUTS_PER_GENERATION } },
    }),
    prisma.asset.count({ where: { projectId } }),
    prisma.generation.count({ where: { projectId, capability: { not: 'TEXT' } } }),
  ]);

  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const edgeKeys = new Set<string>();
  const edge = (source: string, target: string, kind: GraphEdge['kind']) => {
    const id = `${source}>${target}`;
    if (source === target || edgeKeys.has(id)) return;
    edgeKeys.add(id);
    edges.push({ id, source, target, kind });
  };

  const P_ID = `project:${p.id}`;
  nodes.push({ id: P_ID, type: 'project', entityId: p.id, label: p.title, href: base, order: 0, meta: { kind: p.kind, stage: p.stage } });

  characters.forEach((c, i) => {
    nodes.push({ id: `character:${c.id}`, type: 'character', entityId: c.id, code: c.code, label: c.name, sub: clip(c.role || c.short), href: `${base}/characters/${c.id}`, order: i });
    edge(P_ID, `character:${c.id}`, 'contains');
  });
  locations.forEach((l, i) => {
    nodes.push({ id: `location:${l.id}`, type: 'location', entityId: l.id, code: l.code, label: l.name, sub: clip(l.short), href: `${base}/locations/${l.id}`, order: i });
    edge(P_ID, `location:${l.id}`, 'contains');
  });
  props.forEach((o, i) => {
    nodes.push({ id: `prop:${o.id}`, type: 'prop', entityId: o.id, code: o.code, label: o.name, sub: clip(o.short), href: `${base}/props`, order: i });
    edge(P_ID, `prop:${o.id}`, 'contains');
  });
  scenes.forEach((s, i) => {
    nodes.push({ id: `scene:${s.id}`, type: 'scene', entityId: s.id, code: `S${s.number}`, label: s.title || `Scène ${s.number}`, sub: clip(toPlain(s.description)), href: `${base}/scenes/${s.id}`, order: i, meta: { setting: s.setting, timeOfDay: s.timeOfDay, status: s.status } });
    edge(P_ID, `scene:${s.id}`, 'contains');
    if (s.locationId) edge(`location:${s.locationId}`, `scene:${s.id}`, 'uses');
  });
  shots.forEach((s, i) => {
    const id = `shot:${s.id}`;
    nodes.push({ id, type: 'shot', entityId: s.id, code: s.code, label: clip(s.description || s.action, 60) || `Plan ${s.code}`, sub: clip(s.action || s.description), href: `${base}/scenes/${s.sceneId}?shot=${s.id}`, order: i, meta: { durationSec: s.durationSec, status: s.status } });
    edge(`scene:${s.sceneId}`, id, 'contains');
    for (const c of s.characters) edge(`character:${c.characterId}`, id, 'uses');
    for (const o of s.props) edge(`prop:${o.propId}`, id, 'uses');
    if (s.locationId) edge(`location:${s.locationId}`, id, 'uses');
  });

  // Choix des assets affichés : références et images de storyboard d'abord,
  // puis les plus récents liés à chaque entité, puis les sorties des générations.
  const assetIds = new Set<string>();
  const pending: [string, string, GraphEdge['kind']][] = [];
  const want = (assetId: string | null | undefined, from: string, kind: GraphEdge['kind']) => {
    if (!assetId) return;
    if (!assetIds.has(assetId)) {
      if (assetIds.size >= MAX_ASSETS) return;
      assetIds.add(assetId);
    }
    pending.push([from, `asset:${assetId}`, kind]);
  };
  for (const c of characters) want(c.refAssetId, `character:${c.id}`, 'ref');
  for (const l of locations) want(l.refAssetId, `location:${l.id}`, 'ref');
  for (const o of props) want(o.refAssetId, `prop:${o.id}`, 'ref');
  for (const s of shots) want(s.frameAssetId, `shot:${s.id}`, 'frame');

  const perEntity = new Map<string, number>();
  for (const l of links) {
    const owners = [l.characterId && `character:${l.characterId}`, l.locationId && `location:${l.locationId}`, l.propId && `prop:${l.propId}`, l.sceneId && `scene:${l.sceneId}`, l.shotId && `shot:${l.shotId}`].filter(Boolean) as string[];
    for (const owner of owners) {
      const n = perEntity.get(owner) ?? 0;
      if (n >= ASSETS_PER_ENTITY) continue;
      perEntity.set(owner, n + 1);
      want(l.assetId, owner, 'link');
    }
  }

  const genIds = new Set(generations.map((g) => g.id));
  for (const g of generations) for (const o of g.outputs) want(o.id, `generation:${g.id}`, 'output');

  const assets = await prisma.asset.findMany({
    where: { id: { in: [...assetIds] }, projectId },
    select: { id: true, name: true, type: true, mimeType: true, source: true, isReference: true, referenceKind: true, width: true, height: true, durationSec: true, createdAt: true, generationId: true },
    orderBy: { createdAt: 'desc' },
  });
  const present = new Set(assets.map((a) => a.id));
  assets.forEach((a, i) => {
    nodes.push({
      id: `asset:${a.id}`,
      type: 'asset',
      entityId: a.id,
      label: a.name,
      sub: [a.isReference ? `Référence${a.referenceKind ? ` ${a.referenceKind}` : ''}` : null, a.width && a.height ? `${a.width}×${a.height}` : null, a.durationSec ? `${Math.round(a.durationSec * 10) / 10} s` : null].filter(Boolean).join(' · '),
      href: `${base}/assets?asset=${a.id}`,
      order: i,
      asset: { id: a.id, type: a.type, mimeType: a.mimeType },
      meta: { source: a.source, createdAt: a.createdAt.toISOString() },
    });
    // Un asset produit par une génération hors de la fenêtre affichée garde son lien si elle y est.
    if (a.generationId && genIds.has(a.generationId)) edge(`generation:${a.generationId}`, `asset:${a.id}`, 'output');
  });

  const nodeIds = new Set(nodes.map((n) => n.id));
  for (const g of generations) nodeIds.add(`generation:${g.id}`);
  for (const [from, to, kind] of pending) if (present.has(to.slice(6)) && nodeIds.has(from)) edge(from, to, kind);

  const sceneOfShot = new Map(shots.map((s) => [s.id, s.sceneId]));
  generations.forEach((g, i) => {
    const id = `generation:${g.id}`;
    nodes.push({
      id,
      type: 'generation',
      entityId: g.id,
      code: g.target ?? undefined,
      label: g.model?.label ?? g.mode,
      sub: clip(g.prompt),
      href: g.shotId && sceneOfShot.has(g.shotId) ? `${base}/scenes/${sceneOfShot.get(g.shotId)}?shot=${g.shotId}` : undefined,
      order: i,
      meta: { status: g.status, mode: g.mode, capability: g.capability, costUsd: g.costUsd, createdAt: g.createdAt.toISOString() },
    });
    if (g.shotId && nodeIds.has(`shot:${g.shotId}`)) edge(`shot:${g.shotId}`, id, 'generation');
    for (const a of g.inputAssetIds) if (present.has(a)) edge(`asset:${a}`, id, 'input');
  });

  return {
    nodes,
    edges,
    limits: { assetsShown: assets.length, assetsTotal: totalAssets, generationsShown: generations.length, generationsTotal: totalGenerations, assetsPerEntity: ASSETS_PER_ENTITY },
  };
});
