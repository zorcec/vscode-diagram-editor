/**
 * E2E test: Export and Import SVG
 *
 * Verifies that DiagramFlow's export (Save SVG / Save PNG) and import
 * (Open SVG) commands are reachable and the SVG round-trip metadata format
 * is well-structured. Since native file dialogs cannot be automated via
 * Playwright, these tests verify:
 *   1. Commands appear in the command palette
 *   2. The exported SVG fixture has the expected metadata structure (file-system)
 *   3. The extractDiagramFromSvg logic works at the integration level
 */

import { expect } from '@playwright/test';
import { test } from './fixtures/vscode-suite-fixtures';
import * as fs from 'fs';
import * as path from 'path';

const FIXTURE_SVG = path.resolve(__dirname, 'test-project', 'exported.svg');
const DIAGRAM_SOURCE_RE = /<diagramflow:source[^>]*>([\s\S]*?)<\/diagramflow:source>/;

function extractDiagramFromSvg(svgContent: string): string | null {
  const match = svgContent.match(DIAGRAM_SOURCE_RE);
  if (!match?.[1]) return null;
  const json = match[1].trim();
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) return null;
    return json;
  } catch {
    return null;
  }
}

test.describe('Export and Import SVG', () => {
  test('DiagramFlow: Export as SVG command is in the command palette', async ({
    vscPage,
  }) => {
    await vscPage.openFile('simple.diagram');
    await vscPage.page.waitForTimeout(1000);
    await vscPage.page.keyboard.press('Control+Shift+P');
    await vscPage.page.waitForTimeout(500);

    const input = vscPage.page.locator('.quick-input-widget input[type="text"]');
    await input.fill('DiagramFlow: Export as SVG');
    await vscPage.page.waitForTimeout(800);

    const items = vscPage.page.locator('.quick-input-list .monaco-list-row');
    const count = await items.count();
    expect(count).toBeGreaterThan(0);

    await vscPage.page.keyboard.press('Escape');
  });

  test('DiagramFlow: Import SVG command is in the command palette', async ({
    vscPage,
  }) => {
    await vscPage.page.keyboard.press('Control+Shift+P');
    await vscPage.page.waitForTimeout(500);

    const input = vscPage.page.locator('.quick-input-widget input[type="text"]');
    await input.fill('DiagramFlow: Import SVG');
    await vscPage.page.waitForTimeout(800);

    const items = vscPage.page.locator('.quick-input-list .monaco-list-row');
    const count = await items.count();
    expect(count).toBeGreaterThan(0);

    await vscPage.page.keyboard.press('Escape');
  });

  test('exported.svg fixture has valid embedded .diagram metadata', () => {
    expect(fs.existsSync(FIXTURE_SVG)).toBe(true);

    const content = fs.readFileSync(FIXTURE_SVG, 'utf-8');
    const json = extractDiagramFromSvg(content);

    expect(json).not.toBeNull();

    const doc = JSON.parse(json!);
    expect(doc.meta).toBeDefined();
    expect(Array.isArray(doc.nodes)).toBe(true);
    expect(Array.isArray(doc.edges)).toBe(true);
    expect(doc.nodes.length).toBeGreaterThan(0);
  });

  test('exported.svg metadata preserves node and edge structure', () => {
    const content = fs.readFileSync(FIXTURE_SVG, 'utf-8');
    const json = extractDiagramFromSvg(content)!;
    const doc = JSON.parse(json);

    // Nodes must have required fields
    for (const node of doc.nodes) {
      expect(node.id).toBeDefined();
      expect(node.label).toBeDefined();
      expect(typeof node.x).toBe('number');
      expect(typeof node.y).toBe('number');
    }

    // Edges must reference valid node IDs
    const nodeIds = new Set(doc.nodes.map((n: { id: string }) => n.id));
    for (const edge of doc.edges) {
      expect(nodeIds.has(edge.source)).toBe(true);
      expect(nodeIds.has(edge.target)).toBe(true);
    }
  });

  test('plain SVG without DiagramFlow metadata returns null extraction', () => {
    const plainSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
  <rect width="100" height="100" fill="red"/>
</svg>`;
    expect(extractDiagramFromSvg(plainSvg)).toBeNull();
  });
});
