import * as vscode from 'vscode';
import type { DiagramService } from '../DiagramService';

interface RemoveNodesInput {
  nodeIds: string[];
}

export class RemoveNodesTool implements vscode.LanguageModelTool<RemoveNodesInput> {
  constructor(private readonly diagramService: DiagramService) {}

  async prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<RemoveNodesInput>,
    _token: vscode.CancellationToken,
  ) {
    return {
      invocationMessage: `Removing ${options.input.nodeIds.length} node(s)...`,
      confirmationMessages: {
        title: 'Remove diagram nodes',
        message: new vscode.MarkdownString(
          `Remove **${options.input.nodeIds.length}** node(s) and their connected edges?\n\nIDs: ${options.input.nodeIds.join(', ')}`,
        ),
      },
    };
  }

  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<RemoveNodesInput>,
    _token: vscode.CancellationToken,
  ): Promise<vscode.LanguageModelToolResult> {
    const ops = options.input.nodeIds.map((id) => ({
      op: 'remove_node' as const,
      id,
    }));

    const result = await this.diagramService.applySemanticOps(ops);

    return new vscode.LanguageModelToolResult([
      new vscode.LanguageModelTextPart(
        result.success
          ? `Removed ${options.input.nodeIds.length} node(s) and their connected edges.`
          : `Failed to remove nodes: ${result.error}`,
      ),
    ]);
  }
}
