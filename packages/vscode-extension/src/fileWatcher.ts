/**
 * Module: fileWatcher.ts
 *
 * Description:
 *   Watches for file save events in the workspace. When a file is saved,
 *   checks if it has been modified since the baseline (via git), debounces
 *   rapid saves (800ms), and triggers a background review for changed files.
 *   Also implements heuristic arming: if 3+ files are saved within 10 seconds,
 *   automatically arms AgentWatch.
 *
 * Usage:
 *   import { startWatching, stopWatching, configure } from './fileWatcher';
 *   startWatching(onFileReady);
 */

import * as vscode from 'vscode';
import { isFileModified } from './gitService';
import { shouldReviewFile } from './utils';

/** Debounce timers per file URI */
const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

/** Recent save timestamps for heuristic arming */
const recentSaves: number[] = [];

/** Debounce delay in milliseconds */
let debounceMs = 800;

/** Heuristic arming config */
let heuristicThreshold = 3;
let heuristicWindowMs = 10_000;

/** Callbacks */
let onFileReadyCallback: ((filePath: string) => void) | undefined;
let onHeuristicArmCallback: (() => void) | undefined;

/** VS Code disposable for the file save listener */
let saveDisposable: vscode.Disposable | undefined;

/**
 * Configures the file watcher parameters.
 *
 * @param config - Configuration options
 */
export function configure(config: {
  debounceMs?: number;
  heuristicThreshold?: number;
  heuristicWindowMs?: number;
}): void {
  if (config.debounceMs !== undefined) debounceMs = config.debounceMs;
  if (config.heuristicThreshold !== undefined) heuristicThreshold = config.heuristicThreshold;
  if (config.heuristicWindowMs !== undefined) heuristicWindowMs = config.heuristicWindowMs;
}

/**
 * Starts watching for file save events.
 * Calls onFileReady with the relative file path when a modified file is saved
 * (after debounce). Calls onHeuristicArm when rapid multi-file saves are detected.
 *
 * @param onFileReady - Called when a file is ready for review
 * @param onHeuristicArm - Called when heuristic detects agent activity
 * @returns Disposable to stop watching
 */
export function startWatching(
  onFileReady: (filePath: string) => void,
  onHeuristicArm?: () => void,
): vscode.Disposable {
  onFileReadyCallback = onFileReady;
  onHeuristicArmCallback = onHeuristicArm;

  saveDisposable = vscode.workspace.onDidSaveTextDocument(handleSave);
  return saveDisposable;
}

/**
 * Stops watching for file save events and clears all timers.
 */
export function stopWatching(): void {
  saveDisposable?.dispose();
  saveDisposable = undefined;
  clearAllTimers();
  onFileReadyCallback = undefined;
  onHeuristicArmCallback = undefined;
}

/**
 * Handles a file save event.
 * Checks if the file should be reviewed, debounces rapid saves,
 * and tracks save frequency for heuristic arming.
 */
async function handleSave(document: vscode.TextDocument): Promise<void> {
  const filePath = vscode.workspace.asRelativePath(document.uri);

  if (!shouldReviewFile(filePath)) {
    return;
  }

  trackSaveForHeuristic();

  const existingTimer = debounceTimers.get(filePath);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  const timer = setTimeout(async () => {
    debounceTimers.delete(filePath);
    try {
      const modified = await isFileModified(filePath);
      if (modified && onFileReadyCallback) {
        onFileReadyCallback(filePath);
      }
    } catch {
      // Silently ignore git check failures for individual files
    }
  }, debounceMs);

  debounceTimers.set(filePath, timer);
}

/**
 * Tracks file save timestamps for heuristic arming detection.
 * If 3+ different files are saved within 10 seconds, triggers heuristic arm.
 */
function trackSaveForHeuristic(): void {
  const now = Date.now();
  recentSaves.push(now);

  // Remove saves outside the window
  const cutoff = now - heuristicWindowMs;
  while (recentSaves.length > 0 && recentSaves[0] < cutoff) {
    recentSaves.shift();
  }

  if (recentSaves.length >= heuristicThreshold && onHeuristicArmCallback) {
    onHeuristicArmCallback();
    recentSaves.length = 0;
  }
}

/**
 * Clears all pending debounce timers.
 */
function clearAllTimers(): void {
  for (const timer of debounceTimers.values()) {
    clearTimeout(timer);
  }
  debounceTimers.clear();
}

/**
 * Resets module state. Used for testing.
 */
export function resetState(): void {
  stopWatching();
  recentSaves.length = 0;
  debounceMs = 800;
  heuristicThreshold = 3;
  heuristicWindowMs = 10_000;
}
