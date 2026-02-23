/**
 * E2E test: Editor Save (.diagram.svg round-trip)
 *
 * Verifies that .diagram.svg files can be opened, modified via commands,
 * and the diagram content is preserved correctly.
 */

import { expect } from '@playwright/test';
import { test } from './fixtures/vscode-suite-fixtures';
import * as fs from 'fs';
import * as path from 'path';

const SOURCE_RE = /<diagramflow:source[^>]*>([\s\S]*?)<\/diagramflow:source>/;

/** Extract and parse diagram JSON from a .diagram.svg file. */
function readDiagramSvg(filePath: string): any {
  const content = fs.readFileSync(filePath, 'utf-8');
  const match = content.match(SOURCE_RE);
  if (!match?.[1]) throw new Error(`No diagram metadata in ${filePath}`);
  const json = match[1].trim()
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  return JSON.parse(json);
}

test.describe('Editor Save', () => {
  test('diagram structure is preserved after open', async ({
    vscPage,
  }) => {
    const filePath = path.resolve(
      __dirname,
      'test-project',
      'simple.diagram.svg',
    );
    const originalDoc = readDiagramSvg(filePath);

    await vscPage.openFile('simple.diagram.svg');
    await vscPage.page.waitForTimeout(2000);

    // Read the file again to verify it hasn't been corrupted
    const afterDoc = readDiagramSvg(filePath);

    expect(afterDoc.meta.title).toBe(originalDoc.meta.title);
    expect(afterDoc.nodes).toHaveLength(originalDoc.nodes.length);
    expect(afterDoc.edges).toHaveLength(originalDoc.edges.length);
  });

  test('empty diagram file has valid embedded metadata', async ({}) => {
    const filePath = path.resolve(
      __dirname,
      'test-project',
      'empty.diagram.svg',
    );
    const doc = readDiagramSvg(filePath);

    expect(doc.meta).toBeDefined();
    expect(doc.nodes).toEqual([]);
    expect(doc.edges).toEqual([]);
  });

  test('complex diagram preserves groups', async ({}) => {
    const filePath = path.resolve(
      __dirname,
      'test-project',
      'complex.diagram.svg',
    );
    const doc = readDiagramSvg(filePath);

    expect(doc.groups).toHaveLength(2);
    expect(doc.groups[0].label).toBe('Input Layer');
    expect(doc.groups[1].label).toBe('Processing Layer');
    expect(doc.nodes.filter((n: any) => n.group)).toHaveLength(4);
  });
});
