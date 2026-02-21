export type NodeShape = 'rectangle' | 'rounded' | 'diamond' | 'cylinder';

export type EdgeStyle = 'solid' | 'dashed' | 'dotted';

export type ArrowType = 'normal' | 'arrow' | 'open' | 'none';

export type NodeColor =
  | 'default'
  | 'blue'
  | 'green'
  | 'red'
  | 'yellow'
  | 'purple'
  | 'gray';

export interface DiagramNode {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  shape: NodeShape;
  color: NodeColor;
  pinned: boolean;
  notes?: string;
  group?: string;
}

export interface DiagramEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  style: EdgeStyle;
  arrow: ArrowType;
  animated?: boolean;
}

export interface DiagramGroup {
  id: string;
  label: string;
  color?: NodeColor;
}

export interface DiagramMeta {
  version?: string;
  title: string;
  description?: string;
  created: string;
  modified: string;
}

/**
 * Auto-generated section consumed by AI coding agents (GitHub Copilot, Claude, etc.)
 * when the VS Code extension is NOT installed. Agents can read this from the raw
 * `.diagram` JSON file to understand the architecture depicted in the diagram.
 *
 * This section is regenerated automatically every time the diagram changes.
 * Do NOT edit it manually — your changes will be overwritten.
 */
export interface AgentContext {
  /** How to read this diagram (always "diagramflow-v1") */
  format: 'diagramflow-v1';
  /** ISO-8601 timestamp of when this section was last generated */
  generatedAt: string;
  /** Plain-English summary derived from nodes, edges and meta */
  summary: string;
  /** Compact node list: id → label + notes */
  nodeIndex: Array<{ id: string; label: string; notes?: string; group?: string }>;
  /** Compact edge list: source label → target label with optional description */
  edgeIndex: Array<{
    from: string;
    to: string;
    label?: string;
    style?: EdgeStyle;
  }>;
  /** Group membership map: groupLabel → nodeLabels[] */
  groupIndex: Array<{ group: string; members: string[] }>;
  /** How to use the diagram tools when the extension is installed */
  usage: string;
}

export interface DiagramDocument {
  meta: DiagramMeta;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  groups?: DiagramGroup[];
  viewport?: {
    x: number;
    y: number;
    zoom: number;
  };
  /** Auto-generated agent-readable context. See {@link AgentContext}. */
  agentContext?: AgentContext;
}

export const NODE_SHAPES: readonly NodeShape[] = [
  'rectangle',
  'rounded',
  'diamond',
  'cylinder',
] as const;

export const EDGE_STYLES: readonly EdgeStyle[] = [
  'solid',
  'dashed',
  'dotted',
] as const;

export const ARROW_TYPES: readonly ArrowType[] = [
  'normal',
  'arrow',
  'open',
  'none',
] as const;

export const NODE_COLORS: readonly NodeColor[] = [
  'default',
  'blue',
  'green',
  'red',
  'yellow',
  'purple',
  'gray',
] as const;

export const DEFAULT_NODE_WIDTH = 160;
export const DEFAULT_NODE_HEIGHT = 48;
