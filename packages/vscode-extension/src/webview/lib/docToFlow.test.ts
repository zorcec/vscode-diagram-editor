import { describe, it, expect } from 'vitest';
import { docToFlowNodes, docToFlowEdges, docToFlowGroupNodes, resolveGroupOrigin } from './docToFlow';
import type { DiagramDocument } from '../../types/DiagramDocument';
import { GROUP_PADDING, GROUP_LABEL_HEIGHT } from '../../types/DiagramDocument';

function makeDoc(
  overrides: Partial<DiagramDocument> = {},
): DiagramDocument {
  return {
    meta: {
      title: 'Test',
      created: '2025-01-01T00:00:00Z',
      modified: '2025-01-01T00:00:00Z',
    },
    nodes: [],
    edges: [],
    ...overrides,
  };
}

describe('docToFlowNodes', () => {
  it('returns empty array for empty document', () => {
    const doc = makeDoc();
    expect(docToFlowNodes(doc)).toEqual([]);
  });

  it('maps a single node to React Flow format', () => {
    const doc = makeDoc({
      nodes: [
        {
          id: 'n1',
          label: 'Start',
          x: 100,
          y: 200,
          width: 160,
          height: 48,
          shape: 'rectangle',
          color: 'blue',
          pinned: true,
        },
      ],
    });

    const result = docToFlowNodes(doc);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'n1',
      type: 'diagramNode',
      position: { x: 100, y: 200 },
      width: 160,
      height: 48,
      draggable: true,
      selectable: true,
      data: {
        label: 'Start',
        shape: 'rectangle',
        color: 'blue',
        pinned: true,
        width: 160,
        height: 48,
      },
    });
  });

  it('maps multiple nodes preserving all shapes', () => {
    const shapes = ['rectangle', 'rounded', 'diamond', 'cylinder'] as const;
    const doc = makeDoc({
      nodes: shapes.map((shape, i) => ({
        id: `n${i}`,
        label: `Node ${i}`,
        x: i * 100,
        y: 0,
        width: 160,
        height: 48,
        shape,
        color: 'default' as const,
        pinned: false,
      })),
    });

    const result = docToFlowNodes(doc);
    expect(result).toHaveLength(4);
    result.forEach((node, i) => {
      expect(node.data.shape).toBe(shapes[i]);
    });
  });

  it('maps node with optional notes', () => {
    const doc = makeDoc({
      nodes: [
        {
          id: 'n1',
          label: 'DB',
          x: 0,
          y: 0,
          width: 160,
          height: 48,
          shape: 'cylinder',
          color: 'green',
          pinned: false,
          notes: 'PostgreSQL instance',
        },
      ],
    });

    const result = docToFlowNodes(doc);
    expect(result[0].data.notes).toBe('PostgreSQL instance');
  });

  it('maps all 7 colors', () => {
    const colors = [
      'default', 'blue', 'green', 'red', 'yellow', 'purple', 'gray',
    ] as const;
    const doc = makeDoc({
      nodes: colors.map((color, i) => ({
        id: `n${i}`,
        label: color,
        x: 0,
        y: i * 60,
        width: 160,
        height: 48,
        shape: 'rectangle' as const,
        color,
        pinned: false,
      })),
    });

    const result = docToFlowNodes(doc);
    expect(result).toHaveLength(7);
    result.forEach((node, i) => {
      expect(node.data.color).toBe(colors[i]);
    });
  });

  it('preserves node dimensions in both data and node-level', () => {
    const doc = makeDoc({
      nodes: [
        {
          id: 'n1',
          label: 'Wide',
          x: 10,
          y: 20,
          width: 300,
          height: 100,
          shape: 'rectangle',
          color: 'default',
          pinned: false,
        },
      ],
    });

    const result = docToFlowNodes(doc);
    expect(result[0].width).toBe(300);
    expect(result[0].height).toBe(100);
    expect(result[0].data.width).toBe(300);
    expect(result[0].data.height).toBe(100);
  });
});

