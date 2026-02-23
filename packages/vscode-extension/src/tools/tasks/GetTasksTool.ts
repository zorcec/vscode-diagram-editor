import * as vscode from 'vscode';
import { openTasksDocument, fileNameFromPath } from './taskHelpers';

interface GetTasksInput {
  /** Absolute path to the .tasks.md file to read. */
  filePath: string;
}

/**
 * Read a .tasks.md file and return the structured task list as JSON.
 * Shows all tasks with their ids, statuses, priorities, and section groupings.
 */
export class GetTasksTool implements vscode.LanguageModelTool<GetTasksInput> {
  async prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<GetTasksInput>,
    _token: vscode.CancellationToken,
  ) {
    const fileName = fileNameFromPath(options.input.filePath);
    return { invocationMessage: `Reading tasks from ${fileName}...` };
  }

  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<GetTasksInput>,
    _token: vscode.CancellationToken,
  ): Promise<vscode.LanguageModelToolResult> {
    const result = await openTasksDocument(options.input.filePath);
    if ('error' in result) {
      return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(result.error)]);
    }

    const { parsed } = result;
    const summary = {
      title: parsed.title,
      description: parsed.description,
      resources: parsed.meta.resources,
      lastUpdated: parsed.meta.lastUpdated,
      sections: parsed.sections.map((s) => ({
        title: s.title,
        tasks: s.tasks.map((t) => ({
          id: t.id,
          text: t.text,
          status: t.status,
          priority: t.priority,
          completedAt: t.completedAt,
          notes: t.notes,
          links: t.links,
        })),
      })),
    };

    return new vscode.LanguageModelToolResult([
      new vscode.LanguageModelTextPart(JSON.stringify(summary, null, 2)),
    ]);
  }
}
