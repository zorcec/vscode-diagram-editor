/**
 * Module: extension.ts
 *
 * Description:
 *   Main entry point for the AgentWatch VS Code extension.
 *   Wires together all modules: GitService, FileWatcher, ReviewEngine,
 *   SurfaceManager, StatusBar, and TerminalWatcher.
 *   Registers commands: arm, disarm, clearReview, triggerFinalSweep, showIssueDetail.
 *
 * Usage:
 *   Activated automatically by VS Code. Use commands via Cmd+Shift+P or keybindings.
 */

import * as vscode from 'vscode';
import type { ReviewIssue } from './types';
import * as gitService from './gitService';
import * as fileWatcher from './fileWatcher';
import * as reviewEngine from './reviewEngine';
import * as surfaceManager from './surfaceManager';
import * as statusBar from './statusBar';
import * as terminalWatcher from './terminalWatcher';
import { loadUserInstructions } from './instructionsLoader';

/** Output channel for logging */
let outputChannel: vscode.OutputChannel;

/** Cancellation source for ongoing review */
let reviewCancellation: vscode.CancellationTokenSource | undefined;

/**
 * Called when the extension is activated.
 * Sets up all modules, registers commands, and starts terminal watching.
 */
export function activate(context: vscode.ExtensionContext): void {
  outputChannel = vscode.window.createOutputChannel('AgentWatch');
  context.subscriptions.push(outputChannel);

  reviewEngine.configure({ outputChannel });

  context.subscriptions.push(statusBar.createStatusBar());
  context.subscriptions.push(...surfaceManager.initSurfaces());

  registerCommands(context);
  startTerminalAutoDetection(context);

  outputChannel.appendLine('AgentWatch activated.');
}

/**
 * Called when the extension is deactivated.
 * Cleans up all module state.
 */
export function deactivate(): void {
  reviewCancellation?.cancel();
  reviewCancellation?.dispose();
  fileWatcher.stopWatching();
  terminalWatcher.stopTerminalWatching();
  surfaceManager.clearAll();
}

/**
 * Registers all AgentWatch commands.
 */
function registerCommands(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('agentWatch.arm', arm),
    vscode.commands.registerCommand('agentWatch.disarm', disarm),
    vscode.commands.registerCommand('agentWatch.clearReview', clearReview),
    vscode.commands.registerCommand('agentWatch.triggerFinalSweep', triggerFinalSweep),
    vscode.commands.registerCommand('agentWatch.showIssueDetail', showIssueDetail),
    vscode.commands.registerCommand('agentWatch.editInstructions', editInstructions),
  );
}

/**
 * Arms AgentWatch: snapshots baseline, starts file watcher.
 */
async function arm(): Promise<void> {
  const rootPath = getWorkspaceRootPath();
  if (!rootPath) {
    vscode.window.showWarningMessage('AgentWatch: No workspace folder open.');
    return;
  }

  const isGit = await gitService.isGitRepository(rootPath);
  if (!isGit) {
    vscode.window.showWarningMessage('AgentWatch: Workspace is not a git repository.');
    return;
  }

  try {
    await gitService.snapshotBaseline(rootPath);
    outputChannel.appendLine(`Baseline snapshot taken at ${gitService.getBaseline()}`);
  } catch (error) {
    vscode.window.showErrorMessage(`AgentWatch: Failed to snapshot baseline — ${error}`);
    return;
  }

  surfaceManager.clearAll();
  cancelOngoingReview();

  const watchDisposable = fileWatcher.startWatching(
    handleFileReady,
    handleHeuristicArm,
  );
  // Store disposable so disarm can clean it up — using a module-level ref
  currentWatchDisposable = watchDisposable;

  statusBar.setState('watching');
  vscode.window.showInformationMessage('AgentWatch: Armed and watching!');
}

/** Disposable for the current file watcher session */
let currentWatchDisposable: vscode.Disposable | undefined;

/**
 * Disarms AgentWatch: stops file watcher, cancels reviews.
 */
function disarm(): void {
  fileWatcher.stopWatching();
  currentWatchDisposable?.dispose();
  currentWatchDisposable = undefined;
  cancelOngoingReview();
  statusBar.setState('idle');
  vscode.window.showInformationMessage('AgentWatch: Disarmed.');
}

/**
 * Clears all review results and resets to idle.
 */
function clearReview(): void {
  cancelOngoingReview();
  surfaceManager.clearAll();
  statusBar.setState('idle');
  outputChannel.appendLine('Review cleared.');
}

/**
 * Triggers a final sweep: reviews all changed files since baseline.
 */
async function triggerFinalSweep(): Promise<void> {
  if (!gitService.getBaseline()) {
    vscode.window.showWarningMessage('AgentWatch: No baseline set. Arm first.');
    return;
  }

  cancelOngoingReview();
  statusBar.setState('reviewing');

  try {
    const changedFiles = await gitService.getChangedFiles();
    if (changedFiles.length === 0) {
      statusBar.setState('clean');
      outputChannel.appendLine('Final sweep: no changed files.');
      return;
    }

    outputChannel.appendLine(`Final sweep: reviewing ${changedFiles.length} file(s)…`);

    reviewCancellation = new vscode.CancellationTokenSource();
    const allIssues = await reviewEngine.reviewFiles(
      changedFiles,
      (issues, file) => {
        surfaceManager.updateIssues(issues);
        statusBar.setIssueCount(issues.length);
        outputChannel.appendLine(`  Reviewed ${file}: ${issues.length} total issue(s) so far`);
      },
      reviewCancellation.token,
    );

    if (allIssues.length > 0) {
      statusBar.setState('issues');
      statusBar.setIssueCount(allIssues.length);
    } else {
      statusBar.setState('clean');
    }

    outputChannel.appendLine(`Final sweep complete: ${allIssues.length} issue(s) found.`);
  } catch (error) {
    outputChannel.appendLine(`Final sweep error: ${error}`);
    vscode.window.showErrorMessage(`AgentWatch: Review failed — ${error}`);
    statusBar.setState('watching');
  }
}

