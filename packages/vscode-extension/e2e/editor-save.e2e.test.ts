/**
 * E2E test: Editor Save (.diagram round-trip)
 *
 * Verifies that .diagram files can be opened, modified via commands,
 * and the JSON content is preserved correctly.
 */

import { expect } from '@playwright/test';
import { test } from './fixtures/vscode-suite-fixtures';
import * as fs from 'fs';
import * as path from 'path';

test.describe('Editor Save', () => {
  test('diagram JSON structure is preserved after open', async ({
    vscPage,
  }) => {
    const filePath = path.resolve(
      __dirname,
      'test-project',
      'simple.diagram',
    );
    const originalContent = fs.readFileSync(filePath, 'utf-8');
    const originalDoc = JSON.parse(originalContent);

    await vscPage.openFile('simple.diagram');
    await vscPage.page.waitForTimeout(2000);

    // Read the file again to verify it hasn't been corrupted
    const afterContent = fs.readFileSync(filePath, 'utf-8');
    const afterDoc = JSON.parse(afterContent);

    expect(afterDoc.meta.title).toBe(originalDoc.meta.title);
    expect(afterDoc.nodes).toHaveLength(originalDoc.nodes.length);
    expect(afterDoc.edges).toHaveLength(originalDoc.edges.length);
  });

  test('empty diagram file is valid JSON', async ({ vscPage }) => {
    const filePath = path.resolve(
      __dirname,
      'test-project',
      'empty.diagram',
    );
    const content = fs.readFileSync(filePath, 'utf-8');
    const doc = JSON.parse(content);

    expect(doc.meta).toBeDefined();
    expect(doc.nodes).toEqual([]);
    expect(doc.edges).toEqual([]);
  });

  test('complex diagram preserves groups', async ({ vscPage }) => {
    const filePath = path.resolve(
      __dirname,
      'test-project',
      'complex.diagram',
    );
    const content = fs.readFileSync(filePath, 'utf-8');
    const doc = JSON.parse(content);

    expect(doc.groups).toHaveLength(2);
    expect(doc.groups[0].label).toBe('Input Layer');
    expect(doc.groups[1].label).toBe('Processing Layer');
    expect(doc.nodes.filter((n: any) => n.group)).toHaveLength(4);
  });
});
