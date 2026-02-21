import type {
  DiagramDocument,
  DiagramNode,
  DiagramEdge,
  NodeShape,
  EdgeStyle,
  ArrowType,
  NodeColor,
} from '../types/DiagramDocument';

export type SemanticOp =
  | { op: 'add_node'; node: Partial<DiagramNode> & { label: string } }
  | { op: 'remove_node'; id: string }
  | {
      op: 'update_node';
      id: string;
      changes: Partial<Omit<DiagramNode, 'id'>>;
    }
  | {
      op: 'add_edge';
      edge: Partial<DiagramEdge> & { source: string; target: string };
    }
  | { op: 'remove_edge'; id: string }
  | {
      op: 'update_edge';
      id: string;
      changes: Partial<Omit<DiagramEdge, 'id'>>;
    };

export interface OpResult {
  success: boolean;
  document?: DiagramDocument;
  error?: string;
}

export { type DiagramDocument, type DiagramNode, type DiagramEdge };
export { type NodeShape, type EdgeStyle, type ArrowType, type NodeColor };
