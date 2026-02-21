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
 *  - Stay compact so token budget is not wasted (omit empty/default values).
 *  - Surface warnings (deprecations, debt, security boundaries) as insights.
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
    ...(n.type ? { type: n.type } : {}),
    ...(n.notes ? { notes: n.notes } : {}),
    ...(n.group ? { group: n.group } : {}),
    ...(n.tags && n.tags.length > 0 ? { tags: n.tags } : {}),
    ...(n.properties && Object.keys(n.properties).length > 0 ? { properties: n.properties } : {}),
    ...(n.securityClassification ? { securityClassification: n.securityClassification } : {}),
    ...(n.deploymentEnvironment ? { deploymentEnvironment: n.deploymentEnvironment } : {}),
  }));

  const edgeIndex = doc.edges.map((e) => {
    const src = nodeMap.get(e.source)?.label ?? e.source;
    const tgt = nodeMap.get(e.target)?.label ?? e.target;
    return {
      from: src,
      to: tgt,
      ...(e.label ? { label: e.label } : {}),
      ...(e.style !== 'solid' ? { style: e.style } : {}),
      ...(e.protocol ? { protocol: e.protocol } : {}),
      ...(e.dataTypes && e.dataTypes.length > 0 ? { dataTypes: e.dataTypes } : {}),
    };
  });

  const groupIndex = buildGroupIndex(doc, nodeMap);
  const summary = buildSummary(doc, groupIndex);
  const insights = buildInsights(doc);

  return {
    format: 'diagramflow-v1',
    generatedAt: new Date().toISOString(),
    summary,
    nodeIndex,
    edgeIndex,
    groupIndex,
    ...(doc.meta.glossary && Object.keys(doc.meta.glossary).length > 0
      ? { glossary: doc.meta.glossary }
      : {}),
    ...(insights.length > 0 ? { insights } : {}),
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

  const levelHint = doc.meta.abstractionLevel
    ? ` Abstraction level: ${doc.meta.abstractionLevel}.`
    : '';

  const ownerHint =
    doc.meta.owners && doc.meta.owners.length > 0
      ? ` Owned by: ${doc.meta.owners.join(', ')}.`
      : '';

  const groupSummary =
    groupIndex.length > 0
      ? ` Grouped into: ${groupIndex.map((g) => `"${g.group}" (${g.members.length} nodes)`).join(', ')}.`
      : '';

  return (
    `"${title}" contains ${nodeCount} node${nodeCount !== 1 ? 's' : ''} ` +
    `(${nodeList}) connected by ${edgeCount} edge${edgeCount !== 1 ? 's' : ''}.` +
    `${levelHint}${ownerHint}${groupSummary}${description}`
  );
}

/**
 * Generates auto-detected insights for the agent — deprecation warnings,
 * security boundary notices, technical debt callouts, and ADR references.
 * These are surfaced so agents do not inadvertently modify or replicate
 * components that are deprecated, security-sensitive, or under active migration.
 */
function buildInsights(doc: DiagramDocument): string[] {
  const insights: string[] = [];

  for (const node of doc.nodes) {
    if (node.properties?.status) {
      if (node.properties.status === 'deprecated') {
        insights.push(`"${node.label}" is deprecated — avoid adding new dependencies to it.`);
      } else if (node.properties.status.startsWith('being-replaced-by:')) {
        const successor = node.properties.status.replace('being-replaced-by:', '').trim();
        insights.push(
          `"${node.label}" is being replaced by "${successor}" — prefer using the successor.`,
        );
      } else {
        insights.push(`"${node.label}" status: ${node.properties.status}.`);
      }
    }

    if (node.tags?.includes('deprecated')) {
      insights.push(`"${node.label}" is tagged as deprecated.`);
    }

    if (
      node.securityClassification === 'pii-data-store' ||
      node.securityClassification === 'security-boundary'
    ) {
      insights.push(
        `"${node.label}" is classified as "${node.securityClassification}" — apply extra caution when modifying data access patterns.`,
      );
    }

    if (node.properties?.technicalDebt) {
      insights.push(`"${node.label}" has known technical debt: ${node.properties.technicalDebt}`);
    }

    if (node.properties?.adr) {
      insights.push(`"${node.label}" is governed by ADR: ${node.properties.adr}`);
    }
  }

  return insights;
}
