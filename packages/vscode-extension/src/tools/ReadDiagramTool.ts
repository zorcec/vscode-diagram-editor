import * as vscode from 'vscode';
import type { DiagramService } from '../DiagramService';
import type { AgentContext, DiagramDocument } from '../types/DiagramDocument';

interface ReadDiagramInput {
  /** Workspace-absolute path to the .diagram file to read. */
  filePath: string;
}

/**
 * LLM-optimised diagram reader.
 *
 * Unlike `GetDiagramTool` (which exposes raw IDs and structure for tool-use),
 * this tool returns a plain-text architecture description designed for LLM
 * comprehension.  No coordinates, no opaque IDs — just the semantic content
 * the model needs to understand the diagram and reason about the architecture.
 *
 * `filePath` is required so the agent always specifies which .diagram file to read.
 * Use this tool first when asked to review, explain, or reason about a diagram.
 * Use `diagramflow_getDiagram` when you need IDs to update the diagram.
 */
export class ReadDiagramTool implements vscode.LanguageModelTool<ReadDiagramInput> {
  constructor(private readonly diagramService: DiagramService) {}

  async prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<ReadDiagramInput>,
    _token: vscode.CancellationToken,
  ) {
    const fileName = options.input.filePath.split('/').pop() ?? options.input.filePath;
    return { invocationMessage: `Reading diagram architecture from ${fileName}…` };
  }

  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<ReadDiagramInput>,
    _token: vscode.CancellationToken,
  ): Promise<vscode.LanguageModelToolResult> {
    const uri = vscode.Uri.file(options.input.filePath);
    let textDoc: vscode.TextDocument;
    try {
      textDoc = await vscode.workspace.openTextDocument(uri);
    } catch {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(
          `Cannot open file: ${options.input.filePath}. Make sure the path exists and is a .diagram file.`,
        ),
      ]);
    }

    const doc = this.diagramService.parseDocument(textDoc);
    if (!doc) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(
          `Cannot parse diagram at: ${options.input.filePath}`,
        ),
      ]);
    }

    const text = buildReadableText(doc);
    return new vscode.LanguageModelToolResult([
      new vscode.LanguageModelTextPart(text),
    ]);
  }
}

/**
 * Converts a DiagramDocument to a compact, human-readable architecture
 * description suitable for LLM consumption.
 *
 * Priority order:
 * 1. Use the pre-generated agentContext if fresh (< 1 min old)
 * 2. Fall back to building a minimal description from the raw document
 */
export function buildReadableText(doc: DiagramDocument): string {
  if (doc.agentContext) {
    return formatAgentContext(doc.agentContext);
  }

  // Fallback: build minimal description from raw doc
  return buildMinimalDescription(doc);
}

function formatAgentContext(ctx: AgentContext): string {
  const lines: string[] = [];

  lines.push(`# Diagram Summary\n${ctx.summary}`);

  if (ctx.groupIndex.length > 0) {
    lines.push('\n## Groups');
    for (const g of ctx.groupIndex) {
      const members = g.members.length > 0 ? g.members.join(', ') : '(empty)';
      lines.push(`- **${g.group}**: ${members}`);
    }
  }

  if (ctx.nodeIndex.length > 0) {
    lines.push('\n## Components');
    for (const n of ctx.nodeIndex) {
      const parts: string[] = [`**${n.label}**`];
      if (n.type) parts.push(`[${n.type}]`);
      if (n.notes) parts.push(`— ${n.notes}`);
      if (n.securityClassification) parts.push(`(${n.securityClassification})`);
      if (n.tags && n.tags.length > 0) parts.push(`tags: ${n.tags.join(', ')}`);
      lines.push(`- ${parts.join(' ')}`);

      if (n.properties && Object.keys(n.properties).length > 0) {
        const { repo, team, openapi, adr, technicalDebt, status } = n.properties as any;
        if (repo) lines.push(`  - repo: ${repo}`);
        if (team) lines.push(`  - team: ${team}`);
        if (openapi) lines.push(`  - openapi: ${openapi}`);
        if (adr) lines.push(`  - adr: ${adr}`);
        if (technicalDebt) lines.push(`  - ⚠️ debt: ${technicalDebt}`);
        if (status) lines.push(`  - status: ${status}`);
      }
    }
  }

  if (ctx.edgeIndex.length > 0) {
    lines.push('\n## Connections');
    for (const e of ctx.edgeIndex) {
      const parts: string[] = [`${e.from} → ${e.to}`];
      if (e.label) parts.push(`"${e.label}"`);
      if (e.protocol) parts.push(`via ${e.protocol}`);
      if (e.style && e.style !== 'solid') parts.push(`(${e.style})`);
      if (e.dataTypes && e.dataTypes.length > 0) parts.push(`[${e.dataTypes.join(', ')}]`);
      lines.push(`- ${parts.join(' ')}`);
    }
  }

  if (ctx.insights && ctx.insights.length > 0) {
    lines.push('\n## ⚠️ Insights');
    for (const insight of ctx.insights) {
      lines.push(`- ${insight}`);
    }
  }

  if (ctx.glossary && Object.keys(ctx.glossary).length > 0) {
    lines.push('\n## Glossary');
    for (const [term, def] of Object.entries(ctx.glossary)) {
      lines.push(`- **${term}**: ${def}`);
    }
  }

  return lines.join('\n');
}

function buildMinimalDescription(doc: DiagramDocument): string {
  const lines: string[] = [];
  const title = doc.meta.title || 'Untitled Diagram';

  lines.push(`# ${title}`);
  if (doc.meta.description) lines.push(doc.meta.description);

  if (doc.nodes.length === 0) {
    lines.push('\n(No nodes)');
    return lines.join('\n');
  }

  const nodeMap = new Map(doc.nodes.map((n) => [n.id, n.label]));

  lines.push('\n## Components');
  for (const n of doc.nodes) {
    const parts = [`**${n.label}**`];
    if (n.notes) parts.push(`— ${n.notes}`);
    lines.push(`- ${parts.join(' ')}`);
  }

  if (doc.edges.length > 0) {
    lines.push('\n## Connections');
    for (const e of doc.edges) {
      const from = nodeMap.get(e.source) ?? e.source;
      const to = nodeMap.get(e.target) ?? e.target;
      const parts = [`${from} → ${to}`];
      if (e.label) parts.push(`"${e.label}"`);
      lines.push(`- ${parts.join(' ')}`);
    }
  }

  return lines.join('\n');
}
