/**
 * Message protocol between the tasks webview and the extension host.
 */
import type { TaskStatus, TasksDocument } from '../types/TasksDocument';

/** Messages sent from the webview to the extension host. */
export type TasksWebviewMessage =
  | { type: 'TASKS_WEBVIEW_READY' }
  | { type: 'TOGGLE_TASK_STATUS'; taskId: string; sectionTitle: string; currentStatus: TaskStatus }
  | { type: 'ADD_TASK'; sectionTitle: string; text: string }
  | { type: 'DELETE_TASK'; taskId: string; sectionTitle: string };

/** Messages sent from the extension host to the webview. */
export type TasksHostMessage =
  | { type: 'TASKS_DOCUMENT_UPDATED'; doc: TasksDocument };
