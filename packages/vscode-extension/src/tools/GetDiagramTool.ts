import * as vscode from 'vscode';
import type { DiagramService } from '../DiagramService';
import { openDiagramDocument, fileNameFromPath } from './toolHelpers';

interface GetDiagramInput {
  /** Absolute path to the .diagram file to read. */
  filePath: string;
}

/**
 * Returns the raw diagram structure with node/edge IDs. Use this when you
 * need IDs to call update/add/remove tools. `filePath` is required so the
 * agent always specifies which file to operate on.
 */
export class GetDiagramTool implements vscode.LanguageModelTool<GetDiagramInput> {
  constructor(private readonly diagramService: DiagramService) {}

  async prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<GetDiagramInput>,
    _token: vscode.CancellationToken,
  ) {
    const fileName = fileNameFromPath(options.input.filePath);
    return { invocationMessage: `Reading diagram structure from ${fileName}...` };
  }

  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<GetDiagramInput>,
    _token: vscode.CancellationToken,
  ): Promise<vscode.LanguageModelToolResult> {
    const opened = await openDiagramDocument(options.input.filePath);
    if ('error' in opened) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(opened.error),
      ]);
    }

    const doc = this.diagramService.parseDocument(opened.doc);
    if (!doc) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(
          `Cannot parse diagram at: ${options.input.filePath}`,
        ),
      ]);
    }

    const compact = {
      title: doc.meta?.title ?? '',
      description: doc.meta?.description,
      nodes: doc.nodes.map((n) => ({
        id: n.id,
        label: n.label,
        shape: n.shape !== 'rectangle' ? n.shape : undefined,
        color: n.color !== 'default' ? n.color : undefined,
        pinned: n.pinned || undefined,
        group: n.group,
      })),
      edges: doc.edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        label: e.label,
        style: e.style !== 'solid' ? e.style : undefined,
      })),
      groups: doc.groups,
    };

    return new vscode.LanguageModelToolResult([
      new vscode.LanguageModelTextPart(JSON.stringify(compact, null, 2)),
    ]);
  }
}
