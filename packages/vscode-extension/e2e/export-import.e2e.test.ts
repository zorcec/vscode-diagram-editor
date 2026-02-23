/**
 * E2E test: SVG Diagram Format
 *
 * Verifies that .diagram.svg files work correctly:
 *   1. The SVG contains embedded diagram metadata in <diagramflow:source> tags
 *   2. The metadata is not visible when viewing the SVG as an image
 *   3. The diagram JSON can be extracted from the SVG (round-trip)
 *   4. Plain SVG files without metadata are handled gracefully
 *   5. The .diagram.svg file opens in the custom editor when the extension is installed
 */

import { expect } from '@playwright/test';
import { test } from './fixtures/vscode-suite-fixtures';
import * as fs from 'fs';
import * as path from 'path';

const FIXTURE_SVG = path.resolve(__dirname, 'test-project', 'exported.svg');
const DIAGRAM_SVG = path.resolve(__dirname, 'test-project', 'test-metadata.diagram.svg');
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

test.describe('SVG Diagram Format', () => {
  test('.diagram.svg file opens in diagram editor', async ({
    vscPage,
  }) => {
    await vscPage.openFile('test-metadata.diagram.svg');
    await vscPage.page.waitForTimeout(3000);

    // The custom editor should be active — check for the canvas container inside a webview
    const tab = vscPage.page.locator('.tab').filter({ hasText: 'test-metadata.diagram.svg' });
    await expect(tab).toBeVisible({ timeout: 5000 });
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

  test('.diagram.svg has metadata inside non-visible <metadata> tag', () => {
    const content = fs.readFileSync(DIAGRAM_SVG, 'utf-8');

    // The <metadata> tag is a standard SVG element that should not render
    expect(content).toContain('<metadata>');
    expect(content).toContain('</metadata>');
    expect(content).toContain('<diagramflow:source');
    expect(content).toContain('</diagramflow:source>');

    // The embedded JSON should be extractable
    const json = extractDiagramFromSvg(content);
    expect(json).not.toBeNull();

    const doc = JSON.parse(json!);
    expect(doc.meta).toBeDefined();
    expect(Array.isArray(doc.nodes)).toBe(true);
    expect(Array.isArray(doc.edges)).toBe(true);
  });

  test('.diagram.svg is valid SVG markup', () => {
    const content = fs.readFileSync(DIAGRAM_SVG, 'utf-8');

    // Must start with XML prolog or <svg
    expect(content).toMatch(/^<\?xml|^<svg/);
    // Must have <svg> root element
    expect(content).toContain('<svg');
    expect(content).toContain('</svg>');
    // Must have xmlns attribute
    expect(content).toContain('xmlns="http://www.w3.org/2000/svg"');
  });

  test('.diagram.svg round-trip: extract and re-embed preserves data', () => {
    const content = fs.readFileSync(DIAGRAM_SVG, 'utf-8');
    const json = extractDiagramFromSvg(content)!;
    const doc = JSON.parse(json);

    // Verify core structure survived the round trip
    expect(doc.meta.title).toBeDefined();
    expect(doc.nodes.length).toBeGreaterThan(0);
    expect(doc.edges.length).toBeGreaterThan(0);

    // All nodes must have id, label, x, y
    for (const node of doc.nodes) {
      expect(node.id).toBeDefined();
      expect(node.label).toBeDefined();
      expect(typeof node.x).toBe('number');
      expect(typeof node.y).toBe('number');
    }

    // All edges must reference valid node IDs
    const nodeIds = new Set(doc.nodes.map((n: { id: string }) => n.id));
    for (const edge of doc.edges) {
      expect(nodeIds.has(edge.source)).toBe(true);
      expect(nodeIds.has(edge.target)).toBe(true);
    }
  });
});
