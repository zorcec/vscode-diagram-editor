import { describe, it, expect } from 'vitest';
import { validateDiagram, parseDiagramJSON } from './SchemaValidator';
import type { DiagramDocument } from '../types/DiagramDocument';

function makeValidDoc(
  overrides: Partial<DiagramDocument> = {},
): DiagramDocument {
  return {
    meta: {
      title: 'Test',
      created: '2025-01-01T00:00:00Z',
      modified: '2025-01-01T00:00:00Z',
    },
    nodes: [
      {
        id: 'node0001',
        label: 'A',
        x: 100,
        y: 100,
        width: 160,
        height: 48,
        shape: 'rectangle',
        color: 'default',
        pinned: false,
      },
      {
        id: 'node0002',
        label: 'B',
        x: 300,
        y: 100,
        width: 160,
        height: 48,
        shape: 'rounded',
        color: 'blue',
        pinned: true,
      },
    ],
    edges: [
      {
        id: 'edge0001',
        source: 'node0001',
        target: 'node0002',
        style: 'solid',
        arrow: 'arrow',
      },
    ],
    ...overrides,
  };
}

describe('validateDiagram', () => {
  it('should validate a correct document', () => {
    const result = validateDiagram(makeValidDoc());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject null input', () => {
    const result = validateDiagram(null);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Document must be a non-null object');
  });

  it('should reject non-object input', () => {
    const result = validateDiagram('string');
    expect(result.valid).toBe(false);
  });

  it('should require meta object', () => {
    const doc = makeValidDoc();
    (doc as any).meta = null;
    const result = validateDiagram(doc);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('meta'))).toBe(true);
  });

  it('should require meta.title', () => {
    const doc = makeValidDoc();
    doc.meta.title = '';
    const result = validateDiagram(doc);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('meta.title'))).toBe(true);
  });

  it('should require meta.created', () => {
    const doc = makeValidDoc();
    doc.meta.created = '';
    const result = validateDiagram(doc);
    expect(result.valid).toBe(false);
  });

  it('should require meta.modified', () => {
    const doc = makeValidDoc();
    doc.meta.modified = '';
    const result = validateDiagram(doc);
    expect(result.valid).toBe(false);
  });

  it('should require nodes to be an array', () => {
    const doc = makeValidDoc();
    (doc as any).nodes = 'not-array';
    const result = validateDiagram(doc);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('nodes must be an array');
  });

  it('should require node id', () => {
    const doc = makeValidDoc();
    (doc.nodes[0] as any).id = '';
    const result = validateDiagram(doc);
    expect(result.valid).toBe(false);
  });

  it('should require node label to be a string', () => {
    const doc = makeValidDoc();
    (doc.nodes[0] as any).label = 123;
    const result = validateDiagram(doc);
    expect(result.valid).toBe(false);
  });

  it('should require x and y to be numbers', () => {
    const doc = makeValidDoc();
    (doc.nodes[0] as any).x = 'bad';
    const result = validateDiagram(doc);
    expect(result.valid).toBe(false);
  });

  it('should allow negative x and y', () => {
    const doc = makeValidDoc();
    doc.nodes[0].x = -100;
    doc.nodes[0].y = -200;
    const result = validateDiagram(doc);
    expect(result.valid).toBe(true);
  });

  it('should require positive width and height', () => {
    const doc = makeValidDoc();
    doc.nodes[0].width = 0;
    const result = validateDiagram(doc);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('width'))).toBe(true);
  });

  it('should reject negative height', () => {
    const doc = makeValidDoc();
    doc.nodes[0].height = -10;
    const result = validateDiagram(doc);
    expect(result.valid).toBe(false);
  });

  it('should reject invalid node shape', () => {
    const doc = makeValidDoc();
    (doc.nodes[0] as any).shape = 'hexagon';
    const result = validateDiagram(doc);
    expect(result.valid).toBe(false);
  });

  it('should reject invalid node color', () => {
    const doc = makeValidDoc();
    (doc.nodes[0] as any).color = 'rainbow';
    const result = validateDiagram(doc);
    expect(result.valid).toBe(false);
  });

  it('should require pinned to be boolean', () => {
    const doc = makeValidDoc();
    (doc.nodes[0] as any).pinned = 'yes';
    const result = validateDiagram(doc);
    expect(result.valid).toBe(false);
  });

  it('should validate all four node shapes', () => {
    const shapes = ['rectangle', 'rounded', 'diamond', 'cylinder'] as const;
    for (const shape of shapes) {
      const doc = makeValidDoc();
      doc.nodes[0].shape = shape;
      const result = validateDiagram(doc);
      expect(result.valid).toBe(true);
    }
  });

  it('should validate all node colors', () => {
    const colors = [
      'default',
      'blue',
      'green',
      'red',
      'yellow',
      'purple',
      'gray',
    ] as const;
    for (const color of colors) {
      const doc = makeValidDoc();
      doc.nodes[0].color = color;
      const result = validateDiagram(doc);
      expect(result.valid).toBe(true);
    }
  });

  it('should require edges to be an array', () => {
    const doc = makeValidDoc();
    (doc as any).edges = 'bad';
    const result = validateDiagram(doc);
    expect(result.valid).toBe(false);
  });

  it('should require edge source to reference existing node', () => {
    const doc = makeValidDoc();
    doc.edges[0].source = 'nonexistent';
    const result = validateDiagram(doc);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('source'))).toBe(true);
  });

  it('should require edge target to reference existing node', () => {
    const doc = makeValidDoc();
    doc.edges[0].target = 'nonexistent';
    const result = validateDiagram(doc);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('target'))).toBe(true);
  });

  it('should reject invalid edge style', () => {
    const doc = makeValidDoc();
    (doc.edges[0] as any).style = 'wavy';
    const result = validateDiagram(doc);
    expect(result.valid).toBe(false);
  });

  it('should reject invalid arrow type', () => {
    const doc = makeValidDoc();
    (doc.edges[0] as any).arrow = 'double';
    const result = validateDiagram(doc);
    expect(result.valid).toBe(false);
  });

  it('should validate all edge styles', () => {
    const styles = ['solid', 'dashed', 'dotted'] as const;
    for (const style of styles) {
      const doc = makeValidDoc();
      doc.edges[0].style = style;
      const result = validateDiagram(doc);
      expect(result.valid).toBe(true);
    }
  });

  it('should validate all arrow types', () => {
    const arrows = ['arrow', 'open', 'none'] as const;
    for (const arrow of arrows) {
      const doc = makeValidDoc();
      doc.edges[0].arrow = arrow;
      const result = validateDiagram(doc);
      expect(result.valid).toBe(true);
    }
  });

  it('should detect duplicate ids across nodes and edges', () => {
    const doc = makeValidDoc();
    doc.edges[0].id = doc.nodes[0].id;
    const result = validateDiagram(doc);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Duplicate id'))).toBe(true);
  });

  it('should validate optional groups', () => {
    const doc = makeValidDoc({
      groups: [{ id: 'g1', label: 'Group 1' }],
    });
    doc.nodes[0].group = 'g1';
    const result = validateDiagram(doc);
    expect(result.valid).toBe(true);
  });

  it('should reject node group referencing non-existent group', () => {
    const doc = makeValidDoc();
    doc.nodes[0].group = 'nonexistent';
    const result = validateDiagram(doc);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('group'))).toBe(true);
  });

  it('should allow empty groups array', () => {
    const doc = makeValidDoc({ groups: [] });
    const result = validateDiagram(doc);
    expect(result.valid).toBe(true);
  });

  it('should reject groups that are not arrays', () => {
    const doc = makeValidDoc();
    (doc as any).groups = 'bad';
    const result = validateDiagram(doc);
    expect(result.valid).toBe(false);
  });

  it('should validate viewport', () => {
    const doc = makeValidDoc({
      viewport: { x: 0, y: 0, zoom: 1 },
    });
    const result = validateDiagram(doc);
    expect(result.valid).toBe(true);
  });

  it('should reject viewport with non-positive zoom', () => {
    const doc = makeValidDoc({
      viewport: { x: 0, y: 0, zoom: 0 },
    });
    const result = validateDiagram(doc);
    expect(result.valid).toBe(false);
  });

  it('should allow missing viewport', () => {
    const doc = makeValidDoc();
    delete (doc as any).viewport;
    const result = validateDiagram(doc);
    expect(result.valid).toBe(true);
  });

  it('should allow document with no edges', () => {
    const doc = makeValidDoc({ edges: [] });
    const result = validateDiagram(doc);
    expect(result.valid).toBe(true);
  });

  it('should allow document with no nodes and no edges', () => {
    const doc = makeValidDoc({ nodes: [], edges: [] });
    const result = validateDiagram(doc);
    expect(result.valid).toBe(true);
  });

  it('should reject non-object nodes entries', () => {
    const doc = makeValidDoc();
    (doc.nodes as any)[0] = null;
    const result = validateDiagram(doc);
    expect(result.valid).toBe(false);
  });

  it('should reject non-object edges entries', () => {
    const doc = makeValidDoc();
    (doc.edges as any)[0] = null;
    const result = validateDiagram(doc);
    expect(result.valid).toBe(false);
  });

  it('should require group id and label', () => {
    const doc = makeValidDoc({
      groups: [{ id: '', label: '' } as any],
    });
    const result = validateDiagram(doc);
    expect(result.valid).toBe(false);
  });
});

