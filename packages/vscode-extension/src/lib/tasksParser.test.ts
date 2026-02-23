import { describe, it, expect } from 'vitest';
import { parseTasksDocument } from './tasksParser';
import { serializeTasksDocument, touchMeta } from './tasksSerializer';

const SAMPLE = `---
lastUpdated: "2025-02-22"
resources:
  - "architecture.diagram.svg"
---

# Task List

Optional description paragraph.

## Backend

<!-- {"id":"task-001","status":"todo","priority":"high"} -->
- [ ] Write unit tests for auth

<!-- {"id":"task-002","status":"done","completedAt":"2025-02-22"} -->
- [x] Extract JWT logic

## Frontend

<!-- {"id":"task-003","status":"in-progress"} -->
- [ ] Build login page
`;

describe('parseTasksDocument', () => {
  it('parses front matter metadata', () => {
    const doc = parseTasksDocument(SAMPLE);
    expect(doc.meta.lastUpdated).toBe('2025-02-22');
    expect(doc.meta.resources).toEqual(['architecture.diagram.svg']);
  });

  it('parses document title from H1', () => {
    const doc = parseTasksDocument(SAMPLE);
    expect(doc.title).toBe('Task List');
  });

  it('parses optional description', () => {
    const doc = parseTasksDocument(SAMPLE);
    expect(doc.description).toBe('Optional description paragraph.');
  });

  it('parses sections from H2 headings', () => {
    const doc = parseTasksDocument(SAMPLE);
    expect(doc.sections).toHaveLength(2);
    expect(doc.sections[0].title).toBe('Backend');
    expect(doc.sections[1].title).toBe('Frontend');
  });

  it('parses tasks within sections', () => {
    const doc = parseTasksDocument(SAMPLE);
    expect(doc.sections[0].tasks).toHaveLength(2);
    expect(doc.sections[1].tasks).toHaveLength(1);
  });

  it('maps [ ] checkbox to todo status', () => {
    const doc = parseTasksDocument(SAMPLE);
    expect(doc.sections[0].tasks[0].text).toBe('Write unit tests for auth');
    expect(doc.sections[0].tasks[0].status).toBe('todo');
  });

  it('maps [x] checkbox to done status', () => {
    const doc = parseTasksDocument(SAMPLE);
    expect(doc.sections[0].tasks[1].text).toBe('Extract JWT logic');
    expect(doc.sections[0].tasks[1].status).toBe('done');
  });

  it('reads task id from HTML comment', () => {
    const doc = parseTasksDocument(SAMPLE);
    expect(doc.sections[0].tasks[0].id).toBe('task-001');
  });

  it('reads priority from HTML comment', () => {
    const doc = parseTasksDocument(SAMPLE);
    expect(doc.sections[0].tasks[0].priority).toBe('high');
  });

  it('reads completedAt from HTML comment', () => {
    const doc = parseTasksDocument(SAMPLE);
    expect(doc.sections[0].tasks[1].completedAt).toBe('2025-02-22');
  });

  it('reads in-progress status from HTML comment', () => {
    const doc = parseTasksDocument(SAMPLE);
    expect(doc.sections[1].tasks[0].status).toBe('in-progress');
  });

  it('generates id for tasks missing HTML comment', () => {
    const content = `---\nlastUpdated: "2025-02-22"\n---\n# Tasks\n## Group\n- [ ] No comment task`;
    const doc = parseTasksDocument(content);
    expect(doc.sections[0].tasks[0].id).toBeTruthy();
    expect(doc.sections[0].tasks[0].id.length).toBeGreaterThan(4);
  });

  it('handles empty document', () => {
    const doc = parseTasksDocument('');
    expect(doc.title).toBe('Task List');
    expect(doc.sections).toHaveLength(0);
  });

  it('handles document with no sections', () => {
    const doc = parseTasksDocument('# My Tasks\n\nSome description.');
    expect(doc.title).toBe('My Tasks');
    expect(doc.sections).toHaveLength(0);
    expect(doc.description).toBe('Some description.');
  });

  it('handles document without front matter', () => {
    const content = '# My Tasks\n## Work\n- [ ] Do something';
    const doc = parseTasksDocument(content);
    expect(doc.meta.lastUpdated).toBeTruthy();
    expect(doc.sections[0].tasks[0].text).toBe('Do something');
  });

  it('handles [X] uppercase checked checkbox', () => {
    const content = '# T\n## S\n- [X] Done task';
    const doc = parseTasksDocument(content);
    expect(doc.sections[0].tasks[0].status).toBe('done');
  });
});

describe('serializeTasksDocument', () => {
  it('round-trips through parse → serialize → parse', () => {
    const original = parseTasksDocument(SAMPLE);
    const serialized = serializeTasksDocument(original);
    const reparsed = parseTasksDocument(serialized);
    expect(reparsed.title).toBe(original.title);
    expect(reparsed.meta.lastUpdated).toBe(original.meta.lastUpdated);
    expect(reparsed.sections).toHaveLength(original.sections.length);
    expect(reparsed.sections[0].tasks[0].id).toBe(original.sections[0].tasks[0].id);
    expect(reparsed.sections[0].tasks[0].text).toBe(original.sections[0].tasks[0].text);
    expect(reparsed.sections[0].tasks[0].status).toBe(original.sections[0].tasks[0].status);
  });

  it('serializes done task with [x] checkbox', () => {
    const doc = parseTasksDocument(SAMPLE);
    const md = serializeTasksDocument(doc);
    expect(md).toContain('- [x] Extract JWT logic');
  });

  it('serializes todo task with [ ] checkbox', () => {
    const doc = parseTasksDocument(SAMPLE);
    const md = serializeTasksDocument(doc);
    expect(md).toContain('- [ ] Write unit tests for auth');
  });

  it('includes task ids in HTML comments', () => {
    const doc = parseTasksDocument(SAMPLE);
    const md = serializeTasksDocument(doc);
    expect(md).toContain('task-001');
    expect(md).toContain('task-002');
  });

  it('includes front matter with lastUpdated', () => {
    const doc = parseTasksDocument(SAMPLE);
    const md = serializeTasksDocument(doc);
    expect(md).toContain('---');
    expect(md).toContain('lastUpdated:');
  });

  it('includes resources in front matter', () => {
    const doc = parseTasksDocument(SAMPLE);
    const md = serializeTasksDocument(doc);
    expect(md).toContain('architecture.diagram.svg');
  });

  it('includes section headings as H2', () => {
    const doc = parseTasksDocument(SAMPLE);
    const md = serializeTasksDocument(doc);
    expect(md).toContain('## Backend');
    expect(md).toContain('## Frontend');
  });

  it('preserves in-progress status in meta comment', () => {
    const doc = parseTasksDocument(SAMPLE);
    const md = serializeTasksDocument(doc);
    expect(md).toContain('"in-progress"');
  });
});

describe('touchMeta', () => {
  it('updates lastUpdated to today', () => {
    const meta = { lastUpdated: '2024-01-01' };
    const updated = touchMeta(meta);
    const today = new Date().toISOString().slice(0, 10);
    expect(updated.lastUpdated).toBe(today);
  });

  it('preserves other meta fields', () => {
    const meta = { lastUpdated: '2024-01-01', resources: ['file.md'] };
    const updated = touchMeta(meta);
    expect(updated.resources).toEqual(['file.md']);
  });
});
