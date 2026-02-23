/**
 * Parser for the .tasks.md file format.
 *
 * Format specification:
 *   - YAML front matter between --- delimiters
 *   - First H1 is the document title
 *   - H2 headings create task sections
 *   - Tasks are GFM checkboxes: `- [ ] text` or `- [x] text`
 *   - Each task may be preceded by an HTML comment with JSON metadata:
 *     <!-- {"id": "task-001", "status": "in-progress", "priority": "high"} -->
 */

import { nanoid } from 'nanoid';
import type { Task, TaskSection, TasksMeta, TasksDocument } from '../types/TasksDocument';

const FRONT_MATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---/;
const H1_RE = /^# (.+)$/m;
const TASK_META_COMMENT_RE = /<!--\s*(\{[\s\S]*?\})\s*-->/;
const CHECKBOX_RE = /^- \[([ xX])\] (.+)$/;

/** Parse minimal YAML front matter (supports string values and string arrays only). */
function parseFrontMatter(yaml: string): TasksMeta {
  const meta: TasksMeta = { lastUpdated: new Date().toISOString().slice(0, 10) };
  const lines = yaml.split('\n');
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const kvMatch = line.match(/^(\w+):\s*"?([^"\n]*)"?\s*$/);
    if (kvMatch && kvMatch[1] !== 'resources') {
      const [, key, value] = kvMatch;
      if (key === 'lastUpdated') meta.lastUpdated = value.trim();
      i++;
      continue;
    }
    if (line.match(/^resources:\s*$/)) {
      const resources: string[] = [];
      i++;
      while (i < lines.length && lines[i].match(/^\s*-\s/)) {
        resources.push(lines[i].replace(/^\s*-\s+/, '').trim().replace(/^"(.*)"$/, '$1'));
        i++;
      }
      meta.resources = resources;
      continue;
    }
    i++;
  }
  return meta;
}

/**
 * Splits raw markdown body into blocks separated by H2 headings.
 * The first block (title=null) is the preamble before any section.
 */
function splitBySections(body: string): { title: string | null; content: string }[] {
  const sections: { title: string | null; content: string }[] = [];
  const lines = body.split('\n');
  let currentTitle: string | null = null;
  let currentLines: string[] = [];

  for (const line of lines) {
    const h2Match = line.match(/^## (.+)$/);
    if (h2Match) {
      sections.push({ title: currentTitle, content: currentLines.join('\n') });
      currentTitle = h2Match[1].trim();
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }
  sections.push({ title: currentTitle, content: currentLines.join('\n') });
  return sections;
}

/** Safe JSON parse of task comment metadata. Returns partial Task or null. */
function parseMetaComment(raw: string): Partial<Task> | null {
  try {
    return JSON.parse(raw) as Partial<Task>;
  } catch {
    return null;
  }
}

/** Parse task checkboxes from a section body, respecting preceding meta comments. */
function parseTaskItems(body: string): Task[] {
  const tasks: Task[] = [];
  const lines = body.split('\n');
  let pendingMeta: Partial<Task> | null = null;

  for (const line of lines) {
    const commentMatch = line.match(TASK_META_COMMENT_RE);
    if (commentMatch) {
      pendingMeta = parseMetaComment(commentMatch[1]);
      continue;
    }

    const checkboxMatch = line.match(CHECKBOX_RE);
    if (checkboxMatch) {
      const isChecked = checkboxMatch[1].toLowerCase() === 'x';
      const text = checkboxMatch[2].trim();
      const task: Task = {
        id: nanoid(8),
        status: isChecked ? 'done' : 'todo',
        ...pendingMeta,
        text,
      };
      if (!pendingMeta?.status) {
        task.status = isChecked ? 'done' : 'todo';
      }
      tasks.push(task);
      pendingMeta = null;
      continue;
    }

    if (line.trim()) pendingMeta = null;
  }
  return tasks;
}

/**
 * Parse a .tasks.md file content string into a structured TasksDocument.
 */
export function parseTasksDocument(content: string): TasksDocument {
  const fmMatch = content.match(FRONT_MATTER_RE);
  const meta = fmMatch ? parseFrontMatter(fmMatch[1]) : { lastUpdated: new Date().toISOString().slice(0, 10) };
  const body = fmMatch ? content.slice(fmMatch[0].length) : content;

  const h1Match = body.match(H1_RE);
  const title = h1Match ? h1Match[1].trim() : 'Task List';
  const afterTitle = h1Match ? body.slice(body.indexOf(h1Match[0]) + h1Match[0].length) : body;

  const blocks = splitBySections(afterTitle);
  const description = blocks[0]?.content.trim() || undefined;

  const sections: TaskSection[] = blocks
    .slice(1)
    .filter((b): b is { title: string; content: string } => b.title !== null)
    .map((b) => ({ title: b.title, tasks: parseTaskItems(b.content) }));

  return { meta, title, description, sections };
}
