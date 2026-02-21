import * as vscode from 'vscode';
import type { DiagramService } from '../DiagramService';
import type { NodeColor } from '../types/DiagramDocument';

interface UpdateGroupsInput {
  updates: {
    id: string;
    label?: string;
    color?: string;
  }[];
}

export class UpdateGroupsTool implements vscode.LanguageModelTool<UpdateGroupsInput> {
  constructor(private readonly diagramService: DiagramService) {}

  async prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<UpdateGroupsInput>,
    _token: vscode.CancellationToken,
  ) {
    const count = options.input.updates.length;
    return {
      invocationMessage: `Updating ${count} group(s)...`,
      confirmationMessages: {
        title: 'Update diagram groups',
        message: new vscode.MarkdownString(
          `Update **${count}** group(s): ${options.input.updates.map((u) => u.id).join(', ')}`,
        ),
      },
    };
  }

  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<UpdateGroupsInput>,
    _token: vscode.CancellationToken,
  ): Promise<vscode.LanguageModelToolResult> {
    const ops = options.input.updates.map((u) => ({
      op: 'update_group' as const,
      id: u.id,
      changes: {
        ...(u.label !== undefined && { label: u.label }),
        ...(u.color && { color: u.color as NodeColor }),
      },
    }));

    const result = await this.diagramService.applySemanticOps(ops);

    return new vscode.LanguageModelToolResult([
      new vscode.LanguageModelTextPart(
        result.success
          ? `Updated ${options.input.updates.length} group(s).`
          : `Failed to update groups: ${result.error}`,
      ),
    ]);
  }
}
