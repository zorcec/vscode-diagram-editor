import type { DiagramDocument } from '../types/DiagramDocument';

export interface LayoutResult {
  nodeId: string;
  x: number;
  y: number;
}

export interface LayoutConfig {
  rankdir: 'LR' | 'TB' | 'RL' | 'BT';
  ranksep: number;
  nodesep: number;
  marginx: number;
  marginy: number;
}

const DEFAULT_LAYOUT_CONFIG: LayoutConfig = {
  rankdir: 'LR',
  ranksep: 120,
  nodesep: 60,
  marginx: 40,
  marginy: 40,
};

/**
 * Computes positions for unpinned nodes at origin (x=0, y=0).
 * Pinned nodes and nodes with existing positions are untouched.
 *
 * Uses a simple topological/layered layout when dagre is not available,
 * or dagre when it is.
 */
export function computePartialLayout(
  doc: DiagramDocument,
  config: LayoutConfig = DEFAULT_LAYOUT_CONFIG,
): LayoutResult[] {
  const unpinnedAtOrigin = doc.nodes.filter(
    (n) => !n.pinned && n.x === 0 && n.y === 0,
  );

  if (unpinnedAtOrigin.length === 0) return [];

  return computeSimpleLayout(doc, unpinnedAtOrigin, config);
}

/**
 * Computes layout for ALL nodes (ignoring pinned status).
 * Used by the "Auto Layout All" command.
 */
export function computeFullLayout(
  doc: DiagramDocument,
  config: LayoutConfig = DEFAULT_LAYOUT_CONFIG,
): LayoutResult[] {
  if (doc.nodes.length === 0) return [];
  return computeSimpleLayout(doc, doc.nodes, config);
}

/**
 * Simple layered layout algorithm.
 * Assigns nodes to layers based on topological sort of the edge graph,
 * then spaces them according to config.
 */
function computeSimpleLayout(
  doc: DiagramDocument,
  targetNodes: typeof doc.nodes,
  config: LayoutConfig,
): LayoutResult[] {
  const targetIds = new Set(targetNodes.map((n) => n.id));
  const nodeMap = new Map(doc.nodes.map((n) => [n.id, n]));

  const adjacency = buildAdjacency(doc, targetIds);
  const layers = assignLayers(targetIds, adjacency);
  const isHorizontal = config.rankdir === 'LR' || config.rankdir === 'RL';

  const results: LayoutResult[] = [];

  for (let layerIndex = 0; layerIndex < layers.length; layerIndex++) {
    const layer = layers[layerIndex];

    for (let nodeIndex = 0; nodeIndex < layer.length; nodeIndex++) {
      const nodeId = layer[nodeIndex];
      const node = nodeMap.get(nodeId);
      if (!node) continue;

      let x: number;
      let y: number;

      if (isHorizontal) {
        x = config.marginx + layerIndex * (node.width + config.ranksep);
        y = config.marginy + nodeIndex * (node.height + config.nodesep);
      } else {
        x = config.marginx + nodeIndex * (node.width + config.nodesep);
        y = config.marginy + layerIndex * (node.height + config.ranksep);
      }

      if (config.rankdir === 'RL') {
        x =
          config.marginx +
          (layers.length - 1 - layerIndex) * (node.width + config.ranksep);
      }
      if (config.rankdir === 'BT') {
        y =
          config.marginy +
          (layers.length - 1 - layerIndex) * (node.height + config.ranksep);
      }

      results.push({ nodeId, x: Math.round(x), y: Math.round(y) });
    }
  }

  return results;
}

function buildAdjacency(
  doc: DiagramDocument,
  targetIds: Set<string>,
): Map<string, string[]> {
  const adj = new Map<string, string[]>();

  for (const id of targetIds) {
    adj.set(id, []);
  }

  for (const edge of doc.edges) {
    if (targetIds.has(edge.source) && targetIds.has(edge.target)) {
      const list = adj.get(edge.source);
      if (list) list.push(edge.target);
    }
  }

  return adj;
}

/**
 * Assigns nodes to layers via a simplified topological sort.
 * Nodes with no incoming edges go in layer 0, their dependents in layer 1, etc.
 */
function assignLayers(
  targetIds: Set<string>,
  adjacency: Map<string, string[]>,
): string[][] {
  const inDegree = new Map<string, number>();
  for (const id of targetIds) {
    inDegree.set(id, 0);
  }

  for (const [, neighbors] of adjacency) {
    for (const neighbor of neighbors) {
      inDegree.set(neighbor, (inDegree.get(neighbor) ?? 0) + 1);
    }
  }

  const layers: string[][] = [];
  const remaining = new Set(targetIds);

  while (remaining.size > 0) {
    const layer: string[] = [];

    for (const id of remaining) {
      if ((inDegree.get(id) ?? 0) === 0) {
        layer.push(id);
      }
    }

    if (layer.length === 0) {
      // Cycle detected — put all remaining in one layer
      layers.push([...remaining]);
      break;
    }

    layer.sort();
    layers.push(layer);

    for (const id of layer) {
      remaining.delete(id);
      const neighbors = adjacency.get(id) ?? [];
      for (const neighbor of neighbors) {
        inDegree.set(neighbor, (inDegree.get(neighbor) ?? 0) - 1);
      }
    }
  }

  return layers;
}
