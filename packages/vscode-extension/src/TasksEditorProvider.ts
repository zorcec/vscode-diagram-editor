import * as vscode from 'vscode';
import { nanoid } from 'nanoid';
import { parseTasksDocument } from './lib/tasksParser';
import { serializeTasksDocument, touchMeta } from './lib/tasksSerializer';
import { getTasksWebviewContent } from './getTasksWebviewContent';
import type { TasksWebviewMessage } from './messages/tasksProtocol';
import type { TaskStatus } from './types/TasksDocument';

export class TasksEditorProvider implements vscode.CustomTextEditorProvider {
  public static readonly viewType = 'diagramflow.tasks';

  private constructor(private readonly context: vscode.ExtensionContext) {}

  public static register(context: vscode.ExtensionContext): vscode.Disposable {
    const provider = new TasksEditorProvider(context);
    return vscode.window.registerCustomEditorProvider(
      TasksEditorProvider.viewType,
      provider,
      {
        webviewOptions: { retainContextWhenHidden: true },
        supportsMultipleEditorsPerDocument: false,
      },
    );
  }

  public async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken,
  ): Promise<void> {
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview', 'tasks'),
      ],
    };
    webviewPanel.webview.html = getTasksWebviewContent(
      webviewPanel.webview,
      this.context.extensionUri,
    );

    const sendDocument = () => {
      const doc = parseTasksDocument(document.getText());
      webviewPanel.webview.postMessage({ type: 'TASKS_DOCUMENT_UPDATED', doc });
    };

    const changeSubscription = vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.document.uri.toString() === document.uri.toString()) {
        sendDocument();
      }
    });

    webviewPanel.webview.onDidReceiveMessage(async (msg: TasksWebviewMessage) => {
      switch (msg.type) {
        case 'TASKS_WEBVIEW_READY':
          sendDocument();
          break;
        case 'TOGGLE_TASK_STATUS':
          await this.toggleTaskStatus(msg.taskId, msg.sectionTitle, msg.currentStatus, document);
          break;
        case 'ADD_TASK':
          await this.addTask(msg.sectionTitle, msg.text, document);
          break;
        case 'DELETE_TASK':
          await this.deleteTask(msg.taskId, msg.sectionTitle, document);
          break;
      }
    });

    webviewPanel.onDidDispose(() => {
      changeSubscription.dispose();
    });
  }

  private async toggleTaskStatus(
    taskId: string,
    _sectionTitle: string,
    currentStatus: TaskStatus,
    document: vscode.TextDocument,
  ): Promise<void> {
    const parsed = parseTasksDocument(document.getText());
    const next = nextStatus(currentStatus);
    let changed = false;

    const updated = {
      ...parsed,
      meta: touchMeta(parsed.meta),
      sections: parsed.sections.map((s) => ({
        ...s,
        tasks: s.tasks.map((t) => {
          if (t.id !== taskId) return t;
          changed = true;
          return {
            ...t,
            status: next,
            completedAt: next === 'done' ? new Date().toISOString() : undefined,
          };
        }),
      })),
    };

    if (!changed) return;
    await this.applyEdit(document, serializeTasksDocument(updated));
  }

  private async addTask(
    sectionTitle: string,
    text: string,
    document: vscode.TextDocument,
  ): Promise<void> {
    const parsed = parseTasksDocument(document.getText());
    let changed = false;

    const updated = {
      ...parsed,
      meta: touchMeta(parsed.meta),
      sections: parsed.sections.map((s) => {
        if (s.title !== sectionTitle) return s;
        changed = true;
        return {
          ...s,
          tasks: [
            ...s.tasks,
            { id: nanoid(8), text, status: 'todo' as TaskStatus },
          ],
        };
      }),
    };

    if (!changed) return;
    await this.applyEdit(document, serializeTasksDocument(updated));
  }

  private async deleteTask(
    taskId: string,
    _sectionTitle: string,
    document: vscode.TextDocument,
  ): Promise<void> {
    const parsed = parseTasksDocument(document.getText());
    let changed = false;

    const updated = {
      ...parsed,
      meta: touchMeta(parsed.meta),
      sections: parsed.sections.map((s) => {
        const filtered = s.tasks.filter((t) => t.id !== taskId);
        if (filtered.length !== s.tasks.length) changed = true;
        return { ...s, tasks: filtered };
      }),
    };

    if (!changed) return;
    await this.applyEdit(document, serializeTasksDocument(updated));
  }

  private async applyEdit(document: vscode.TextDocument, content: string): Promise<void> {
    const edit = new vscode.WorkspaceEdit();
    edit.replace(
      document.uri,
      new vscode.Range(0, 0, document.lineCount, 0),
      content,
    );
    await vscode.workspace.applyEdit(edit);
  }
}

function nextStatus(current: TaskStatus): TaskStatus {
  if (current === 'todo') return 'in-progress';
  if (current === 'in-progress') return 'done';
  return 'todo';
}
