/**
 * E2E test: File Detection
 *
 * Verifies that .diagram files are properly detected and associated
 * with the DiagramFlow custom editor.
 */

import { expect } from '@playwright/test';
import { test } from './fixtures/vscode-suite-fixtures';

test.describe('File Detection', () => {
  test('opens .diagram file without errors', async ({ vscPage }) => {
    await vscPage.openFile('simple.diagram');

    const hasErrors = (await vscPage.getNotifications()).some(
      (n) =>
        n.toLowerCase().includes('error') ||
        n.toLowerCase().includes('failed'),
    );
    expect(hasErrors).toBe(false);
  });

  test('.diagram file tab shows in editor', async ({ vscPage }) => {
    await vscPage.openFile('simple.diagram');

    const isOpen = await vscPage.isFileOpen('simple.diagram');
    expect(isOpen).toBe(true);
  });

  test('opens empty diagram file', async ({ vscPage }) => {
    await vscPage.openFile('empty.diagram');

    const isOpen = await vscPage.isFileOpen('empty.diagram');
    expect(isOpen).toBe(true);

    const hasErrors = (await vscPage.getNotifications()).some(
      (n) =>
        n.toLowerCase().includes('error') ||
        n.toLowerCase().includes('failed'),
    );
    expect(hasErrors).toBe(false);
  });

  test('opens complex diagram with groups', async ({ vscPage }) => {
    await vscPage.openFile('complex.diagram');

    const isOpen = await vscPage.isFileOpen('complex.diagram');
    expect(isOpen).toBe(true);
  });
});
