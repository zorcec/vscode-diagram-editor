import * as vscode from 'vscode';
import { nanoid } from 'nanoid';
import type { TaskStatus, TaskPriority, TaskLink } from '../../types/TasksDocument';
import { openTasksDocument, writeTasksDocument, fileNameFromPath } from './taskHelpers';

interface AddTaskInput {
  /** Absolute path to the .tasks.md file. */
  filePath: string;
  /** Section title to add the task to. Must match an existing H2 heading exactly. */
  section: string;
  /** Task description text. */
  text: string;
  /** Initial status (defaults to 'todo'). */
  status?: TaskStatus;
  /** Optional priority level. */
  priority?: TaskPriority;
  /** Optional notes. */
  notes?: string;
  /** Optional related links. */
  links?: TaskLink[];
}

/**
 * Add a new task to a section in a .tasks.md file.
 * The task is appended at the end of the specified section.
 */
export class AddTaskTool implements vscode.LanguageModelTool<AddTaskInput> {
  async prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<AddTaskInput>,
    _token: vscode.CancellationToken,
  ) {
    const fileName = fileNameFromPath(options.input.filePath);
    return { invocationMessage: `Adding task to "${options.input.section}" in ${fileName}...` };
  }

  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<AddTaskInput>,
    _token: vscode.CancellationToken,
  ): Promise<vscode.LanguageModelToolResult> {
    const { filePath, section, text, status = 'todo', priority, notes, links } = options.input;
    const result = await openTasksDocument(filePath);
    if ('error' in result) {
      return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(result.error)]);
    }

    const { doc, parsed } = result;
    const targetSection = parsed.sections.find((s) => s.title === section);
    if (!targetSection) {
      const available = parsed.sections.map((s) => `"${s.title}"`).join(', ');
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(
          `Section "${section}" not found. Available sections: ${available || 'none'}`,
        ),
      ]);
    }

    const newTask = {
      id: nanoid(8),
      text,
      status,
      ...(priority !== undefined && { priority }),
      ...(notes !== undefined && { notes }),
      ...(links !== undefined && { links }),
    };

    const updatedSections = parsed.sections.map((s) =>
      s.title === section ? { ...s, tasks: [...s.tasks, newTask] } : s,
    );

    await writeTasksDocument(doc, { ...parsed, sections: updatedSections });

    return new vscode.LanguageModelToolResult([
      new vscode.LanguageModelTextPart(`Task added with id "${newTask.id}".`),
    ]);
  }
}
