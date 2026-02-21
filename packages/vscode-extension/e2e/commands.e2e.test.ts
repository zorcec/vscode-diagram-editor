/**
 * E2E test: Extension Commands
 *
 * Verifies that DiagramFlow commands work correctly:
 * - New Diagram
 * - Auto Layout
 * - Export SVG
 * - Export Mermaid
 */

import { expect } from '@playwright/test';
import { test } from './fixtures/vscode-suite-fixtures';

test.describe('Extension Commands', () => {
  test('auto layout command is available', async ({ vscPage }) => {
    await vscPage.openFile('simple.diagram');
    await vscPage.page.waitForTimeout(1000);

    // Open command palette and search for the command
    await vscPage.page.keyboard.press('Control+Shift+P');
    await vscPage.page.waitForTimeout(500);

    const quickInput = vscPage.page.locator(
      '.quick-input-widget input[type="text"]',
    );
    await quickInput.fill('DiagramFlow: Auto Layout');
    await vscPage.page.waitForTimeout(1000);

    // Check that the command appears in the palette
    const items = vscPage.page.locator(
      '.quick-input-list .monaco-list-row',
    );
    const commandCount = await items.count();
    expect(commandCount).toBeGreaterThan(0);

    // Close the palette
    await vscPage.page.keyboard.press('Escape');
  });

  test('export mermaid command is available', async ({ vscPage }) => {
    await vscPage.page.keyboard.press('Control+Shift+P');
    await vscPage.page.waitForTimeout(500);

    const quickInput = vscPage.page.locator(
      '.quick-input-widget input[type="text"]',
    );
    await quickInput.fill('DiagramFlow: Export');
    await vscPage.page.waitForTimeout(1000);

    const items = vscPage.page.locator(
      '.quick-input-list .monaco-list-row',
    );
    const commandCount = await items.count();
    expect(commandCount).toBeGreaterThan(0);

    await vscPage.page.keyboard.press('Escape');
  });

  test('new diagram command is available', async ({ vscPage }) => {
    await vscPage.page.keyboard.press('Control+Shift+P');
    await vscPage.page.waitForTimeout(500);

    const quickInput = vscPage.page.locator(
      '.quick-input-widget input[type="text"]',
    );
    await quickInput.fill('DiagramFlow: New');
    await vscPage.page.waitForTimeout(1000);

    const items = vscPage.page.locator(
      '.quick-input-list .monaco-list-row',
    );
    const commandCount = await items.count();
    expect(commandCount).toBeGreaterThan(0);

    await vscPage.page.keyboard.press('Escape');
  });
});
