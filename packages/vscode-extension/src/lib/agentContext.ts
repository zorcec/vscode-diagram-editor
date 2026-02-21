/**
 * Module: src/lib/agentContext.ts
 *
 * Auto-generates an {@link AgentContext} block for every diagram save.
 * The generated block is designed to be consumed by AI coding agents
 * (GitHub Copilot, Claude, etc.) when the VS Code extension is NOT present —
 * they can read the raw `.diagram` JSON and immediately understand the
 * architecture/flow depicted in the diagram.
 *
 * Design principles for LLM comprehension:
 *  - Use natural language, not serialised internal state.
 *  - Keep labels as the primary identifiers (not opaque IDs).
 *  - Expose enough structure for an LLM to reconstruct a mental model.
 *  - Stay compact so token budget is not wasted.
 */

import type { DiagramDocument, AgentContext } from '../types/DiagramDocument';

const USAGE_HINT =
  'When the DiagramFlow VS Code extension is installed, use the ' +
  'diagramflow_getDiagram / diagramflow_addNodes / diagramflow_addEdges / ' +
  'diagramflow_updateNodes / diagramflow_updateEdges / diagramflow_removeNodes / ' +
  'diagramflow_removeEdges tools to read and modify this diagram programmatically.';

/** Generates a new {@link AgentContext} from the current diagram state. */
export function generateAgentContext(doc: DiagramDocument): AgentContext {
  const nodeMap = new Map(doc.nodes.map((n) => [n.id, n]));

  const nodeIndex = doc.nodes.map((n) => ({
    id: n.id,
    label: n.label,
    ...(n.notes ? { notes: n.notes } : {}),
    ...(n.group ? { group: n.group } : {}),
  }));

  const edgeIndex = doc.edges.map((e) => {
    const src = nodeMap.get(e.source)?.label ?? e.source;
    const tgt = nodeMap.get(e.target)?.label ?? e.target;
    return {
      from: src,
      to: tgt,
      ...(e.label ? { label: e.label } : {}),
      ...(e.style !== 'solid' ? { style: e.style } : {}),
    };
  });

  const groupIndex = buildGroupIndex(doc, nodeMap);
  const summary = buildSummary(doc, groupIndex);

  return {
    format: 'diagramflow-v1',
    generatedAt: new Date().toISOString(),
    summary,
    nodeIndex,
    edgeIndex,
    groupIndex,
    usage: USAGE_HINT,
  };
}

function buildGroupIndex(
  doc: DiagramDocument,
  nodeMap: Map<string, (typeof doc.nodes)[number]>,
): AgentContext['groupIndex'] {
  if (!doc.groups || doc.groups.length === 0) return [];

  return doc.groups.map((g) => {
    const members = doc.nodes
      .filter((n) => n.group === g.id)
      .map((n) => n.label);
    return { group: g.label, members };
  });
}

function buildSummary(
  doc: DiagramDocument,
  groupIndex: AgentContext['groupIndex'],
): string {
  const nodeCount = doc.nodes.length;
  const edgeCount = doc.edges.length;
  const title = doc.meta.title || 'Untitled Diagram';
  const description = doc.meta.description ? ` ${doc.meta.description}` : '';

  if (nodeCount === 0) {
    return `"${title}" is an empty diagram.${description}`;
  }

  const nodeNames = doc.nodes.slice(0, 5).map((n) => `"${n.label}"`);
  const moreNodes = nodeCount > 5 ? ` and ${nodeCount - 5} more` : '';
  const nodeList = `${nodeNames.join(', ')}${moreNodes}`;

  const groupSummary =
    groupIndex.length > 0
      ? ` Grouped into: ${groupIndex.map((g) => `"${g.group}" (${g.members.length} nodes)`).join(', ')}.`
      : '';

  return (
    `"${title}" contains ${nodeCount} node${nodeCount !== 1 ? 's' : ''} ` +
    `(${nodeList}) connected by ${edgeCount} edge${edgeCount !== 1 ? 's' : ''}.` +
    `${groupSummary}${description}`
  );
}
