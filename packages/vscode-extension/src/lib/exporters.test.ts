import { describe, it, expect } from 'vitest';
import { exportToMermaid, exportToSVG, buildDocumentSvg } from './exporters';
import { extractDiagramFromSvg } from './svgMetadata';
import type { DiagramDocument } from '../types/DiagramDocument';

function makeDoc(): DiagramDocument {
  return {
    meta: {
      title: 'Test',
      created: '2025-01-01T00:00:00Z',
      modified: '2025-01-01T00:00:00Z',
    },
    nodes: [
      {
        id: 'n1',
        label: 'Client',
        x: 80,
        y: 200,
        width: 120,
        height: 48,
        shape: 'rectangle',
        color: 'default',
        pinned: true,
      },
      {
        id: 'n2',
        label: 'Auth Service',
        x: 300,
        y: 200,
        width: 160,
        height: 48,
        shape: 'rounded',
        color: 'blue',
        pinned: true,
      },
      {
        id: 'n3',
        label: 'Database',
        x: 520,
        y: 200,
        width: 140,
        height: 48,
        shape: 'cylinder',
        color: 'gray',
        pinned: false,
      },
    ],
    edges: [
      {
        id: 'e1',
        source: 'n1',
        target: 'n2',
        label: 'JWT',
        style: 'solid',
        arrow: 'arrow',
      },
      {
        id: 'e2',
        source: 'n2',
        target: 'n3',
        label: 'queries',
        style: 'dashed',
        arrow: 'arrow',
      },
    ],
  };
}

describe('exportToMermaid', () => {
  it('should produce valid mermaid syntax', () => {
    const result = exportToMermaid(makeDoc());
    expect(result).toContain('graph LR');
    expect(result).toContain('n1[Client]');
    expect(result).toContain('n2(Auth Service)');
    expect(result).toContain('n3[(Database)]');
  });

  it('should render edges with labels', () => {
    const result = exportToMermaid(makeDoc());
    expect(result).toContain('n1 -->|JWT| n2');
    expect(result).toContain('n2 -.->|queries| n3');
  });

  it('should handle diamond shape', () => {
    const doc = makeDoc();
    doc.nodes[0].shape = 'diamond';
    const result = exportToMermaid(doc);
    expect(result).toContain('n1{Client}');
  });

  it('should handle edges without labels', () => {
    const doc = makeDoc();
    doc.edges[0].label = undefined;
    const result = exportToMermaid(doc);
    expect(result).toContain('n1 --> n2');
  });

  it('should handle dotted edge style', () => {
    const doc = makeDoc();
    doc.edges[0].style = 'dotted';
    const result = exportToMermaid(doc);
    expect(result).toContain('n1 -.->|JWT| n2');
  });

  it('should handle none arrow type', () => {
    const doc = makeDoc();
    doc.edges[0].arrow = 'none';
    const result = exportToMermaid(doc);
    expect(result).toContain('n1 --|JWT| n2');
  });

  it('should handle empty document', () => {
    const doc = makeDoc();
    doc.nodes = [];
    doc.edges = [];
    const result = exportToMermaid(doc);
    expect(result).toBe('graph LR');
  });
});

describe('exportToSVG', () => {
  it('should produce valid SVG markup', () => {
    const result = exportToSVG(makeDoc());
    expect(result).toContain('<svg');
    expect(result).toContain('</svg>');
    expect(result).toContain('xmlns="http://www.w3.org/2000/svg"');
  });

  it('should render all nodes', () => {
    const result = exportToSVG(makeDoc());
    expect(result).toContain('Client');
    expect(result).toContain('Auth Service');
    expect(result).toContain('Database');
  });

  it('should render edge labels', () => {
    const result = exportToSVG(makeDoc());
    expect(result).toContain('JWT');
    expect(result).toContain('queries');
  });

  it('should handle empty document', () => {
    const doc = makeDoc();
    doc.nodes = [];
    doc.edges = [];
    const result = exportToSVG(doc);
    expect(result).toContain('<svg');
    expect(result).toContain('</svg>');
  });

  it('should include arrowhead marker', () => {
    const result = exportToSVG(makeDoc());
    expect(result).toContain('marker');
    expect(result).toContain('arrowhead');
  });

  it('should render dashed edges with stroke-dasharray', () => {
    const doc = makeDoc();
    const result = exportToSVG(doc);
    expect(result).toContain('stroke-dasharray');
  });

  it('should escape special characters in labels', () => {
    const doc = makeDoc();
    doc.nodes[0].label = '<script>alert("xss")</script>';
    const result = exportToSVG(doc);
    expect(result).not.toContain('<script>');
    expect(result).toContain('&lt;script&gt;');
  });

  it('should handle rounded node shape with rx attribute', () => {
    const result = exportToSVG(makeDoc());
    expect(result).toContain('rx="8"');
  });
});