describe('docToFlowEdges', () => {
  it('returns empty array for empty document', () => {
    const doc = makeDoc();
    expect(docToFlowEdges(doc)).toEqual([]);
  });

  it('maps a single edge to React Flow format', () => {
    const doc = makeDoc({
      edges: [
        {
          id: 'e1',
          source: 'n1',
          target: 'n2',
          label: 'next',
          style: 'solid',
          arrow: 'normal',
        },
      ],
    });

    const result = docToFlowEdges(doc);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'e1',
      source: 'n1',
      target: 'n2',
      type: 'diagramEdge',
      label: 'next',
      animated: false,
      data: { style: 'solid', arrow: 'normal' },
    });
  });

  it('maps edge without label as empty string', () => {
    const doc = makeDoc({
      edges: [
        {
          id: 'e1',
          source: 'n1',
          target: 'n2',
          style: 'dashed',
          arrow: 'open',
        },
      ],
    });

    const result = docToFlowEdges(doc);
    expect(result[0].label).toBe('');
  });

  it('maps animated edge', () => {
    const doc = makeDoc({
      edges: [
        {
          id: 'e1',
          source: 'n1',
          target: 'n2',
          style: 'solid',
          arrow: 'arrow',
          animated: true,
        },
      ],
    });

    const result = docToFlowEdges(doc);
    expect(result[0].animated).toBe(true);
  });

  it('maps all 3 edge styles', () => {
    const styles = ['solid', 'dashed', 'dotted'] as const;
    const doc = makeDoc({
      edges: styles.map((style, i) => ({
        id: `e${i}`,
        source: 'n1',
        target: 'n2',
        style,
        arrow: 'normal' as const,
      })),
    });

    const result = docToFlowEdges(doc);
    expect(result).toHaveLength(3);
    result.forEach((edge, i) => {
      expect(edge.data?.style).toBe(styles[i]);
    });
  });

  it('maps all 4 arrow types', () => {
    const arrows = ['normal', 'arrow', 'open', 'none'] as const;
    const doc = makeDoc({
      edges: arrows.map((arrow, i) => ({
        id: `e${i}`,
        source: 'n1',
        target: 'n2',
        style: 'solid' as const,
        arrow,
      })),
    });

    const result = docToFlowEdges(doc);
    expect(result).toHaveLength(4);
    result.forEach((edge, i) => {
      expect(edge.data?.arrow).toBe(arrows[i]);
    });
  });

  it('maps multiple edges with mixed properties', () => {
    const doc = makeDoc({
      edges: [
        {
          id: 'e1',
          source: 'n1',
          target: 'n2',
          label: 'req',
          style: 'solid',
          arrow: 'arrow',
          animated: false,
        },
        {
          id: 'e2',
          source: 'n2',
          target: 'n3',
          style: 'dashed',
          arrow: 'none',
          animated: true,
        },
      ],
    });

    const result = docToFlowEdges(doc);
    expect(result).toHaveLength(2);
    expect(result[0].data?.style).toBe('solid');
    expect(result[0].label).toBe('req');
    expect(result[1].data?.style).toBe('dashed');
    expect(result[1].animated).toBe(true);
  });
});

describe('docToFlowNodes – NaN protection', () => {
  it('uses DEFAULT_NODE_WIDTH / DEFAULT_NODE_HEIGHT when width or height is 0', () => {
    const doc = makeDoc({
      nodes: [
        {
          id: 'n1',
          label: 'Bad',
          x: 10,
          y: 20,
          width: 0,
          height: 0,
          shape: 'rectangle',
          color: 'default',
          pinned: false,
        },
      ],
    });

    const [node] = docToFlowNodes(doc);
    expect(node.width).toBeGreaterThan(0);
    expect(node.height).toBeGreaterThan(0);
    expect(node.data.width).toBeGreaterThan(0);
    expect(node.data.height).toBeGreaterThan(0);
  });

  it('uses 0 as default for undefined x / y to avoid NaN positions', () => {
    const doc = makeDoc({
      nodes: [
        {
          id: 'n1',
          label: 'Missing coords',
          // x and y intentionally omitted (simulates old file format)
          x: undefined as unknown as number,
          y: undefined as unknown as number,
          width: 160,
          height: 48,
          shape: 'rectangle',
          color: 'default',
          pinned: false,
        },
      ],
    });

    const [node] = docToFlowNodes(doc);
    expect(node.position.x).toBe(0);
    expect(node.position.y).toBe(0);
    expect(Number.isNaN(node.position.x)).toBe(false);
    expect(Number.isNaN(node.position.y)).toBe(false);
  });

  it('node width and height in data are always positive numbers (never NaN)', () => {
    const doc = makeDoc({
      nodes: [
        {
          id: 'n1',
          label: 'NaN dims',
          x: 0,
          y: 0,
          width: NaN,
          height: NaN,
          shape: 'rounded',
          color: 'blue',
          pinned: false,
        },
      ],
    });

    const [node] = docToFlowNodes(doc);
    expect(Number.isNaN(node.width)).toBe(false);
    expect(Number.isNaN(node.height)).toBe(false);
    expect(Number.isNaN(node.data.width)).toBe(false);
    expect(Number.isNaN(node.data.height)).toBe(false);
  });
});
// ---------------------------------------------------------------------------
// Group rendering: resolveGroupOrigin and docToFlowGroupNodes
// ---------------------------------------------------------------------------

