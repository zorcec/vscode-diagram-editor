import * as vscode from 'vscode';
import { GetTasksTool } from './GetTasksTool';
import { UpdateTaskTool } from './UpdateTaskTool';
import { AddTaskTool } from './AddTaskTool';

export function registerTasksTools(context: vscode.ExtensionContext): void {
  const tools: [string, vscode.LanguageModelTool<unknown>][] = [
    ['diagramflow_getTasks', new GetTasksTool()],
    ['diagramflow_updateTask', new UpdateTaskTool()],
    ['diagramflow_addTask', new AddTaskTool()],
  ];

  for (const [name, tool] of tools) {
    context.subscriptions.push(vscode.lm.registerTool(name, tool));
  }
}
