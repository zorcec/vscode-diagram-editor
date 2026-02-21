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
