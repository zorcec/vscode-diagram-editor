import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('vscode', () => import('./__mocks__/vscode'));

import { DiagramEditorProvider } from './DiagramEditorProvider';
import type { DiagramService } from './DiagramService';
import type { DiagramDocument } from './types/DiagramDocument';
import * as vscode from 'vscode';

function makeValidDoc(): DiagramDocument {
  return {
    meta: {
      version: '1.0',
      title: 'Test',
      created: '2025-01-01T00:00:00Z',
      modified: '2025-01-01T00:00:00Z',
    },
    nodes: [
      {
        id: 'n1',
        label: 'Node A',
        shape: 'rectangle',
        color: 'default',
        x: 0,
        y: 0,
        width: 160,
        height: 48,
        pinned: false,
      },
    ],
    edges: [],
    groups: [],
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}

function makeMockDiagramService(): DiagramService {
  return {
    setActiveDocument: vi.fn(),
    getActiveDocument: vi.fn().mockReturnValue(null),
    parseDocument: vi.fn().mockReturnValue(makeValidDoc()),
    applySemanticOps: vi.fn().mockResolvedValue({ success: true }),
    autoLayoutAll: vi.fn().mockResolvedValue(undefined),
    emptyDocument: vi.fn(),
  } as unknown as DiagramService;
}

function makeMockContext(): vscode.ExtensionContext {
  return {
    subscriptions: [],
    extensionUri: vscode.Uri.file('/ext'),
  } as unknown as vscode.ExtensionContext;
}

function makeMockWebviewPanel(): vscode.WebviewPanel & {
  _messageHandler: ((msg: any) => void) | null;
  _disposeHandler: (() => void) | null;
} {
  let messageHandler: ((msg: any) => void) | null = null;
  let disposeHandler: (() => void) | null = null;

  return {
    _messageHandler: null,
    _disposeHandler: null,
    webview: {
      options: {},
      html: '',
      cspSource: 'test',
      asWebviewUri: (uri: any) => uri,
      onDidReceiveMessage: vi.fn((handler: any) => {
        messageHandler = handler;
        return { dispose: vi.fn() };
      }),
      postMessage: vi.fn().mockResolvedValue(true),
    },
    onDidDispose: vi.fn((handler: any) => {
      disposeHandler = handler;
      return { dispose: vi.fn() };
    }),
    get _messageHandlerRef() {
      return messageHandler;
    },
    get _disposeHandlerRef() {
      return disposeHandler;
    },
  } as any;
}

describe('DiagramEditorProvider', () => {
  let service: DiagramService;
  let context: vscode.ExtensionContext;

  beforeEach(() => {
    vi.clearAllMocks();
    service = makeMockDiagramService();
    context = makeMockContext();
  });

  describe('register', () => {
    it('registers a custom editor provider', () => {
      DiagramEditorProvider.register(context, service as any);

      expect(vscode.window.registerCustomEditorProvider).toHaveBeenCalledTimes(
        1,
      );
      expect(vscode.window.registerCustomEditorProvider).toHaveBeenCalledWith(
        'diagramflow.editor',
        expect.any(Object),
        expect.objectContaining({
          webviewOptions: { retainContextWhenHidden: true },
          supportsMultipleEditorsPerDocument: false,
        }),
      );
    });
  });

  describe('resolveCustomTextEditor', () => {
    it('sets active document on resolve', async () => {
      DiagramEditorProvider.register(context, service as any);

      const provider = vi.mocked(vscode.window.registerCustomEditorProvider)
        .mock.calls[0][1] as any;

      const textDoc = {
        getText: () => JSON.stringify(makeValidDoc()),
        uri: vscode.Uri.file('/test.diagram'),
        lineCount: 1,
      } as unknown as vscode.TextDocument;
      const panel = makeMockWebviewPanel();
      const token = {
        isCancellationRequested: false,
        onCancellationRequested: vi.fn(),
      } as unknown as vscode.CancellationToken;

      await provider.resolveCustomTextEditor(textDoc, panel, token);

      expect(service.setActiveDocument).toHaveBeenCalledWith(textDoc);
    });

    it('sets webview options with scripts enabled', async () => {
      DiagramEditorProvider.register(context, service as any);

      const provider = vi.mocked(vscode.window.registerCustomEditorProvider)
        .mock.calls[0][1] as any;

      const textDoc = {
        getText: () => JSON.stringify(makeValidDoc()),
        uri: vscode.Uri.file('/test.diagram'),
        lineCount: 1,
      } as unknown as vscode.TextDocument;
      const panel = makeMockWebviewPanel();
      const token = {
        isCancellationRequested: false,
        onCancellationRequested: vi.fn(),
      } as unknown as vscode.CancellationToken;

      await provider.resolveCustomTextEditor(textDoc, panel, token);

      expect(panel.webview.options.enableScripts).toBe(true);
    });

    it('sets up message handler on webview', async () => {
      DiagramEditorProvider.register(context, service as any);

      const provider = vi.mocked(vscode.window.registerCustomEditorProvider)
        .mock.calls[0][1] as any;

      const textDoc = {
        getText: () => JSON.stringify(makeValidDoc()),
        uri: vscode.Uri.file('/test.diagram'),
        lineCount: 1,
      } as unknown as vscode.TextDocument;
      const panel = makeMockWebviewPanel();
      const token = {
        isCancellationRequested: false,
        onCancellationRequested: vi.fn(),
      } as unknown as vscode.CancellationToken;

      await provider.resolveCustomTextEditor(textDoc, panel, token);

      expect(panel.webview.onDidReceiveMessage).toHaveBeenCalledTimes(1);
    });

    it('handles NODE_DRAGGED message', async () => {
      DiagramEditorProvider.register(context, service as any);
      const provider = vi.mocked(vscode.window.registerCustomEditorProvider)
        .mock.calls[0][1] as any;

      const textDoc = {
        getText: () => JSON.stringify(makeValidDoc()),
        uri: vscode.Uri.file('/test.diagram'),
        lineCount: 1,
      } as unknown as vscode.TextDocument;
      const panel = makeMockWebviewPanel();
      const token = {
        isCancellationRequested: false,
        onCancellationRequested: vi.fn(),
      } as unknown as vscode.CancellationToken;

      await provider.resolveCustomTextEditor(textDoc, panel, token);

      const handler = vi.mocked(panel.webview.onDidReceiveMessage).mock
        .calls[0][0] as (msg: any) => void;

      await handler({
        type: 'NODE_DRAGGED',
        id: 'n1',
        position: { x: 50.7, y: 100.3 },
      });

      expect(service.applySemanticOps).toHaveBeenCalledWith(
        [
          {
            op: 'update_node',
            id: 'n1',
            changes: { x: 51, y: 100, pinned: true },
          },
        ],
        textDoc,
      );
    });

    it('handles NODE_RESIZED message', async () => {
      DiagramEditorProvider.register(context, service as any);
      const provider = vi.mocked(vscode.window.registerCustomEditorProvider)
        .mock.calls[0][1] as any;

      const textDoc = {
        getText: () => JSON.stringify(makeValidDoc()),
        uri: vscode.Uri.file('/test.diagram'),
        lineCount: 1,
      } as unknown as vscode.TextDocument;
      const panel = makeMockWebviewPanel();
      const token = {
        isCancellationRequested: false,
        onCancellationRequested: vi.fn(),
      } as unknown as vscode.CancellationToken;

      await provider.resolveCustomTextEditor(textDoc, panel, token);

      const handler = vi.mocked(panel.webview.onDidReceiveMessage).mock
        .calls[0][0] as (msg: any) => void;

      await handler({
        type: 'NODE_RESIZED',
        id: 'n1',
        dimensions: { width: 200.5, height: 80.9 },
      });

      expect(service.applySemanticOps).toHaveBeenCalledWith(
        [
          {
            op: 'update_node',
            id: 'n1',
            changes: { width: 201, height: 81 },
          },
        ],
        textDoc,
      );
    });

    it('handles DELETE_NODES message', async () => {
      DiagramEditorProvider.register(context, service as any);
      const provider = vi.mocked(vscode.window.registerCustomEditorProvider)
        .mock.calls[0][1] as any;

      const textDoc = {
        getText: () => JSON.stringify(makeValidDoc()),
        uri: vscode.Uri.file('/test.diagram'),
        lineCount: 1,
      } as unknown as vscode.TextDocument;
      const panel = makeMockWebviewPanel();
      const token = {
        isCancellationRequested: false,
        onCancellationRequested: vi.fn(),
      } as unknown as vscode.CancellationToken;

      await provider.resolveCustomTextEditor(textDoc, panel, token);

      const handler = vi.mocked(panel.webview.onDidReceiveMessage).mock
        .calls[0][0] as (msg: any) => void;

      await handler({ type: 'DELETE_NODES', nodeIds: ['n1', 'n2'] });

      expect(service.applySemanticOps).toHaveBeenCalledWith(
        [
          { op: 'remove_node', id: 'n1' },
          { op: 'remove_node', id: 'n2' },
        ],
        textDoc,
      );
    });

    it('handles ADD_EDGE message', async () => {
      DiagramEditorProvider.register(context, service as any);
      const provider = vi.mocked(vscode.window.registerCustomEditorProvider)
        .mock.calls[0][1] as any;

      const textDoc = {
        getText: () => JSON.stringify(makeValidDoc()),
        uri: vscode.Uri.file('/test.diagram'),
        lineCount: 1,
      } as unknown as vscode.TextDocument;
      const panel = makeMockWebviewPanel();
      const token = {
        isCancellationRequested: false,
        onCancellationRequested: vi.fn(),
      } as unknown as vscode.CancellationToken;

      await provider.resolveCustomTextEditor(textDoc, panel, token);

      const handler = vi.mocked(panel.webview.onDidReceiveMessage).mock
        .calls[0][0] as (msg: any) => void;

      await handler({
        type: 'ADD_EDGE',
        edge: { source: 'n1', target: 'n2', label: 'test' },
      });

      expect(service.applySemanticOps).toHaveBeenCalledWith(
        [
          {
            op: 'add_edge',
            edge: { source: 'n1', target: 'n2', label: 'test' },
          },
        ],
        textDoc,
      );
    });

    it('handles REQUEST_LAYOUT message', async () => {
      DiagramEditorProvider.register(context, service as any);
      const provider = vi.mocked(vscode.window.registerCustomEditorProvider)
        .mock.calls[0][1] as any;

      const textDoc = {
        getText: () => JSON.stringify(makeValidDoc()),
        uri: vscode.Uri.file('/test.diagram'),
        lineCount: 1,
      } as unknown as vscode.TextDocument;
      const panel = makeMockWebviewPanel();
      const token = {
        isCancellationRequested: false,
        onCancellationRequested: vi.fn(),
      } as unknown as vscode.CancellationToken;

      await provider.resolveCustomTextEditor(textDoc, panel, token);

      const handler = vi.mocked(panel.webview.onDidReceiveMessage).mock
        .calls[0][0] as (msg: any) => void;

      await handler({ type: 'REQUEST_LAYOUT' });

      expect(service.autoLayoutAll).toHaveBeenCalledWith(textDoc);
    });

    it('handles UPDATE_NODE_PROPS message', async () => {
      DiagramEditorProvider.register(context, service as any);
      const provider = vi.mocked(vscode.window.registerCustomEditorProvider)
        .mock.calls[0][1] as any;

      const textDoc = {
        getText: () => JSON.stringify(makeValidDoc()),
        uri: vscode.Uri.file('/test.diagram'),
        lineCount: 1,
      } as unknown as vscode.TextDocument;
      const panel = makeMockWebviewPanel();
      const token = {
        isCancellationRequested: false,
        onCancellationRequested: vi.fn(),
      } as unknown as vscode.CancellationToken;

      await provider.resolveCustomTextEditor(textDoc, panel, token);

      const handler = vi.mocked(panel.webview.onDidReceiveMessage).mock
        .calls[0][0] as (msg: any) => void;

      await handler({
        type: 'UPDATE_NODE_PROPS',
        id: 'n1',
        changes: { shape: 'diamond', color: 'blue', notes: 'API boundary' },
      });

      expect(service.applySemanticOps).toHaveBeenCalledWith(
        [
          {
            op: 'update_node',
            id: 'n1',
            changes: { shape: 'diamond', color: 'blue', notes: 'API boundary' },
          },
        ],
        textDoc,
      );
    });

    it('handles UPDATE_EDGE_PROPS message', async () => {
      DiagramEditorProvider.register(context, service as any);
      const provider = vi.mocked(vscode.window.registerCustomEditorProvider)
        .mock.calls[0][1] as any;

      const textDoc = {
        getText: () => JSON.stringify(makeValidDoc()),
        uri: vscode.Uri.file('/test.diagram'),
        lineCount: 1,
      } as unknown as vscode.TextDocument;
      const panel = makeMockWebviewPanel();
      const token = {
        isCancellationRequested: false,
        onCancellationRequested: vi.fn(),
      } as unknown as vscode.CancellationToken;

      await provider.resolveCustomTextEditor(textDoc, panel, token);

      const handler = vi.mocked(panel.webview.onDidReceiveMessage).mock
        .calls[0][0] as (msg: any) => void;

      await handler({
        type: 'UPDATE_EDGE_PROPS',
        id: 'e1',
        changes: { style: 'dashed', arrow: 'open', animated: true },
      });

      expect(service.applySemanticOps).toHaveBeenCalledWith(
        [
          {
            op: 'update_edge',
            id: 'e1',
            changes: { style: 'dashed', arrow: 'open', animated: true },
          },
        ],
        textDoc,
      );
    });

    it('clears active document on dispose', async () => {
      DiagramEditorProvider.register(context, service as any);
      const provider = vi.mocked(vscode.window.registerCustomEditorProvider)
        .mock.calls[0][1] as any;

      const textDoc = {
        getText: () => JSON.stringify(makeValidDoc()),
        uri: vscode.Uri.file('/test.diagram'),
        lineCount: 1,
      } as unknown as vscode.TextDocument;

      vi.mocked(service.getActiveDocument).mockReturnValue(
        textDoc as unknown as any,
      );

      const panel = makeMockWebviewPanel();
      const token = {
        isCancellationRequested: false,
        onCancellationRequested: vi.fn(),
      } as unknown as vscode.CancellationToken;

      await provider.resolveCustomTextEditor(textDoc, panel, token);

      const disposeHandler = vi.mocked(panel.onDidDispose).mock
        .calls[0][0] as () => void;

      disposeHandler();

      expect(service.setActiveDocument).toHaveBeenCalledWith(null);
    });
  });
});
