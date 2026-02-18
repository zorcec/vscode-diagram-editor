/**
 * AgentWatch Extension - Unit Tests
 *
 * Unit tests for the extension activation and commands.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('vscode', () => {
  const mockStatusBarItem = {
    text: '',
    tooltip: '',
    command: '',
    backgroundColor: undefined,
    show: vi.fn(),
    dispose: vi.fn(),
  };

  const mockDiagnosticCollection = {
    set: vi.fn(),
    clear: vi.fn(),
    dispose: vi.fn(),
  };

  const mockDecorationType = {
    dispose: vi.fn(),
  };

  return {
    window: {
      showInformationMessage: vi.fn(),
      showWarningMessage: vi.fn(),
      showErrorMessage: vi.fn(),
      createStatusBarItem: vi.fn(() => mockStatusBarItem),
      createOutputChannel: vi.fn(() => ({
        appendLine: vi.fn(),
        dispose: vi.fn(),
      })),
      createTextEditorDecorationType: vi.fn(() => mockDecorationType),
      createWebviewPanel: vi.fn(() => ({
        webview: { html: '' },
        dispose: vi.fn(),
      })),
      showTextDocument: vi.fn().mockResolvedValue(undefined),
      onDidChangeActiveTextEditor: vi.fn(() => ({ dispose: vi.fn() })),
      onDidWriteTerminalData: vi.fn(() => ({ dispose: vi.fn() })),
      onDidStartTerminalShellExecution: vi.fn(() => ({ dispose: vi.fn() })),
      onDidEndTerminalShellExecution: vi.fn(() => ({ dispose: vi.fn() })),
      visibleTextEditors: [],
    },
    commands: {
      registerCommand: vi.fn((_id: string, _callback: Function) => {
        return { dispose: vi.fn() };
      }),
    },
    languages: {
      createDiagnosticCollection: vi.fn(() => mockDiagnosticCollection),
      registerCodeLensProvider: vi.fn(() => ({ dispose: vi.fn() })),
      registerHoverProvider: vi.fn(() => ({ dispose: vi.fn() })),
    },
    workspace: {
      workspaceFolders: undefined as any,
      onDidSaveTextDocument: vi.fn(() => ({ dispose: vi.fn() })),
      asRelativePath: vi.fn((uri: any) => uri?.fsPath ?? uri),
      fs: {
        readFile: vi.fn().mockRejectedValue(new Error('not found')),
        writeFile: vi.fn().mockResolvedValue(undefined),
      },
      openTextDocument: vi.fn().mockResolvedValue({ uri: { fsPath: '/workspace/test.md' } }),
    },
    StatusBarAlignment: {
      Left: 1,
      Right: 2,
    },
    DiagnosticSeverity: {
      Error: 0,
      Warning: 1,
      Information: 2,
      Hint: 3,
    },
    OverviewRulerLane: {
      Left: 1,
      Center: 2,
      Right: 4,
    },
    ThemeColor: vi.fn((id: string) => ({ id })),
    Range: vi.fn((sl: number, sc: number, el: number, ec: number) => ({
      start: { line: sl, character: sc },
      end: { line: el, character: ec },
    })),
    Position: vi.fn((l: number, c: number) => ({ line: l, character: c })),
    Diagnostic: vi.fn().mockImplementation(function (this: any, range: any, message: string, severity: number) {
      this.range = range;
      this.message = message;
      this.severity = severity;
      this.source = '';
    }),
    MarkdownString: vi.fn().mockImplementation(function (this: any) {
      this.value = '';
      this.isTrusted = false;
      this.appendMarkdown = function (text: string) { this.value += text; };
    }),
    CodeLens: vi.fn((range: any, command: any) => ({ range, command })),
    Hover: vi.fn((contents: any) => ({ contents })),
    Uri: {
      joinPath: vi.fn((_base: any, path: string) => ({ fsPath: `/workspace/${path}` })),
    },
    CancellationTokenSource: vi.fn(() => ({
      token: { isCancellationRequested: false },
      cancel: vi.fn(),
      dispose: vi.fn(),
    })),
    ViewColumn: { Beside: 2 },
    LanguageModelChatMessage: {
      User: vi.fn((text: string) => ({ role: 'user', content: text })),
    },
    lm: {
      selectChatModels: vi.fn(async () => []),
    },
  };
});

describe('AgentWatch Extension', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('should activate without errors', async () => {
    const { activate } = await import('./extension');
    const context = {
      subscriptions: [] as any[],
    } as any;

    expect(() => activate(context)).not.toThrow();
  });

  it('should register all commands', async () => {
    const vscode = await import('vscode');
    const { activate } = await import('./extension');
    const context = {
      subscriptions: [] as any[],
    } as any;

    activate(context);

    const registeredCommands = (vscode.commands.registerCommand as any).mock.calls.map(
      (call: any[]) => call[0]
    );
    expect(registeredCommands).toContain('agentWatch.arm');
    expect(registeredCommands).toContain('agentWatch.disarm');
    expect(registeredCommands).toContain('agentWatch.clearReview');
    expect(registeredCommands).toContain('agentWatch.triggerFinalSweep');
    expect(registeredCommands).toContain('agentWatch.showIssueDetail');
    expect(registeredCommands).toContain('agentWatch.editInstructions');
  });

  it('should create a status bar item on activation', async () => {
    const vscode = await import('vscode');
    const { activate } = await import('./extension');
    const context = {
      subscriptions: [] as any[],
    } as any;

    activate(context);

    expect(vscode.window.createStatusBarItem).toHaveBeenCalled();
  });

  it('should create an output channel on activation', async () => {
    const vscode = await import('vscode');
    const { activate } = await import('./extension');
    const context = {
      subscriptions: [] as any[],
    } as any;

    activate(context);

    expect(vscode.window.createOutputChannel).toHaveBeenCalledWith('AgentWatch');
  });
});
