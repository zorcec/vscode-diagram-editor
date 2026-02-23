/**
 * Shared helpers for .tasks.md LM tools.
 */

import * as vscode from 'vscode';
import { parseTasksDocument } from '../../lib/tasksParser';
import { serializeTasksDocument, touchMeta } from '../../lib/tasksSerializer';
import type { TasksDocument } from '../../types/TasksDocument';

/** Validate and open a .tasks.md file; returns an error string on failure. */
export async function openTasksDocument(
  filePath: string,
): Promise<{ doc: vscode.TextDocument; parsed: TasksDocument } | { error: string }> {
  if (!filePath.endsWith('.tasks.md')) {
    return { error: `Unsupported file: ${filePath}. Must be a .tasks.md file.` };
  }
  try {
    const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
    const parsed = parseTasksDocument(doc.getText());
    return { doc, parsed };
  } catch {
    return { error: `Cannot open file: ${filePath}` };
  }
}

/** Write an updated TasksDocument back to disk via a WorkspaceEdit. */
export async function writeTasksDocument(
  doc: vscode.TextDocument,
  tasks: TasksDocument,
): Promise<void> {
  const updated = { ...tasks, meta: touchMeta(tasks.meta) };
  const content = serializeTasksDocument(updated);
  const edit = new vscode.WorkspaceEdit();
  edit.replace(doc.uri, new vscode.Range(0, 0, doc.lineCount, 0), content);
  await vscode.workspace.applyEdit(edit);
  await doc.save();
}

export function fileNameFromPath(filePath: string): string {
  return filePath.split('/').pop() ?? filePath;
}
