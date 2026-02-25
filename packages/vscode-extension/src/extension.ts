import * as vscode from 'vscode';
import { DiagramEditorProvider } from './DiagramEditorProvider';
import { DiagramService } from './DiagramService';
import { registerDiagramTools } from './tools';
import { TasksEditorProvider } from './TasksEditorProvider';
import { registerTasksTools } from './tools/tasks';
import { buildDocumentSvg } from './lib/exporters';

/** Returns true when a file path belongs to a diagram. */
function isDiagramFile(fileName: string): boolean {
  return fileName.endsWith('.diagram.svg');
}

/** Ensures a diagram document is set as active, falling back to any open one. */
function ensureActiveDiagram(diagramService: DiagramService): void {
  if (diagramService.getActiveDocument()) return;
  const fallback = vscode.workspace.textDocuments.find(
    (d) => isDiagramFile(d.fileName) && !d.isClosed,
  );
  if (fallback) {
    diagramService.setActiveDocument(fallback);
  }
}

export function activate(context: vscode.ExtensionContext): void {
  const diagramService = new DiagramService();

  context.subscriptions.push(
    DiagramEditorProvider.register(context, diagramService),
    TasksEditorProvider.register(context),
  );

  registerDiagramTools(context, diagramService);
  registerTasksTools(context);

  context.subscriptions.push(
    vscode.commands.registerCommand('diagramflow.newDiagram', async () => {
      const uri = await promptForNewDiagramLocation();
      if (uri) {
        await createEmptyDiagramFile(uri, diagramService);
        await vscode.commands.executeCommand('vscode.openWith', uri, DiagramEditorProvider.viewType);
      }
    }),
    vscode.commands.registerCommand('diagramflow.sortNodes', () => {
      ensureActiveDiagram(diagramService);
      diagramService.sortNodes();
    }),
    vscode.commands.registerCommand('diagramflow.autoLayout', () => {
      ensureActiveDiagram(diagramService);
      diagramService.autoLayoutAll();
    }),
    vscode.commands.registerCommand('diagramflow.autoLayoutForce', () => {
      diagramService.autoLayoutForce();
    }),
    vscode.commands.registerCommand('diagramflow.undo', () => {
      diagramService.undo();
    }),
    vscode.commands.registerCommand('diagramflow.redo', () => {
      diagramService.redo();
    }),
  );
}

export function deactivate(): void {}

async function promptForNewDiagramLocation(): Promise<vscode.Uri | undefined> {
  const uri = await vscode.window.showSaveDialog({
    filters: {
      'DiagramFlow (SVG with embedded data)': ['diagram.svg'],
    },
    defaultUri: vscode.workspace.workspaceFolders?.[0]?.uri
      ? vscode.Uri.joinPath(
          vscode.workspace.workspaceFolders[0].uri,
          'untitled.diagram.svg',
        )
      : undefined,
  });
  return uri;
}

async function createEmptyDiagramFile(
  uri: vscode.Uri,
  diagramService: DiagramService,
): Promise<void> {
  const doc = diagramService.emptyDocument();
  const content = buildDocumentSvg(doc);
  await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(content));
}