/**
 * Handles a file that is ready for review (after debounce + git check).
 * Triggers an individual background review for that file.
 */
async function handleFileReady(filePath: string): Promise<void> {
  outputChannel.appendLine(`File changed: ${filePath}`);
  statusBar.setState('reviewing');

  try {
    const issues = await reviewEngine.reviewFile(filePath);
    surfaceManager.addFileIssues(filePath, issues);

    const totalCount = surfaceManager.getIssueCount();
    statusBar.setIssueCount(totalCount);

    if (totalCount > 0) {
      statusBar.setState('issues');
    } else {
      statusBar.setState('watching');
    }
  } catch (error) {
    outputChannel.appendLine(`Review error for ${filePath}: ${error}`);
    statusBar.setState('watching');
  }
}

/**
 * Called when the heuristic detects agent activity (3+ files saved in 10s).
 * Auto-arms if not already armed.
 */
async function handleHeuristicArm(): Promise<void> {
  if (statusBar.getState() !== 'idle') return;
  outputChannel.appendLine('Heuristic: agent activity detected, auto-arming…');
  await arm();
}

/**
 * Shows a detail view for a specific issue (called from CodeLens click).
 */
function showIssueDetail(issue: ReviewIssue): void {
  const panel = vscode.window.createWebviewPanel(
    'agentWatchIssue',
    `AgentWatch: ${issue.title}`,
    vscode.ViewColumn.Beside,
    {},
  );

  const tierEmoji = issue.tier === 'high' ? '🔴' : issue.tier === 'medium' ? '🟡' : '🟢';

  panel.webview.html = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><style>
  body { font-family: var(--vscode-font-family); padding: 16px; color: var(--vscode-foreground); }
  h1 { font-size: 1.4em; } h2 { font-size: 1.1em; color: var(--vscode-descriptionForeground); }
  .tier { font-size: 1.2em; margin-bottom: 12px; }
  .explanation { line-height: 1.6; margin-top: 12px; }
</style></head>
<body>
  <div class="tier">${tierEmoji} ${issue.tier.toUpperCase()} RISK</div>
  <h1>${escapeHtml(issue.title)}</h1>
  <h2>${escapeHtml(issue.file)}:${issue.line}</h2>
  <div class="explanation">${escapeHtml(issue.explanation)}</div>
</body>
</html>`;
}

/**
 * Opens the agent-watch-instructions.md file for editing.
 * Creates it with a template if it doesn't exist yet.
 */
async function editInstructions(): Promise<void> {
  const rootPath = getWorkspaceRootPath();
  if (!rootPath) {
    vscode.window.showWarningMessage('AgentWatch: No workspace folder open.');
    return;
  }

  const folders = vscode.workspace.workspaceFolders;
  if (!folders) return;

  const fileUri = vscode.Uri.joinPath(folders[0].uri, 'agent-watch-instructions.md');

  const existing = await loadUserInstructions();
  if (!existing.found) {
    const template = getInstructionsTemplate();
    await vscode.workspace.fs.writeFile(fileUri, Buffer.from(template, 'utf-8'));
    outputChannel.appendLine('Created agent-watch-instructions.md with template.');
  }

  const doc = await vscode.workspace.openTextDocument(fileUri);
  await vscode.window.showTextDocument(doc);
}

/**
 * Returns the template content for a new agent-watch-instructions.md file.
 */
function getInstructionsTemplate(): string {
  return `# AgentWatch Instructions

> Define project-specific validation rules below.
> Each rule is a list item. Optionally prefix with a severity tag: [high], [medium], or [low].
> Rules without a tag default to [medium].

## Security
- [high] Always flag changes to authentication or authorization logic
- [high] Flag any hardcoded secrets, API keys, or credentials

## Data
- [high] Flag changes to database migration files or schema definitions
- [medium] Watch for changes to data validation logic

## API
- [medium] Flag changes to public API endpoints or response shapes
- [medium] Flag removed or changed error handling in API routes

## Custom Rules
- [low] Note changes to configuration files
`;
}

/**
 * Cancels any ongoing review operation.
 */
function cancelOngoingReview(): void {
  reviewCancellation?.cancel();
  reviewCancellation?.dispose();
  reviewCancellation = undefined;
}

/**
 * Returns the workspace root path, or undefined if no workspace is open.
 */
function getWorkspaceRootPath(): string | undefined {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) return undefined;
  return folders[0].uri.fsPath;
}

/**
 * Starts terminal auto-detection for agent start/end patterns.
 */
function startTerminalAutoDetection(context: vscode.ExtensionContext): void {
  const disposable = terminalWatcher.startTerminalWatching({
    onAgentStart: async () => {
      outputChannel.appendLine('Terminal: Agent start detected.');
      if (statusBar.getState() === 'idle') {
        await arm();
      }
    },
    onAgentEnd: async () => {
      outputChannel.appendLine('Terminal: Agent end detected.');
      await triggerFinalSweep();
    },
  });
  context.subscriptions.push(disposable);
}

/**
 * Escapes HTML special characters for safe rendering in webview.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
