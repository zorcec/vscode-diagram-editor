import * as vscode from 'vscode';
import type { DiagramService } from '../DiagramService';
import type { NodeColor } from '../types/DiagramDocument';

interface AddGroupsInput {
  groups: {
    label: string;
    color?: string;
  }[];
}

export class AddGroupsTool implements vscode.LanguageModelTool<AddGroupsInput> {
  constructor(private readonly diagramService: DiagramService) {}

  async prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<AddGroupsInput>,
    _token: vscode.CancellationToken,
  ) {
    const count = options.input.groups.length;
    const labels = options.input.groups.map((g) => g.label).join(', ');
    return {
      invocationMessage: `Adding ${count} group(s): ${labels}`,
      confirmationMessages: {
        title: 'Add diagram groups',
        message: new vscode.MarkdownString(
          `Add **${count}** group(s) to the diagram: ${labels}`,
        ),
      },
    };
  }

  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<AddGroupsInput>,
    _token: vscode.CancellationToken,
  ): Promise<vscode.LanguageModelToolResult> {
    const ops = options.input.groups.map((g) => ({
      op: 'add_group' as const,
      group: {
        label: g.label,
        ...(g.color ? { color: g.color as NodeColor } : {}),
      },
    }));

    const result = await this.diagramService.applySemanticOps(ops);

    if (!result.success) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(`Failed to add groups: ${result.error}`),
      ]);
    }

    const doc = this.diagramService.parseDocument();
    const addedGroups = doc?.groups?.slice(-options.input.groups.length) ?? [];
    return new vscode.LanguageModelToolResult([
      new vscode.LanguageModelTextPart(
        `Added ${options.input.groups.length} group(s). IDs: ${addedGroups.map((g) => `${g.id} (${g.label})`).join(', ')}`,
      ),
    ]);
  }
}
