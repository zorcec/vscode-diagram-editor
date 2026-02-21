import { useCallback, useEffect, useRef, useState } from 'react';
import {
  useNodesState,
  useEdgesState,
  type Connection,
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
} from '@xyflow/react';
import { docToFlowNodes, docToFlowEdges, type DiagramNodeData, type DiagramEdgeData } from '../lib/docToFlow';
import { buildExportSvg, rasterizeSvgToPng } from '../lib/exportSvg';
import type { DiagramDocument, NodeShape, NodeColor, EdgeStyle, ArrowType } from '../../types/DiagramDocument';
import type { VSCodeBridge } from './useVSCodeBridge';

export type GraphState = {
  nodes: Node<DiagramNodeData>[];
  edges: Edge<DiagramEdgeData>[];
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  onNodesChange: OnNodesChange<Node<DiagramNodeData>>;
  onEdgesChange: OnEdgesChange<Edge<DiagramEdgeData>>;
  onNodeDragStop: (_event: React.MouseEvent, node: Node) => void;
  onConnect: (connection: Connection) => void;
  onNodesDelete: (deleted: Node[]) => void;
  onEdgesDelete: (deleted: Edge[]) => void;
  onSelectionChange: (params: { nodes: Node[]; edges: Edge[] }) => void;
  onAddNode: () => void;
  onNodeLabelChange: (id: string, label: string) => void;
  onUpdateNodeProps: (id: string, changes: { label?: string; shape?: NodeShape; color?: NodeColor; notes?: string }) => void;
  onUpdateEdgeProps: (id: string, changes: { label?: string; style?: EdgeStyle; arrow?: ArrowType; animated?: boolean }) => void;
  onRequestLayout: () => void;
  onExportSvg: () => void;
  onExportPng: () => void;
  onOpenSvg: () => void;
};

export function useGraphState(
  doc: DiagramDocument | null,
  bridge: VSCodeBridge,
): GraphState {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<DiagramNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge<DiagramEdgeData>>([]);
  const lastDocHashRef = useRef<string>('');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  useEffect(() => {
    if (!doc) return;
    const docHash = JSON.stringify(doc);
    if (docHash === lastDocHashRef.current) return;
    lastDocHashRef.current = docHash;
    setNodes(docToFlowNodes(doc));
    setEdges(docToFlowEdges(doc));
  }, [doc, setNodes, setEdges]);

  const onSelectionChange = useCallback(
    ({ nodes: selNodes, edges: selEdges }: { nodes: Node[]; edges: Edge[] }) => {
      const nodeId = selNodes.length === 1 ? selNodes[0].id : null;
      const edgeId = selEdges.length === 1 && selNodes.length === 0 ? selEdges[0].id : null;
      setSelectedNodeId(nodeId);
      setSelectedEdgeId(edgeId);
    },
    [setSelectedNodeId, setSelectedEdgeId],
  );

  const onNodeDragStop = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      bridge.postMessage({
        type: 'NODE_DRAGGED',
        id: node.id,
        position: {
          x: Math.round(node.position.x),
          y: Math.round(node.position.y),
        },
      });
    },
    [bridge],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      bridge.postMessage({
        type: 'ADD_EDGE',
        edge: { source: connection.source, target: connection.target },
      });
    },
    [bridge],
  );

  const onNodesDelete = useCallback(
    (deleted: Node[]) => {
      bridge.postMessage({
        type: 'DELETE_NODES',
        nodeIds: deleted.map((n) => n.id),
      });
    },
    [bridge],
  );

  const onEdgesDelete = useCallback(
    (deleted: Edge[]) => {
      bridge.postMessage({
        type: 'DELETE_EDGES',
        edgeIds: deleted.map((e) => e.id),
      });
    },
    [bridge],
  );

  const onAddNode = useCallback(() => {
    bridge.postMessage({
      type: 'ADD_NODE',
      node: { label: 'New Node', shape: 'rectangle', color: 'default' },
    });
  }, [bridge]);

  const onNodeLabelChange = useCallback(
    (id: string, label: string) => {
      bridge.postMessage({ type: 'UPDATE_NODE_LABEL', id, label });
    },
    [bridge],
  );

  const onUpdateNodeProps = useCallback(
    (id: string, changes: { label?: string; shape?: NodeShape; color?: NodeColor; notes?: string }) => {
      bridge.postMessage({ type: 'UPDATE_NODE_PROPS', id, changes });
    },
    [bridge],
  );

  const onUpdateEdgeProps = useCallback(
    (id: string, changes: { label?: string; style?: EdgeStyle; arrow?: ArrowType; animated?: boolean }) => {
      bridge.postMessage({ type: 'UPDATE_EDGE_PROPS', id, changes });
    },
    [bridge],
  );

  const onRequestLayout = useCallback(() => {
    bridge.postMessage({ type: 'REQUEST_LAYOUT' });
  }, [bridge]);

  const onExportSvg = useCallback(() => {
    const svgData = buildExportSvg(doc);
    if (!svgData) return;
    bridge.postMessage({ type: 'EXPORT', format: 'svg', data: svgData });
  }, [bridge, doc]);

  const onExportPng = useCallback(() => {
    const svgData = buildExportSvg(doc);
    if (!svgData) return;
    rasterizeSvgToPng(svgData, (base64) => {
      bridge.postMessage({ type: 'EXPORT', format: 'png', data: base64 });
    });
  }, [bridge, doc]);

  const onOpenSvg = useCallback(() => {
    bridge.postMessage({ type: 'OPEN_SVG_REQUEST' });
  }, [bridge]);

  return {
    nodes,
    edges,
    selectedNodeId,
    selectedEdgeId,
    onNodesChange,
    onEdgesChange,
    onNodeDragStop,
    onConnect,
    onNodesDelete,
    onEdgesDelete,
    onSelectionChange,
    onAddNode,
    onNodeLabelChange,
    onUpdateNodeProps,
    onUpdateEdgeProps,
    onRequestLayout,
    onExportSvg,
    onExportPng,
    onOpenSvg,
  };
}

