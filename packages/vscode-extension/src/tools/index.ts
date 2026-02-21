import * as vscode from 'vscode';
import type { DiagramService } from '../DiagramService';
import { GetDiagramTool } from './GetDiagramTool';
import { AddNodesTool } from './AddNodesTool';
import { RemoveNodesTool } from './RemoveNodesTool';
import { UpdateNodesTool } from './UpdateNodesTool';
import { AddEdgesTool } from './AddEdgesTool';
import { RemoveEdgesTool } from './RemoveEdgesTool';
import { UpdateEdgesTool } from './UpdateEdgesTool';
import { AddGroupsTool } from './AddGroupsTool';
import { RemoveGroupsTool } from './RemoveGroupsTool';
import { UpdateGroupsTool } from './UpdateGroupsTool';

export function registerDiagramTools(
  context: vscode.ExtensionContext,
  diagramService: DiagramService,
): void {
  const tools: [string, vscode.LanguageModelTool<any>][] = [
    ['diagramflow_getDiagram', new GetDiagramTool(diagramService)],
    ['diagramflow_addNodes', new AddNodesTool(diagramService)],
    ['diagramflow_removeNodes', new RemoveNodesTool(diagramService)],
    ['diagramflow_updateNodes', new UpdateNodesTool(diagramService)],
    ['diagramflow_addEdges', new AddEdgesTool(diagramService)],
    ['diagramflow_removeEdges', new RemoveEdgesTool(diagramService)],
    ['diagramflow_updateEdges', new UpdateEdgesTool(diagramService)],
    ['diagramflow_addGroups', new AddGroupsTool(diagramService)],
    ['diagramflow_removeGroups', new RemoveGroupsTool(diagramService)],
    ['diagramflow_updateGroups', new UpdateGroupsTool(diagramService)],
  ];

  for (const [name, tool] of tools) {
    context.subscriptions.push(vscode.lm.registerTool(name, tool));
  }
}
