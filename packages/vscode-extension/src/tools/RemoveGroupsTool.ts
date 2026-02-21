import * as vscode from 'vscode';
import type { DiagramService } from '../DiagramService';

interface RemoveGroupsInput {
  groupIds: string[];
}

export class RemoveGroupsTool implements vscode.LanguageModelTool<RemoveGroupsInput> {
  constructor(private readonly diagramService: DiagramService) {}

  async prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<RemoveGroupsInput>,
    _token: vscode.CancellationToken,
  ) {
    const count = options.input.groupIds.length;
    return {
      invocationMessage: `Removing ${count} group(s)...`,
      confirmationMessages: {
        title: 'Remove diagram groups',
        message: new vscode.MarkdownString(
          `Remove **${count}** group(s): ${options.input.groupIds.join(', ')}. ` +
            'Child nodes will remain but be detached from their group.',
        ),
      },
    };
  }

  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<RemoveGroupsInput>,
    _token: vscode.CancellationToken,
  ): Promise<vscode.LanguageModelToolResult> {
    const ops = options.input.groupIds.map((id) => ({
      op: 'remove_group' as const,
      id,
    }));

    const result = await this.diagramService.applySemanticOps(ops);

    return new vscode.LanguageModelToolResult([
      new vscode.LanguageModelTextPart(
        result.success
          ? `Removed ${options.input.groupIds.length} group(s).`
          : `Failed to remove groups: ${result.error}`,
      ),
    ]);
  }
}
