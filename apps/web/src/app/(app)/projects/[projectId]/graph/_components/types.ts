// Forme des données renvoyées par GET /api/projects/:id/graph.

export type GraphNodeType = 'project' | 'character' | 'location' | 'prop' | 'scene' | 'shot' | 'asset' | 'generation';

export interface GraphNode {
  id: string;
  type: GraphNodeType;
  entityId: string;
  code?: string;
  label: string;
  sub?: string;
  href?: string;
  order: number;
  asset?: { id: string; type: string; mimeType: string };
  meta?: Record<string, string | number | null>;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  kind: 'contains' | 'uses' | 'link' | 'ref' | 'frame' | 'output' | 'input' | 'generation';
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  limits: { assetsShown: number; assetsTotal: number; generationsShown: number; generationsTotal: number; assetsPerEntity: number };
}
