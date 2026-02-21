/**
 * Unit tests: src/lib/svgMetadata.ts
 *
 * Tests for extractDiagramFromSvg - the function that extracts .diagram JSON
 * from SVGs exported by DiagramFlow (with embedded <metadata> elements).
 */

import { describe, it, expect } from 'vitest';
import { extractDiagramFromSvg } from './svgMetadata';

const VALID_DOC = {
  meta: { title: 'Test', created: '2025-01-01T00:00:00Z', modified: '2025-01-01T00:00:00Z' },
  nodes: [{ id: 'n1', label: 'Node 1', x: 0, y: 0, width: 160, height: 48, shape: 'rectangle', color: 'default', pinned: false }],
  edges: [{ id: 'e1', source: 'n1', target: 'n1', style: 'solid', arrow: 'normal' }],
};

function makeSvg(embeddedJson: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:diagramflow="https://diagramflow.vscode/schema" width="800" height="600" viewBox="0 0 800 600">
  <metadata>
    <diagramflow:source xmlns:diagramflow="https://diagramflow.vscode/schema">${embeddedJson}</diagramflow:source>
  </metadata>
  <rect width="100%" height="100%" fill="#1e1e1e"/>
  <g id="node-layer">
    <g class="diagram-node" data-id="n1" transform="translate(0,0)">
      <rect width="160" height="48" fill="#2d2d2d" stroke="#555"/>
      <text>Node 1</text>
    </g>
  </g>
</svg>`;
}

describe('extractDiagramFromSvg', () => {
  it('returns null for plain SVG without DiagramFlow metadata', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100"/></svg>';
    expect(extractDiagramFromSvg(svg)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(extractDiagramFromSvg('')).toBeNull();
  });

  it('returns null for malformed SVG (no closing tag)', () => {
    const svg = '<svg><metadata><diagramflow:source {"nodes":[]}</svg>';
    expect(extractDiagramFromSvg(svg)).toBeNull();
  });

  it('returns null when JSON inside metadata is invalid', () => {
    const svg = makeSvg('{ not valid json }');
    expect(extractDiagramFromSvg(svg)).toBeNull();
  });

  it('returns null when JSON is valid but missing nodes array', () => {
    const svg = makeSvg('{"edges":[]}');
    expect(extractDiagramFromSvg(svg)).toBeNull();
  });

  it('returns null when JSON is valid but missing edges array', () => {
    const svg = makeSvg('{"nodes":[]}');
    expect(extractDiagramFromSvg(svg)).toBeNull();
  });

  it('extracts valid diagram JSON from a well-formed SVG', () => {
    const json = JSON.stringify(VALID_DOC);
    const svg = makeSvg(json);
    const result = extractDiagramFromSvg(svg);
    expect(result).not.toBeNull();
    expect(JSON.parse(result!)).toEqual(VALID_DOC);
  });

  it('trims whitespace around the embedded JSON', () => {
    const json = JSON.stringify(VALID_DOC);
    const svg = makeSvg(`\n  ${json}  \n`);
    const result = extractDiagramFromSvg(svg);
    expect(result).not.toBeNull();
    expect(JSON.parse(result!)).toEqual(VALID_DOC);
  });

  it('works with an empty nodes and edges arrays', () => {
    const emptyDoc = { ...VALID_DOC, nodes: [], edges: [] };
    const json = JSON.stringify(emptyDoc);
    const svg = makeSvg(json);
    const result = extractDiagramFromSvg(svg);
    expect(result).not.toBeNull();
    const parsed = JSON.parse(result!);
    expect(parsed.nodes).toHaveLength(0);
    expect(parsed.edges).toHaveLength(0);
  });

  it('preserves all diagram fields: meta, nodes, edges, groups', () => {
    const fullDoc = {
      ...VALID_DOC,
      groups: [{ id: 'g1', label: 'Group 1', color: 'blue' }],
    };
    const svg = makeSvg(JSON.stringify(fullDoc));
    const result = extractDiagramFromSvg(svg);
    expect(result).not.toBeNull();
    const parsed = JSON.parse(result!);
    expect(parsed.groups).toHaveLength(1);
    expect(parsed.groups[0].id).toBe('g1');
  });

  it('handles source element with extra attributes', () => {
    const json = JSON.stringify(VALID_DOC);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg">
      <metadata>
        <diagramflow:source xmlns:diagramflow="https://diagramflow.vscode/schema" version="1.0">${json}</diagramflow:source>
      </metadata>
    </svg>`;
    const result = extractDiagramFromSvg(svg);
    expect(result).not.toBeNull();
  });

  it('returns the raw JSON string (not parsed object)', () => {
    const json = JSON.stringify(VALID_DOC);
    const svg = makeSvg(json);
    const result = extractDiagramFromSvg(svg);
    expect(typeof result).toBe('string');
  });
});