describe('buildDocumentSvg', () => {
  it('should produce valid SVG with viewBox and embedded metadata', () => {
    const svg = buildDocumentSvg(makeDoc());
    expect(svg).toContain('<svg');
    expect(svg).toContain('viewBox=');
    expect(svg).toContain('diagramflow:source');
    expect(svg).toContain('</svg>');
  });

  it('should embed parseable diagram JSON without XML-escaping quotes', () => {
    const doc = makeDoc();
    const svg = buildDocumentSvg(doc);
    // The JSON inside <diagramflow:source> must not have &quot; entities
    expect(svg).not.toContain('&quot;');
    const json = extractDiagramFromSvg(svg);
    expect(json).not.toBeNull();
    const parsed = JSON.parse(json!);
    expect(parsed.nodes).toHaveLength(doc.nodes.length);
    expect(parsed.edges).toHaveLength(doc.edges.length);
  });

  it('round-trips the full diagram document', () => {
    const doc = makeDoc();
    const svg = buildDocumentSvg(doc);
    const json = extractDiagramFromSvg(svg);
    const recovered = JSON.parse(json!);
    expect(recovered.nodes[0].label).toBe(doc.nodes[0].label);
    expect(recovered.edges[0].source).toBe(doc.edges[0].source);
    expect(recovered.meta.title).toBe(doc.meta.title);
  });

  it('uses correct viewBox covering all nodes with padding', () => {
    // n1@(80,200,120,48), n2@(300,200,160,48), n3@(520,200,140,48)
    // minX=80, maxRight=660, pad=40 → vbX=40, vbW=660
    // minY=200, maxBottom=248, pad=40 → vbY=160, vbH=128
    const svg = buildDocumentSvg(makeDoc());
    expect(svg).toContain('viewBox="40 160 660 128"');
  });

  it('escapes & and < in node labels inside embedded JSON', () => {
    const doc = makeDoc();
    doc.nodes[0].label = 'A&B < C';
    const svg = buildDocumentSvg(doc);
    const json = extractDiagramFromSvg(svg);
    const recovered = JSON.parse(json!);
    expect(recovered.nodes[0].label).toBe('A&B < C');
  });

  it('renders dark background and node/edge layers', () => {
    const svg = buildDocumentSvg(makeDoc());
    expect(svg).toContain('fill="#1e1e1e"');
    expect(svg).toContain('id="node-layer"');
    expect(svg).toContain('id="edge-layer"');
  });

  it('renders group-layer element', () => {
    const svg = buildDocumentSvg(makeDoc());
    expect(svg).toContain('id="group-layer"');
  });

  it('renders group rectangle and label when groups are present', () => {
    const doc = makeDoc();
    doc.groups = [{ id: 'g1', label: 'Backend', color: 'blue' }];
    doc.nodes[1].group = 'g1';
    doc.nodes[2].group = 'g1';
    const svg = buildDocumentSvg(doc);
    expect(svg).toContain('id="group-g1"');
    expect(svg).toContain('Backend');
    expect(svg).toContain('stroke-dasharray');
  });

  it('expands viewBox to include group padding above child nodes', () => {
    const doc = makeDoc();
    // n2 at y=200, n3 at y=200 — group with GROUP_PADDING=32, GROUP_LABEL_HEIGHT=28
    // group top = 200 - 32 - 28 = 140, with pad=40: vbY = 140-40 = 100
    // without groups: vbY = 200-40 = 160
    doc.groups = [{ id: 'g1', label: 'Backend', color: 'blue' }];
    doc.nodes[1].group = 'g1';
    doc.nodes[2].group = 'g1';
    const svg = buildDocumentSvg(doc);
    // vbY must be ≤ 100 to include the group header
    const match = svg.match(/viewBox="([-\d.]+) ([-\d.]+)/);
    expect(match).not.toBeNull();
    const vbY = parseFloat(match![2]);
    expect(vbY).toBeLessThanOrEqual(100);
  });

  it('handles empty groups array without errors', () => {
    const doc = makeDoc();
    doc.groups = [];
    expect(() => buildDocumentSvg(doc)).not.toThrow();
  });

  it('handles diagram with only groups and no nodes', () => {
    const doc = makeDoc();
    doc.nodes = [];
    doc.edges = [];
    doc.groups = [{ id: 'g1', label: 'Empty Group', x: 50, y: 50 }];
    const svg = buildDocumentSvg(doc);
    expect(svg).toContain('<svg');
    expect(svg).toContain('Empty Group');
  });
});
