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
    show: vi.fn(),
    dispose: vi.fn(),
  };

  return {
    window: {
      showInformationMessage: vi.fn(),
      showWarningMessage: vi.fn(),
      createStatusBarItem: vi.fn(() => mockStatusBarItem),
    },
    commands: {
      registerCommand: vi.fn((id: string, callback: Function) => {
        return { dispose: vi.fn(), id, callback };
      }),
    },
    StatusBarAlignment: {
      Left: 1,
      Right: 2,
    },
    workspace: {
      workspaceFolders: undefined as any,
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

  it('should register arm and disarm commands', async () => {
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

  it('should show activation message', async () => {
    const vscode = await import('vscode');
    const { activate } = await import('./extension');
    const context = {
      subscriptions: [] as any[],
    } as any;

    activate(context);

    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
      'AgentWatch Extension Activated!'
    );
  });
});
