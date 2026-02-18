/**
 * AgentWatch FileWatcher - Unit Tests
 *
 * Tests for file save debouncing, heuristic arming, and git-modified filtering.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('vscode', () => ({
  workspace: {
    onDidSaveTextDocument: vi.fn(() => ({ dispose: vi.fn() })),
    asRelativePath: vi.fn((uri: any) => uri?.fsPath ?? uri),
  },
}));

vi.mock('./gitService', () => ({
  isFileModified: vi.fn(),
}));

vi.mock('./utils', () => ({
  shouldReviewFile: vi.fn(() => true),
}));

import {
  startWatching,
  stopWatching,
  configure,
  resetState,
} from './fileWatcher';
import { isFileModified } from './gitService';
import { shouldReviewFile } from './utils';
import * as vscode from 'vscode';

describe('fileWatcher', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetState();
    vi.clearAllMocks();
    (shouldReviewFile as ReturnType<typeof vi.fn>).mockReturnValue(true);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('startWatching', () => {
    it('should register a save listener', () => {
      const disposable = startWatching(vi.fn());
      expect(vscode.workspace.onDidSaveTextDocument).toHaveBeenCalled();
      expect(disposable).toBeDefined();
      expect(disposable.dispose).toBeDefined();
    });
  });

  describe('stopWatching', () => {
    it('should not throw when called without starting', () => {
      expect(() => stopWatching()).not.toThrow();
    });
  });

  describe('configure', () => {
    it('should accept configuration options without throwing', () => {
      expect(() =>
        configure({
          debounceMs: 500,
          heuristicThreshold: 5,
          heuristicWindowMs: 20_000,
        }),
      ).not.toThrow();
    });
  });

  describe('handleSave (via onDidSaveTextDocument)', () => {
    it('should call onFileReady after debounce for modified files', async () => {
      const onFileReady = vi.fn();
      (isFileModified as ReturnType<typeof vi.fn>).mockResolvedValue(true);

      let saveHandler: (doc: any) => void = () => {};
      (vscode.workspace.onDidSaveTextDocument as ReturnType<typeof vi.fn>).mockImplementation(
        (handler: any) => {
          saveHandler = handler;
          return { dispose: vi.fn() };
        },
      );

      startWatching(onFileReady);

      saveHandler({ uri: { fsPath: 'src/auth.ts' } });

      // Before debounce (800ms default)
      expect(onFileReady).not.toHaveBeenCalled();

      // Advance past debounce
      await vi.advanceTimersByTimeAsync(900);

      expect(isFileModified).toHaveBeenCalledWith('src/auth.ts');
      expect(onFileReady).toHaveBeenCalledWith('src/auth.ts');
    });

    it('should not call onFileReady for unmodified files', async () => {
      const onFileReady = vi.fn();
      (isFileModified as ReturnType<typeof vi.fn>).mockResolvedValue(false);

      let saveHandler: (doc: any) => void = () => {};
      (vscode.workspace.onDidSaveTextDocument as ReturnType<typeof vi.fn>).mockImplementation(
        (handler: any) => {
          saveHandler = handler;
          return { dispose: vi.fn() };
        },
      );

      startWatching(onFileReady);
      saveHandler({ uri: { fsPath: 'src/clean.ts' } });

      await vi.advanceTimersByTimeAsync(900);

      expect(onFileReady).not.toHaveBeenCalled();
    });

    it('should skip files that shouldReviewFile rejects', async () => {
      (shouldReviewFile as ReturnType<typeof vi.fn>).mockReturnValue(false);
      const onFileReady = vi.fn();

      let saveHandler: (doc: any) => void = () => {};
      (vscode.workspace.onDidSaveTextDocument as ReturnType<typeof vi.fn>).mockImplementation(
        (handler: any) => {
          saveHandler = handler;
          return { dispose: vi.fn() };
        },
      );

      startWatching(onFileReady);
      saveHandler({ uri: { fsPath: 'node_modules/pkg/index.js' } });

      await vi.advanceTimersByTimeAsync(900);

      expect(isFileModified).not.toHaveBeenCalled();
      expect(onFileReady).not.toHaveBeenCalled();
    });

    it('should debounce rapid saves for the same file', async () => {
      const onFileReady = vi.fn();
      (isFileModified as ReturnType<typeof vi.fn>).mockResolvedValue(true);

      let saveHandler: (doc: any) => void = () => {};
      (vscode.workspace.onDidSaveTextDocument as ReturnType<typeof vi.fn>).mockImplementation(
        (handler: any) => {
          saveHandler = handler;
          return { dispose: vi.fn() };
        },
      );

      startWatching(onFileReady);

      // Save 3 times in quick succession
      saveHandler({ uri: { fsPath: 'src/file.ts' } });
      await vi.advanceTimersByTimeAsync(200);
      saveHandler({ uri: { fsPath: 'src/file.ts' } });
      await vi.advanceTimersByTimeAsync(200);
      saveHandler({ uri: { fsPath: 'src/file.ts' } });

      // Wait for debounce to complete
      await vi.advanceTimersByTimeAsync(900);

      // Should only fire once due to debounce
      expect(onFileReady).toHaveBeenCalledTimes(1);
    });
  });

  describe('heuristic arming', () => {
    it('should trigger heuristic arm after threshold saves in window', async () => {
      const onFileReady = vi.fn();
      const onHeuristicArm = vi.fn();
      (isFileModified as ReturnType<typeof vi.fn>).mockResolvedValue(true);

      let saveHandler: (doc: any) => void = () => {};
      (vscode.workspace.onDidSaveTextDocument as ReturnType<typeof vi.fn>).mockImplementation(
        (handler: any) => {
          saveHandler = handler;
          return { dispose: vi.fn() };
        },
      );

      startWatching(onFileReady, onHeuristicArm);

      // Default threshold is 3 saves within 10 seconds
      saveHandler({ uri: { fsPath: 'src/a.ts' } });
      saveHandler({ uri: { fsPath: 'src/b.ts' } });

      expect(onHeuristicArm).not.toHaveBeenCalled();

      saveHandler({ uri: { fsPath: 'src/c.ts' } });

      expect(onHeuristicArm).toHaveBeenCalledTimes(1);
    });

    it('should not trigger heuristic arm if saves are outside window', async () => {
      configure({ heuristicWindowMs: 1000, heuristicThreshold: 3 });

      const onFileReady = vi.fn();
      const onHeuristicArm = vi.fn();

      let saveHandler: (doc: any) => void = () => {};
      (vscode.workspace.onDidSaveTextDocument as ReturnType<typeof vi.fn>).mockImplementation(
        (handler: any) => {
          saveHandler = handler;
          return { dispose: vi.fn() };
        },
      );

      startWatching(onFileReady, onHeuristicArm);

      saveHandler({ uri: { fsPath: 'src/a.ts' } });
      saveHandler({ uri: { fsPath: 'src/b.ts' } });

      // Advance past the window
      await vi.advanceTimersByTimeAsync(1500);

      saveHandler({ uri: { fsPath: 'src/c.ts' } });

      // Should not trigger because first two saves are outside the window now
      expect(onHeuristicArm).not.toHaveBeenCalled();
    });
  });

  describe('resetState', () => {
    it('should clear all state and timers', () => {
      startWatching(vi.fn());
      expect(() => resetState()).not.toThrow();
    });
  });
});
