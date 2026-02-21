import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('vscode', () => import('./__mocks__/vscode'));
vi.mock('./DiagramEditorProvider', () => ({
  DiagramEditorProvider: {
    register: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  },
}));
vi.mock('./DiagramService', () => ({
  DiagramService: vi.fn().mockImplementation(() => ({
    setActiveDocument: vi.fn(),
    getActiveDocument: vi.fn(),
    parseDocument: vi.fn(),
    applySemanticOps: vi.fn(),
    autoLayoutAll: vi.fn(),
    emptyDocument: vi.fn().mockReturnValue({
      meta: {
        version: '1.0',
        title: 'Untitled Diagram',
        created: '2025-01-01T00:00:00Z',
        modified: '2025-01-01T00:00:00Z',
      },
      nodes: [],
      edges: [],
      groups: [],
      viewport: { x: 0, y: 0, zoom: 1 },
    }),
  })),
}));
vi.mock('./tools', () => ({
  registerDiagramTools: vi.fn(),
}));

import { activate, deactivate } from './extension';
import { DiagramEditorProvider } from './DiagramEditorProvider';
import { registerDiagramTools } from './tools';
import * as vscode from 'vscode';

describe('extension', () => {
  let context: vscode.ExtensionContext;

  beforeEach(() => {
    vi.clearAllMocks();
    context = {
      subscriptions: [],
      extensionUri: vscode.Uri.file('/ext'),
    } as unknown as vscode.ExtensionContext;
  });

  describe('activate', () => {
    it('registers the editor provider', () => {
      activate(context);
      expect(DiagramEditorProvider.register).toHaveBeenCalledTimes(1);
    });

    it('registers diagram tools', () => {
      activate(context);
      expect(registerDiagramTools).toHaveBeenCalledTimes(1);
    });

    it('registers 5 commands', () => {
      activate(context);
      expect(vscode.commands.registerCommand).toHaveBeenCalledTimes(5);

      const commandNames = vi
        .mocked(vscode.commands.registerCommand)
        .mock.calls.map((c) => c[0]);
      expect(commandNames).toContain('diagramflow.newDiagram');
      expect(commandNames).toContain('diagramflow.exportSVG');
      expect(commandNames).toContain('diagramflow.exportMermaid');
      expect(commandNames).toContain('diagramflow.autoLayout');
      expect(commandNames).toContain('diagramflow.importSVG');
    });

    it('pushes subscriptions to context', () => {
      activate(context);
      expect(context.subscriptions.length).toBeGreaterThan(0);
    });
  });

  describe('deactivate', () => {
    it('is a no-op function', () => {
      expect(() => deactivate()).not.toThrow();
    });
  });
});
