'use client';

import '@xyflow/react/dist/style.css';
import { GENERATION_MODES, KIND_LABELS, STAGE_LABELS, TIME_LABELS } from '@regie/core';
import { Background, Controls, type Edge, Handle, MiniMap, type Node, type NodeProps, Position, ReactFlow, ReactFlowProvider, useReactFlow } from '@xyflow/react';
import { Camera, Clapperboard, ExternalLink, Film, ImageIcon, MapPin, Network, Package, PanelRightClose, PanelRightOpen, Search, Sparkles, User, X } from 'lucide-react';
import Link from 'next/link';
import { memo, useCallback, useMemo, useState } from 'react';
import { EmptyState, PageHeader } from '@/components/common/page-header';
import { AssetThumb, TypeIcon } from '@/components/common/media';
import { StatusPill } from '@/components/common/status';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useProjectData } from '@/hooks/use-project';
import { cn } from '@/lib/utils';
import { COLUMN, NODE_H, NODE_W, layoutColumns, lineage } from './layout';
import type { GraphData, GraphEdge, GraphNode, GraphNodeType } from './types';

const TYPES: { type: GraphNodeType; label: string; plural: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { type: 'project', label: 'Projet', plural: 'Projet', icon: Film },
  { type: 'character', label: 'Personnage', plural: 'Personnages', icon: User },
  { type: 'location', label: 'Lieu', plural: 'Lieux', icon: MapPin },
  { type: 'prop', label: 'Objet', plural: 'Objets', icon: Package },
  { type: 'scene', label: 'Scène', plural: 'Scènes', icon: Clapperboard },
  { type: 'shot', label: 'Plan', plural: 'Plans', icon: Camera },
  { type: 'asset', label: 'Asset', plural: 'Assets', icon: ImageIcon },
  { type: 'generation', label: 'Génération', plural: 'Générations', icon: Sparkles },
];
const TYPE = Object.fromEntries(TYPES.map((t) => [t.type, t])) as Record<GraphNodeType, (typeof TYPES)[number]>;
const COLUMN_TITLES = ['Projet', 'Bible', 'Scènes', 'Plans', 'Assets', 'Générations'];

// Les variables de React Flow reprennent les tokens du thème : elles suivent
// donc le clair et le sombre sans rien dupliquer.
const FLOW_THEME = {
  '--xy-background-color': 'var(--background)',
  '--xy-background-pattern-color': 'var(--border)',
  '--xy-edge-stroke': 'var(--input)',
  '--xy-edge-stroke-selected': 'var(--foreground)',
  '--xy-node-background-color': 'transparent',
  '--xy-node-border': 'none',
  '--xy-node-color': 'var(--foreground)',
  '--xy-node-boxshadow-hover': 'none',
  '--xy-node-boxshadow-selected': 'none',
  '--xy-handle-background-color': 'transparent',
  '--xy-handle-border-color': 'transparent',
  '--xy-minimap-background-color': 'var(--card)',
  '--xy-minimap-mask-background-color': 'color-mix(in oklch, var(--muted) 70%, transparent)',
  '--xy-minimap-mask-stroke-color': 'var(--border)',
  '--xy-minimap-node-background-color': 'var(--muted-foreground)',
  '--xy-minimap-node-stroke-color': 'transparent',
  '--xy-controls-button-background-color': 'var(--card)',
  '--xy-controls-button-background-color-hover': 'var(--accent)',
  '--xy-controls-button-color': 'var(--foreground)',
  '--xy-controls-button-color-hover': 'var(--foreground)',
  '--xy-controls-button-border-color': 'var(--border)',
  '--xy-controls-box-shadow': 'none',
  '--xy-attribution-background-color': 'transparent',
} as React.CSSProperties;