function makeGroupDoc(): DiagramDocument {
  return {
    meta: { title: 'T', created: '2025-01-01T00:00:00Z', modified: '2025-01-01T00:00:00Z' },
    nodes: [
      { id: 'n1', label: 'A', x: 200, y: 300, width: 160, height: 48, shape: 'rectangle', color: 'default', pinned: false, group: 'g1' },
      { id: 'n2', label: 'B', x: 400, y: 300, width: 160, height: 48, shape: 'rectangle', color: 'default', pinned: false, group: 'g1' },
    ],
    edges: [],
    groups: [{ id: 'g1', label: 'Group' }],
  };
}

describe('resolveGroupOrigin', () => {
  it('uses bounds-based origin from children when children exist', () => {
    const doc = makeGroupDoc();
    const group = doc.groups![0];
    const origin = resolveGroupOrigin(group, doc.nodes);
    expect(origin.x).toBe(200 - GROUP_PADDING);
    expect(origin.y).toBe(300 - GROUP_PADDING - GROUP_LABEL_HEIGHT);
  });

  it('ignores stale group.x/y when children exist (bug fix)', () => {
    const doc = makeGroupDoc();
    const group = { ...doc.groups![0], x: 999, y: 999 };
    const origin = resolveGroupOrigin(group, doc.nodes);
    expect(origin.x).toBe(200 - GROUP_PADDING);
    expect(origin.y).toBe(300 - GROUP_PADDING - GROUP_LABEL_HEIGHT);
    expect(origin.x).not.toBe(999);
    expect(origin.y).not.toBe(999);
  });

  it('falls back to stored x/y when group has no children', () => {
    const group = { id: 'g-empty', label: 'Empty', x: 50, y: 80 };
    const origin = resolveGroupOrigin(group, []);
    expect(origin.x).toBe(50);
    expect(origin.y).toBe(80);
  });

  it('falls back to origin (0,0) when group has no children and no stored position', () => {
    const group = { id: 'g-empty', label: 'Empty' };
    const origin = resolveGroupOrigin(group, []);
    expect(origin.x).toBe(0);
    expect(origin.y).toBe(0);
  });
});

describe('docToFlowGroupNodes – group renders at bounds-derived position', () => {
  it('group position matches bounding box of children, ignoring stale stored x/y', () => {
    const doc = makeGroupDoc();
    doc.groups![0] = { id: 'g1', label: 'Group', x: 5000, y: 5000 };
    const groupNodes = docToFlowGroupNodes(doc);
    expect(groupNodes).toHaveLength(1);
    expect(groupNodes[0].position.x).toBe(200 - GROUP_PADDING);
    expect(groupNodes[0].position.y).toBe(300 - GROUP_PADDING - GROUP_LABEL_HEIGHT);
  });

  it('child nodes are positioned relative to bounds-derived group origin', () => {
    const doc = makeGroupDoc();
    doc.groups![0] = { id: 'g1', label: 'Group', x: 5000, y: 5000 };
    const childNodes = docToFlowNodes(doc);
    const expectedOriginX = 200 - GROUP_PADDING;
    const expectedOriginY = 300 - GROUP_PADDING - GROUP_LABEL_HEIGHT;
    const n1 = childNodes.find((n) => n.id === 'n1')!;
    expect(n1.position.x).toBe(200 - expectedOriginX);
    expect(n1.position.y).toBe(300 - expectedOriginY);
  });
});