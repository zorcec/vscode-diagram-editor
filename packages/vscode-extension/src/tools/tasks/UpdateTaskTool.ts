import * as vscode from 'vscode';
import type { TaskStatus, TaskPriority, TaskLink } from '../../types/TasksDocument';
import { openTasksDocument, writeTasksDocument, fileNameFromPath } from './taskHelpers';

interface UpdateTaskInput {
  /** Absolute path to the .tasks.md file. */
  filePath: string;
  /** Id of the task to update. */
  taskId: string;
  /** New status for the task. */
  status?: TaskStatus;
  /** New display text for the task. */
  text?: string;
  /** Priority level. */
  priority?: TaskPriority;
  /** ISO-8601 completion timestamp (auto-set when status changes to done). */
  completedAt?: string;
  /** Additional notes or context. */
  notes?: string;
  /** Related links. */
  links?: TaskLink[];
}

/**
 * Update an existing task in a .tasks.md file.
 * Merges the provided fields into the task and saves the file.
 */
export class UpdateTaskTool implements vscode.LanguageModelTool<UpdateTaskInput> {
  async prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<UpdateTaskInput>,
    _token: vscode.CancellationToken,
  ) {
    const fileName = fileNameFromPath(options.input.filePath);
    return { invocationMessage: `Updating task "${options.input.taskId}" in ${fileName}...` };
  }

  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<UpdateTaskInput>,
    _token: vscode.CancellationToken,
  ): Promise<vscode.LanguageModelToolResult> {
    const { filePath, taskId, ...changes } = options.input;
    const result = await openTasksDocument(filePath);
    if ('error' in result) {
      return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(result.error)]);
    }

    const { doc, parsed } = result;
    let found = false;

    const updatedSections = parsed.sections.map((section) => ({
      ...section,
      tasks: section.tasks.map((task) => {
        if (task.id !== taskId) return task;
        found = true;
        const updated = { ...task, ...changes };
        // Auto-set completedAt when marking done
        if (changes.status === 'done' && !task.completedAt && !changes.completedAt) {
          updated.completedAt = new Date().toISOString().slice(0, 10);
        }
        // Clear completedAt when un-completing
        if (changes.status && changes.status !== 'done') {
          updated.completedAt = undefined;
        }
        return updated;
      }),
    }));

    if (!found) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(`Task "${taskId}" not found in ${filePath}`),
      ]);
    }

    await writeTasksDocument(doc, { ...parsed, sections: updatedSections });
    return new vscode.LanguageModelToolResult([
      new vscode.LanguageModelTextPart(`Task "${taskId}" updated successfully.`),
    ]);
  }
}