type Tone = 'normal' | 'selected' | 'related' | 'dim' | 'match';
type EntityData = { node: GraphNode; tone: Tone };

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const EntityNode = memo(function EntityNode({ data }: NodeProps<Node<EntityData>>) {
  const { node, tone } = data;
  const Icon = TYPE[node.type].icon;
  return (
    <div
      className={cn(
        'flex items-center gap-2.5 overflow-hidden rounded-md border bg-card px-2.5 text-left transition-opacity',
        node.type === 'project' && 'border-foreground',
        tone === 'selected' && 'border-signal ring-2 ring-signal/40',
        tone === 'match' && 'border-foreground ring-2 ring-foreground/20',
        tone === 'dim' && 'opacity-25',
      )}
      style={{ width: NODE_W, height: NODE_H }}
      title={node.label}
    >
      <Handle type="target" position={Position.Left} isConnectable={false} />
      {node.asset ? (
        <AssetThumb asset={node.asset.type === 'AUDIO' ? null : { id: node.asset.id, type: node.asset.type, mimeType: node.asset.mimeType }} className="size-10 shrink-0 rounded-sm" />
      ) : (
        <Icon className="size-4 shrink-0 text-muted-foreground" />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {node.code && <span className="shrink-0 font-mono text-xs text-muted-foreground">{node.code}</span>}
          <span className="truncate text-sm font-medium">{node.label}</span>
        </div>
        <div className="truncate text-xs text-muted-foreground">{node.type === 'asset' && node.asset ? <span className="inline-flex items-center gap-1"><TypeIcon type={node.asset.type} className="size-3" />{node.sub || TYPE.asset.label}</span> : node.sub || TYPE[node.type].label}</div>
      </div>
      <Handle type="source" position={Position.Right} isConnectable={false} />
    </div>
  );
});

const nodeTypes = { entity: EntityNode };

export function ProjectGraph() {
  return (
    <ReactFlowProvider>
      <GraphView />
    </ReactFlowProvider>
  );
}

function GraphView() {
  const { data, isLoading } = useProjectData<GraphData>('graph');
  const flow = useReactFlow();
  const [hidden, setHidden] = useState<Set<GraphNodeType>>(new Set());
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);

  const counts = useMemo(() => {
    const c: Partial<Record<GraphNodeType, number>> = {};
    for (const n of data?.nodes ?? []) c[n.type] = (c[n.type] ?? 0) + 1;
    return c;
  }, [data]);

  const visible = useMemo(() => {
    const nodes = (data?.nodes ?? []).filter((n) => !hidden.has(n.type));
    const ids = new Set(nodes.map((n) => n.id));
    const edges = (data?.edges ?? []).filter((e) => ids.has(e.source) && ids.has(e.target));
    return { nodes, edges, ids };
  }, [data, hidden]);

  const positions = useMemo(() => layoutColumns(visible.nodes, visible.edges), [visible]);
  const byId = useMemo(() => new Map((data?.nodes ?? []).map((n) => [n.id, n])), [data]);

  const activeSelection = selected && visible.ids.has(selected) ? selected : null;
  const lin = useMemo(() => (activeSelection ? lineage(activeSelection, visible.edges) : null), [activeSelection, visible.edges]);

  const matches = useMemo(() => {
    const q = fold(query.trim());
    if (!q) return null;
    return new Set(visible.nodes.filter((n) => fold(`${n.code ?? ''} ${n.label}`).includes(q)).map((n) => n.id));
  }, [query, visible.nodes]);

  const nodes: Node<EntityData>[] = useMemo(
    () =>
      visible.nodes.map((n) => {
        let tone: Tone = 'normal';
        if (lin) tone = n.id === activeSelection ? 'selected' : lin.upstream.has(n.id) || lin.downstream.has(n.id) ? 'related' : 'dim';
        else if (matches) tone = matches.has(n.id) ? 'match' : 'dim';
        return { id: n.id, type: 'entity', position: positions.get(n.id) ?? { x: COLUMN[n.type] * 360, y: 0 }, data: { node: n, tone }, width: NODE_W, height: NODE_H, draggable: false, connectable: false, selectable: true };
      }),
    [visible.nodes, positions, lin, matches, activeSelection],
  );

  const edges: Edge[] = useMemo(() => {
    const inLineage = (id: string) => id === activeSelection || !!lin?.upstream.has(id) || !!lin?.downstream.has(id);
    return visible.edges.map((e) => {
      // Une arête est sur le chemin si ses deux bouts sont du même côté de la sélection.
      const on = lin ? inLineage(e.source) && inLineage(e.target) && !(lin.upstream.has(e.source) && lin.downstream.has(e.target)) && !(lin.downstream.has(e.source) && lin.upstream.has(e.target)) : false;
      const dashed = e.kind === 'ref' || e.kind === 'input';
      return {
        id: e.id,
        source: e.source,
        target: e.target,
        focusable: false,
        style: {
          stroke: on ? 'var(--foreground)' : undefined,
          strokeWidth: on ? 1.5 : 1,
          strokeDasharray: dashed ? '4 3' : undefined,
          opacity: lin && !on ? 0.12 : matches && !(matches.has(e.source) || matches.has(e.target)) ? 0.2 : 1,
        },
        zIndex: on ? 1 : 0,
      };
    });
  }, [visible.edges, lin, matches, activeSelection]);

  const focusNode = useCallback(
    (id: string) => {
      setSelected(id);
      setPanelOpen(true);
      const p = positions.get(id);
      if (p) void flow.setCenter(p.x + NODE_W / 2, p.y + NODE_H / 2, { zoom: Math.max(flow.getZoom(), 0.9), duration: 300 });
    },
    [positions, flow],
  );

  const toggleType = (t: GraphNodeType, on: boolean) =>
    setHidden((h) => {
      const next = new Set(h);
      if (on) next.delete(t);
      else next.add(t);
      return next;
    });

  const empty = !isLoading && (data?.nodes.length ?? 0) <= 1;
  const sel = activeSelection ? byId.get(activeSelection) : undefined;

  return (
    <div className="flex h-[calc(100vh-3rem)] flex-col">
      <PageHeader
        title="Graphe du projet"
        description="Qui dépend de qui : bible, scènes, plans, assets et générations. Cliquez un élément pour voir tout ce qu’il touche, en amont et en aval."
        className="pt-6 pb-4"
      />
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b px-8 py-2.5">
        <div className="relative w-64">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && matches?.size) focusNode([...matches][0]);
              if (e.key === 'Escape') setQuery('');
            }}
            placeholder="Chercher un code, un nom…"
            className="h-8 pl-8"
          />
        </div>
        {matches && <span className="text-sm text-muted-foreground">{matches.size} résultat{matches.size > 1 ? 's' : ''}{matches.size ? ' — Entrée pour y aller' : ''}</span>}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {TYPES.filter((t) => t.type !== 'project').map((t) => (
            <label key={t.type} className="flex cursor-pointer items-center gap-1.5 text-sm">
              <Checkbox checked={!hidden.has(t.type)} onCheckedChange={(v) => toggleType(t.type, v === true)} />
              {t.plural}
              <span className="text-muted-foreground">{counts[t.type] ?? 0}</span>
            </label>
          ))}
        </div>
        <div className="ml-auto">
          <Button size="icon-sm" variant="ghost" onClick={() => setPanelOpen((o) => !o)} aria-label={panelOpen ? 'Masquer le panneau' : 'Afficher le panneau'} title={panelOpen ? 'Masquer le panneau' : 'Afficher le panneau'}>
            {panelOpen ? <PanelRightClose /> : <PanelRightOpen />}
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="relative min-w-0 flex-1">
          {isLoading ? (
            <div className="space-y-3 p-8">
              <Skeleton className="h-14 w-60" />
              <Skeleton className="h-14 w-60" />
              <Skeleton className="h-14 w-60" />
            </div>
          ) : empty ? (
            <div className="p-8">
              <EmptyState icon={Network} title="Le graphe est vide" description="Il se remplit à mesure que vous créez des personnages, des lieux, des scènes et des plans, et que vous générez des images." />
            </div>
          ) : (
            <>
              <ColumnTitles visible={visible.nodes} />
              <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                style={FLOW_THEME}
                fitView
                fitViewOptions={{ padding: 0.15, maxZoom: 1 }}
                minZoom={0.1}
                maxZoom={2}
                nodesDraggable={false}
                nodesConnectable={false}
                edgesFocusable={false}
                onlyRenderVisibleElements
                proOptions={{ hideAttribution: true }}
                onNodeClick={(_, n) => {
                  setSelected(n.id === activeSelection ? null : n.id);
                  setPanelOpen(true);
                }}
                onPaneClick={() => setSelected(null)}
              >
                <Background gap={24} size={1} />
                <Controls showInteractive={false} position="bottom-left" className="overflow-hidden rounded-md border" />
                <MiniMap pannable zoomable position="bottom-right" className="overflow-hidden rounded-md border" nodeBorderRadius={2} nodeColor={(n) => ((n.data as EntityData).tone === 'dim' ? 'var(--border)' : (n.data as EntityData).tone === 'selected' ? 'var(--signal)' : 'var(--muted-foreground)')} />
              </ReactFlow>
            </>
          )}
        </div>

        {panelOpen && (
          <aside className="flex w-80 shrink-0 flex-col border-l bg-background">
            {sel && lin ? (
              <Detail node={sel} upstream={lin.upstream} downstream={lin.downstream} byId={byId} edges={visible.edges} onFocus={focusNode} onClose={() => setSelected(null)} />
            ) : (
              <Legend data={data} />
            )}
          </aside>
        )}
      </div>
    </div>
  );
}

