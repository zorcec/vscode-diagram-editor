import { describe, it, expect } from 'vitest';
import { exportToMermaid, exportToSVG } from './exporters';
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
