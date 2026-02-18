/**
 * AgentWatch VS Code Extension
 *
 * Extension that runs risk-focused code review in the background
 * while AI coding agents are working.
 */

import * as vscode from 'vscode';

let isArmed = false;
let statusBarItem: vscode.StatusBarItem;

/**
 * Called when the extension is activated
 */
export function activate(context: vscode.ExtensionContext): void {
  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100
  );
  updateStatusBar();
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  const armCommand = vscode.commands.registerCommand('agentWatch.arm', () => {
    isArmed = true;
    updateStatusBar();
    vscode.window.showInformationMessage('AgentWatch: Armed and watching!');
  });

  const disarmCommand = vscode.commands.registerCommand('agentWatch.disarm', () => {
    isArmed = false;
    updateStatusBar();
    vscode.window.showInformationMessage('AgentWatch: Disarmed.');
  });

  context.subscriptions.push(armCommand, disarmCommand);

  vscode.window.showInformationMessage('AgentWatch Extension Activated!');
}

/**
 * Called when the extension is deactivated
 */
export function deactivate(): void {
  isArmed = false;
}

/**
 * Updates the status bar item text based on armed state
 */
function updateStatusBar(): void {
  if (isArmed) {
    statusBarItem.text = '$(eye) AgentWatch: Watching…';
    statusBarItem.tooltip = 'AgentWatch is armed and monitoring file changes';
    statusBarItem.command = 'agentWatch.disarm';
  } else {
    statusBarItem.text = '$(eye-closed) AgentWatch: Off';
    statusBarItem.tooltip = 'Click to arm AgentWatch';
    statusBarItem.command = 'agentWatch.arm';
  }
}

/**
 * Returns the current armed state (exported for testing)
 */
export function getArmedState(): boolean {
  return isArmed;
}