// Rappel de l'ordre des colonnes présentes, de gauche à droite.
function ColumnTitles({ visible }: { visible: GraphNode[] }) {
  const present = new Set(visible.map((n) => COLUMN[n.type]));
  return (
    <div className="pointer-events-none absolute top-3 left-3 z-10 flex flex-wrap gap-1.5 text-xs text-muted-foreground">
      {COLUMN_TITLES.map((t, i) => (present.has(i) ? <span key={t} className="rounded-sm border bg-background px-1.5 py-0.5">{i + 1}. {t}</span> : null))}
    </div>
  );
}

function Legend({ data }: { data?: GraphData }) {
  const l = data?.limits;
  return (
    <div className="space-y-5 p-5 text-sm">
      <div className="space-y-1">
        <h2 className="font-medium">Lire le graphe</h2>
        <p className="text-muted-foreground">Une flèche va de ce qui est utilisé vers ce qui l’utilise : un personnage vers les plans où il apparaît, un plan vers ses générations, une génération vers les images produites.</p>
      </div>
      <div className="space-y-2">
        {TYPES.map((t) => (
          <div key={t.type} className="flex items-center gap-2">
            <t.icon className="size-4 text-muted-foreground" />
            {t.label}
          </div>
        ))}
        <div className="flex items-center gap-2 pt-1 text-muted-foreground">
          <svg width="28" height="6" aria-hidden className="shrink-0"><line x1="0" y1="3" x2="28" y2="3" stroke="currentColor" strokeDasharray="4 3" /></svg>
          Image de référence, ou asset passé en entrée
        </div>
      </div>
      {l && (
        <p className="text-muted-foreground">
          Pour rester lisible, le graphe montre au plus {l.assetsPerEntity} assets récents par élément, les références et les images de storyboard : {l.assetsShown} assets sur {l.assetsTotal}, {l.generationsShown} générations sur {l.generationsTotal}.
        </p>
      )}
      <p className="text-muted-foreground">Cliquez un élément pour surligner ses dépendances ; cliquez le fond pour tout revoir.</p>
    </div>
  );
}

