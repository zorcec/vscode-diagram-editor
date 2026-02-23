import React, { useState, useCallback } from 'react';
import type { TasksDocument, TaskSection, Task, TaskStatus } from '../../types/TasksDocument';
import type { TasksWebviewMessage } from '../../messages/tasksProtocol';
import { postMessageToHost } from './vsCodeBridge';

function postMessage(msg: TasksWebviewMessage): void {
  postMessageToHost(msg);
}

function statusIcon(status: TaskStatus): string {
  if (status === 'done') return '✓';
  if (status === 'in-progress') return '◐';
  return '○';
}

function statusLabel(status: TaskStatus): string {
  if (status === 'done') return 'Done';
  if (status === 'in-progress') return 'In Progress';
  return 'To Do';
}

// ─── Task Row ────────────────────────────────────────────────────────────────

interface TaskRowProps {
  task: Task;
  sectionTitle: string;
}

function TaskRow({ task, sectionTitle }: TaskRowProps) {
  const handleToggle = useCallback(() => {
    postMessage({
      type: 'TOGGLE_TASK_STATUS',
      taskId: task.id,
      sectionTitle,
      currentStatus: task.status,
    });
  }, [task.id, task.status, sectionTitle]);

  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    postMessage({ type: 'DELETE_TASK', taskId: task.id, sectionTitle });
  }, [task.id, sectionTitle]);

  return (
    <div className={`task-row task-row--${task.status}`} onClick={handleToggle} title={`Click to set next status (currently: ${statusLabel(task.status)})`}>
      <span className="task-status-icon" aria-label={statusLabel(task.status)}>
        {statusIcon(task.status)}
      </span>
      <span className="task-text">{task.text}</span>
      {task.priority && (
        <span className={`task-priority task-priority--${task.priority}`}>{task.priority}</span>
      )}
      <button
        className="task-delete-btn"
        onClick={handleDelete}
        title="Delete task"
        aria-label="Delete task"
      >
        ×
      </button>
    </div>
  );
}

// ─── Add Task Form ────────────────────────────────────────────────────────────

interface AddTaskFormProps {
  sectionTitle: string;
}

function AddTaskForm({ sectionTitle }: AddTaskFormProps) {
  const [text, setText] = useState('');
  const [visible, setVisible] = useState(false);

  const handleAdd = useCallback(() => {
    if (!text.trim()) return;
    postMessage({ type: 'ADD_TASK', sectionTitle, text: text.trim() });
    setText('');
    setVisible(false);
  }, [text, sectionTitle]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleAdd();
    if (e.key === 'Escape') { setVisible(false); setText(''); }
  }, [handleAdd]);

  if (!visible) {
    return (
      <button className="add-task-btn" onClick={() => setVisible(true)}>
        + Add task
      </button>
    );
  }

  return (
    <div className="add-task-form">
      <input
        autoFocus
        className="add-task-input"
        placeholder="Task description..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      <button className="add-task-confirm-btn" onClick={handleAdd} disabled={!text.trim()}>
        Add
      </button>
      <button className="add-task-cancel-btn" onClick={() => { setVisible(false); setText(''); }}>
        Cancel
      </button>
    </div>
  );
}

// ─── Section ─────────────────────────────────────────────────────────────────

interface SectionProps {
  section: TaskSection;
}

function SectionPanel({ section }: SectionProps) {
  const done = section.tasks.filter((t) => t.status === 'done').length;
  const total = section.tasks.length;

  return (
    <div className="tasks-section">
      <div className="tasks-section-header">
        <h2 className="tasks-section-title">{section.title}</h2>
        {total > 0 && (
          <span className="tasks-section-progress">
            {done}/{total}
            <span className="tasks-section-bar">
              <span
                className="tasks-section-bar-fill"
                style={{ width: `${(done / total) * 100}%` }}
              />
            </span>
          </span>
        )}
      </div>
      <div className="tasks-list">
        {section.tasks.length === 0 && (
          <div className="tasks-empty">No tasks yet.</div>
        )}
        {section.tasks.map((task) => (
          <TaskRow key={task.id} task={task} sectionTitle={section.title} />
        ))}
      </div>
      <AddTaskForm sectionTitle={section.title} />
    </div>
  );
}

// ─── Filter Bar ───────────────────────────────────────────────────────────────

type Filter = 'all' | TaskStatus;

interface FilterBarProps {
  current: Filter;
  onChange: (filter: Filter) => void;
}

function FilterBar({ current, onChange }: FilterBarProps) {
  const filters: { value: Filter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'todo', label: 'To Do' },
    { value: 'in-progress', label: 'In Progress' },
    { value: 'done', label: 'Done' },
  ];
  return (
    <div className="filter-bar" role="group" aria-label="Filter tasks by status">
      {filters.map((f) => (
        <button
          key={f.value}
          className={`filter-btn${current === f.value ? ' filter-btn--active' : ''}`}
          onClick={() => onChange(f.value)}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}

// ─── App Root ─────────────────────────────────────────────────────────────────

interface TasksAppProps {
  doc: TasksDocument;
}

export function TasksApp({ doc }: TasksAppProps) {
  const [filter, setFilter] = useState<Filter>('all');

  const filteredSections = doc.sections.map((section) => ({
    ...section,
    tasks: filter === 'all' ? section.tasks : section.tasks.filter((t) => t.status === filter),
  }));

  const totalDone = doc.sections.flatMap((s) => s.tasks).filter((t) => t.status === 'done').length;
  const totalTasks = doc.sections.flatMap((s) => s.tasks).length;

  return (
    <div className="tasks-app">
      <header className="tasks-header">
        <h1 className="tasks-title">{doc.title}</h1>
        {doc.description && <p className="tasks-description">{doc.description}</p>}
        {doc.meta.resources && doc.meta.resources.length > 0 && (
          <div className="tasks-resources">
            <span className="tasks-resources-label">Resources:</span>
            {doc.meta.resources.map((r) => (
              <span key={r} className="tasks-resource">{r}</span>
            ))}
          </div>
        )}
        {totalTasks > 0 && (
          <div className="tasks-overall-progress">
            <span className="tasks-progress-text">
              {totalDone} / {totalTasks} done
            </span>
            <div className="tasks-overall-bar">
              <div
                className="tasks-overall-bar-fill"
                style={{ width: `${(totalDone / totalTasks) * 100}%` }}
              />
            </div>
          </div>
        )}
      </header>

      <FilterBar current={filter} onChange={setFilter} />

      <main className="tasks-content">
        {filteredSections.length === 0 && (
          <div className="tasks-empty tasks-empty--full">No tasks yet. Open the .tasks.md file to add sections.</div>
        )}
        {filteredSections.map((section) => (
          <SectionPanel key={section.title} section={section} />
        ))}
      </main>

      <footer className="tasks-footer">
        Last updated: {doc.meta.lastUpdated}
      </footer>
    </div>
  );
}
