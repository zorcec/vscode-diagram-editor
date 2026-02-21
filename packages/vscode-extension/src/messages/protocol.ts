import type { DiagramDocument } from '../types/DiagramDocument';

export type WebviewMessage =
  | { type: 'WEBVIEW_READY' }
  | { type: 'NODE_DRAGGED'; id: string; position: { x: number; y: number } }
  | {
      type: 'NODE_RESIZED';
      id: string;
      dimensions: { width: number; height: number };
    }
  | {
      type: 'ADD_NODE';
      node: { label: string; shape?: string; color?: string };
    }
  | { type: 'DELETE_NODES'; nodeIds: string[] }
  | {
      type: 'ADD_EDGE';
      edge: { source: string; target: string; label?: string };
    }
  | { type: 'DELETE_EDGES'; edgeIds: string[] }
  | { type: 'UPDATE_NODE_LABEL'; id: string; label: string }
  | { type: 'REQUEST_LAYOUT' }
  | {
      type: 'EXPORT';
      format: 'svg' | 'png' | 'mermaid';
      /** SVG string (for 'svg') or base64-encoded PNG (for 'png') or Mermaid text (for 'mermaid') */
      data: string;
    }
  | { type: 'OPEN_SVG_REQUEST' };

export type ExtensionMessage =
  | { type: 'DOCUMENT_UPDATED'; doc: DiagramDocument }
  | { type: 'OPEN_SVG_RESULT'; svgContent: string };
