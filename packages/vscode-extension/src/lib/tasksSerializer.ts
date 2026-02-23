/**
 * Serializer for the .tasks.md file format.
 *
 * Converts a TasksDocument back to human-readable markdown that keeps:
 *  - YAML front matter for document metadata
 *  - HTML comments with compact JSON for task metadata (id, status, priority...)
 *  - GFM checkboxes where [x] = done and [ ] = todo/in-progress
 */

import type { Task, TasksMeta, TasksDocument } from '../types/TasksDocument';

/** Serialize YAML front matter from TasksMeta. */
function serializeFrontMatter(meta: TasksMeta): string {
  const lines = [`lastUpdated: "${meta.lastUpdated}"`];
  if (meta.resources && meta.resources.length > 0) {
    lines.push('resources:');
    for (const r of meta.resources) {
      lines.push(`  - "${r}"`);
    }
  }
  return `---\n${lines.join('\n')}\n---`;
}

/** Serialize a single task to one or two markdown lines (comment + checkbox). */
function serializeTask(task: Task): string {
  const { text, status, ...rest } = task;
  const checkbox = status === 'done' ? '- [x]' : '- [ ]';

  // Include status in meta only when it's 'in-progress' — done/todo are recoverable
  // from the checkbox, but in-progress cannot be inferred without the comment.
  const metaPayload: Partial<Task> = {
    ...rest,
    ...(status === 'in-progress' ? { status } : {}),
  };
  const metaJson = JSON.stringify(metaPayload);

  return `<!-- ${metaJson} -->\n${checkbox} ${text}`;
}

/**
 * Serialize a TasksDocument into .tasks.md markdown string.
 *
 * The output is fully human-readable as plain markdown and round-trips
 * exactly through parseTasksDocument → serializeTasksDocument.
 */
export function serializeTasksDocument(doc: TasksDocument): string {
  const parts: string[] = [];

  parts.push(serializeFrontMatter(doc.meta));
  parts.push('');
  parts.push(`# ${doc.title}`);

  if (doc.description) {
    parts.push('');
    parts.push(doc.description);
  }

  for (const section of doc.sections) {
    parts.push('');
    parts.push(`## ${section.title}`);
    parts.push('');
    for (const task of section.tasks) {
      parts.push(serializeTask(task));
    }
  }

  return parts.join('\n');
}

/**
 * Update the lastUpdated timestamp in a TasksMeta, returning a new meta object.
 */
export function touchMeta(meta: TasksMeta): TasksMeta {
  return { ...meta, lastUpdated: new Date().toISOString().slice(0, 10) };
}