function Detail({ node, upstream, downstream, byId, edges, onFocus, onClose }: { node: GraphNode; upstream: Set<string>; downstream: Set<string>; byId: Map<string, GraphNode>; edges: GraphEdge[]; onFocus: (id: string) => void; onClose: () => void }) {
  const t = TYPE[node.type];
  const direct = useMemo(() => ({ up: new Set(edges.filter((e) => e.target === node.id).map((e) => e.source)), down: new Set(edges.filter((e) => e.source === node.id).map((e) => e.target)) }), [edges, node.id]);
  const m = node.meta ?? {};
  const facts: [string, React.ReactNode][] = [];
  if (node.type === 'project') {
    if (m.kind) facts.push(['Type', KIND_LABELS[m.kind as keyof typeof KIND_LABELS] ?? m.kind]);
    if (m.stage) facts.push(['Étape', STAGE_LABELS[m.stage as keyof typeof STAGE_LABELS] ?? m.stage]);
  }
  if (node.type === 'scene') {
    facts.push(['En-tête', `${String(m.setting ?? '').replace('_', '/')} · ${TIME_LABELS[String(m.timeOfDay)] ?? m.timeOfDay}`]);
    if (m.status) facts.push(['Statut', STAGE_LABELS[m.status as keyof typeof STAGE_LABELS] ?? m.status]);
  }
  if (node.type === 'shot') {
    facts.push(['Durée', `${m.durationSec} s`]);
    if (m.status) facts.push(['Statut', STAGE_LABELS[m.status as keyof typeof STAGE_LABELS] ?? m.status]);
  }
  if (node.type === 'generation') {
    facts.push(['Statut', <StatusPill key="s" status={String(m.status)} />]);
    facts.push(['Mode', GENERATION_MODES[m.mode as keyof typeof GENERATION_MODES] ?? m.mode]);
    if (typeof m.costUsd === 'number') facts.push(['Coût', `${m.costUsd.toFixed(3)} $`]);
  }
  if ((node.type === 'generation' || node.type === 'asset') && m.createdAt) facts.push(['Créé le', new Date(String(m.createdAt)).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })]);
  if (node.type === 'asset' && m.source) facts.push(['Origine', ({ UPLOAD: 'Importé', GENERATED: 'Généré', IMPORTED: 'Import v0.1' } as Record<string, string>)[String(m.source)] ?? m.source]);

  return (
    <>
      <div className="flex items-start justify-between gap-2 border-b px-5 py-4">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <t.icon className="size-4" /> {t.label}
            {node.code && <span className="font-mono text-xs">{node.code}</span>}
          </div>
          <h2 className="mt-0.5 font-medium break-words">{node.label}</h2>
        </div>
        <Button size="icon-sm" variant="ghost" onClick={onClose} aria-label="Désélectionner" title="Désélectionner">
          <X />
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="space-y-5 p-5 text-sm">
          {node.asset && <AssetThumb asset={{ id: node.asset.id, type: node.asset.type, mimeType: node.asset.mimeType, name: node.label }} fit="contain" className="aspect-video w-full rounded-sm" controls />}
          {node.sub && <p className="text-muted-foreground">{node.sub}</p>}
          {facts.length > 0 && (
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
              {facts.map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          )}
          {node.href && (
            <Button asChild variant="outline" size="sm" className="w-full">
              <Link href={node.href}>
                <ExternalLink /> Ouvrir {node.type === 'asset' ? 'dans les assets' : node.type === 'generation' ? 'le plan' : node.type === 'project' ? 'le projet' : 'la fiche'}
              </Link>
            </Button>
          )}
          <Related title="Dépend de" hint="en amont" ids={upstream} direct={direct.up} byId={byId} onFocus={onFocus} />
          <Related title="Affecte" hint="en aval" ids={downstream} direct={direct.down} byId={byId} onFocus={onFocus} />
        </div>
      </div>
    </>
  );
}