describe('parseDiagramJSON', () => {
  it('should parse valid JSON', () => {
    const doc = makeValidDoc();
    const result = parseDiagramJSON(JSON.stringify(doc));
    expect(result.doc).toBeTruthy();
    expect(result.errors).toHaveLength(0);
  });

  it('should reject invalid JSON', () => {
    const result = parseDiagramJSON('{invalid json}');
    expect(result.doc).toBeNull();
    expect(result.errors.some((e) => e.includes('Invalid JSON'))).toBe(true);
  });

  it('should reject valid JSON that fails validation', () => {
    const result = parseDiagramJSON('{}');
    expect(result.doc).toBeNull();
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should parse complete document with all fields', () => {
    const doc = makeValidDoc({
      groups: [{ id: 'g1', label: 'Group 1' }],
      viewport: { x: 10, y: 20, zoom: 1.5 },
    });
    const result = parseDiagramJSON(JSON.stringify(doc));
    expect(result.doc).toBeTruthy();
    expect(result.doc?.meta.title).toBe('Test');
    expect(result.doc?.nodes).toHaveLength(2);
    expect(result.doc?.edges).toHaveLength(1);
    expect(result.doc?.groups).toHaveLength(1);
    expect(result.doc?.viewport?.zoom).toBe(1.5);
  });
});
