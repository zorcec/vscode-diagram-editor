/**
 * Data types for the .tasks.md file format.
 *
 * A .tasks.md file combines:
 *  - YAML front matter for document metadata
 *  - Markdown task lists with HTML comment annotations
 *  - Standard GFM checkbox syntax (- [ ] / - [x])
 *
 * This makes the file fully human-readable as plain Markdown while allowing
 * tools to extract and update structured task data without losing formatting.
 */

export type TaskStatus = 'todo' | 'in-progress' | 'done';

export type TaskPriority = 'low' | 'medium' | 'high';

export interface TaskLink {
  url: string;
  label?: string;
}

/** A single task item. */
export interface Task {
  /** Unique stable identifier (e.g. "task-001"). Auto-generated if missing. */
  id: string;
  /** The task description text (without leading checkbox). */
  text: string;
  /** Current status of the task. */
  status: TaskStatus;
  /** Optional priority hint for sorting/filtering. */
  priority?: TaskPriority;
  /** ISO-8601 timestamp when the task was marked done. */
  completedAt?: string;
  /** Additional free-text notes or context. */
  notes?: string;
  /** Related external URLs or file links. */
  links?: TaskLink[];
}

/** A named group of tasks under an H2 heading. */
export interface TaskSection {
  title: string;
  tasks: Task[];
}

/** Document-level metadata stored in YAML front matter. */
export interface TasksMeta {
  lastUpdated: string;
  /** Paths to architecture diagrams or docs the agent should read before starting. */
  resources?: string[];
}

/** The full parsed representation of a .tasks.md file. */
export interface TasksDocument {
  meta: TasksMeta;
  /** Document title from the first H1 heading. */
  title: string;
  /** Optional description text below the title and above the first section. */
  description?: string;
  sections: TaskSection[];
}