function Related({ title, hint, ids, direct, byId, onFocus }: { title: string; hint: string; ids: Set<string>; direct: Set<string>; byId: Map<string, GraphNode>; onFocus: (id: string) => void }) {
  const groups = useMemo(() => {
    const list = [...ids].map((id) => byId.get(id)).filter((n): n is GraphNode => !!n);
    return TYPES.map((t) => ({ t, items: list.filter((n) => n.type === t.type).sort((a, b) => Number(direct.has(b.id)) - Number(direct.has(a.id)) || a.order - b.order) })).filter((g) => g.items.length);
  }, [ids, byId, direct]);
  return (
    <section className="space-y-2">
      <h3 className="font-medium">
        {title} <span className="font-normal text-muted-foreground">{ids.size ? `${ids.size} ${hint}` : `rien ${hint}`}</span>
      </h3>
      {groups.map(({ t, items }) => (
        <div key={t.type} className="space-y-0.5">
          <div className="text-xs text-muted-foreground">{items.length > 1 ? t.plural : t.label} · {items.length}</div>
          {items.slice(0, 30).map((n) => (
            <button key={n.id} type="button" onClick={() => onFocus(n.id)} className="flex w-full items-center gap-2 rounded-sm px-1.5 py-1 text-left hover:bg-accent">
              {n.code && <span className="shrink-0 font-mono text-xs text-muted-foreground">{n.code}</span>}
              <span className={cn('truncate', !direct.has(n.id) && 'text-muted-foreground')}>{n.label}</span>
            </button>
          ))}
          {items.length > 30 && <div className="px-1.5 text-xs text-muted-foreground">et {items.length - 30} autres</div>}
        </div>
      ))}
    </section>
  );
}
