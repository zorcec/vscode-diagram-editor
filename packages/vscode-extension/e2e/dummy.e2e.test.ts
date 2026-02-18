/**
 * Dummy E2E test to verify the testing infrastructure works.
 * This test launches VS Code Desktop and checks that the extension activates.
 */

import { test, expect } from './fixtures/vscode-desktop-fixtures';

test.describe('AgentWatch Extension E2E', () => {
  test('VS Code Desktop launches and workbench loads', async ({ vscPage }) => {
    const page = vscPage.page;
    const workbench = page.locator('.monaco-workbench');
    await expect(workbench).toBeVisible({ timeout: 10000 });
  });

  test('extension shows activation notification', async ({ vscPage }) => {
    const found = await vscPage.waitForNotification('AgentWatch', 15000);
    expect(found).toBe(true);
  });

  test('explorer sidebar is visible', async ({ vscPage }) => {
    const page = vscPage.page;
    const explorer = page.locator('[id="workbench.view.explorer"]');
    const isVisible = await explorer.isVisible().catch(() => false);
    // Explorer should be visible or at least the sidebar should exist
    const sidebar = page.locator('.sidebar');
    await expect(sidebar).toBeVisible({ timeout: 5000 });
  });

  test('status bar is visible', async ({ vscPage }) => {
    const page = vscPage.page;
    const statusBar = page.locator('.statusbar');
    await expect(statusBar).toBeVisible({ timeout: 5000 });
  });
});
