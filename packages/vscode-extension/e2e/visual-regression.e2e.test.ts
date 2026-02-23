/**
 * E2E test: Visual Regression
 *
 * Screenshot-based tests for the React Flow webview. Takes screenshots of
 * various diagram states and compares them against baseline images.
 * These tests verify that diagrams render without visual defects.
 */

import { expect } from '@playwright/test';
import { test } from './fixtures/vscode-suite-fixtures';

// Visual regression tests compare pixel-exact screenshots and are inherently
// sensitive to rendering timing. Disable retries to avoid doubling runtime on
// minor rendering variations — failures should be investigated manually.
test.describe('Visual Regression', () => {
  test.describe.configure({ retries: 0 });

  test('simple diagram renders without errors', async ({ vscPage }) => {
    await vscPage.openFile('simple.diagram.svg');
    await vscPage.page.waitForTimeout(2500);

    const tab = vscPage.page.locator('.tab').filter({ hasText: 'simple.diagram.svg' });
    await expect(tab).toBeVisible({ timeout: 10000 });

    const editorArea = vscPage.page.locator('.editor-group-container');
    await expect(editorArea).toHaveScreenshot('simple-diagram.png', {
      maxDiffPixelRatio: 0.05,
      mask: [vscPage.page.locator('.react-flow__minimap')],
    });
  });

  test('empty diagram shows clean canvas', async ({ vscPage }) => {
    await vscPage.openFile('empty.diagram.svg');
    await vscPage.page.waitForTimeout(2000);

    const tab = vscPage.page.locator('.tab').filter({ hasText: 'empty.diagram.svg' });
    await expect(tab).toBeVisible({ timeout: 10000 });

    const editorArea = vscPage.page.locator('.editor-group-container');
    await expect(editorArea).toHaveScreenshot('empty-diagram.png', {
      maxDiffPixelRatio: 0.05,
    });
  });

  test('complex diagram with multiple shapes renders', async ({ vscPage }) => {
    await vscPage.openFile('complex.diagram.svg');
    await vscPage.page.waitForTimeout(2500);

    const tab = vscPage.page.locator('.tab').filter({ hasText: 'complex.diagram.svg' });
    await expect(tab).toBeVisible({ timeout: 10000 });

    const editorArea = vscPage.page.locator('.editor-group-container');
    await expect(editorArea).toHaveScreenshot('complex-diagram.png', {
      maxDiffPixelRatio: 0.05,
      mask: [vscPage.page.locator('.react-flow__minimap')],
    });
  });
});
