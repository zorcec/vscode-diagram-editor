import { describe, it, expect } from 'vitest';
import { computePartialLayout, computeFullLayout } from './layoutEngine';
import type { DiagramDocument } from '../types/DiagramDocument';

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

describe('computePartialLayout', () => {
  it('should return empty array when no nodes need layout', () => {
    const doc = makeDoc({
      nodes: [
        {
          id: 'a',
          label: 'A',
          x: 100,
          y: 100,
          width: 160,
          height: 48,
          shape: 'rectangle',
          color: 'default',
          pinned: true,
        },
      ],
    });
    const results = computePartialLayout(doc);
    expect(results).toHaveLength(0);
  });

  it('should return empty array for empty document', () => {
    const doc = makeDoc();
    const results = computePartialLayout(doc);
    expect(results).toHaveLength(0);
  });

  it('should not move pinned nodes', () => {
    const doc = makeDoc({
      nodes: [
        {
          id: 'a',
          label: 'A',
          x: 999,
          y: 999,
          width: 160,
          height: 48,
          shape: 'rectangle',
          color: 'default',
          pinned: true,
        },
      ],
    });
    const results = computePartialLayout(doc);
    expect(results).toHaveLength(0);
  });

  it('should position unpinned nodes at origin', () => {
    const doc = makeDoc({
      nodes: [
        {
          id: 'a',
          label: 'A',
          x: 0,
          y: 0,
          width: 160,
          height: 48,
          shape: 'rectangle',
          color: 'default',
          pinned: false,
        },
      ],
    });
    const results = computePartialLayout(doc);
    expect(results).toHaveLength(1);
    expect(results[0].nodeId).toBe('a');
    expect(typeof results[0].x).toBe('number');
    expect(typeof results[0].y).toBe('number');
  });

  it('should not move unpinned nodes that already have positions', () => {
    const doc = makeDoc({
      nodes: [
        {
          id: 'a',
          label: 'A',
          x: 200,
          y: 200,
          width: 160,
          height: 48,
          shape: 'rectangle',
          color: 'default',
          pinned: false,
        },
      ],
    });
    const results = computePartialLayout(doc);
    expect(results).toHaveLength(0);
  });

  it('should layout multiple unpinned nodes at origin', () => {
    const doc = makeDoc({
      nodes: [
        {
          id: 'a',
          label: 'A',
          x: 0,
          y: 0,
          width: 160,
          height: 48,
          shape: 'rectangle',
          color: 'default',
          pinned: false,
        },
        {
          id: 'b',
          label: 'B',
          x: 0,
          y: 0,
          width: 160,
          height: 48,
          shape: 'rectangle',
          color: 'default',
          pinned: false,
        },
      ],
      edges: [
        {
          id: 'e1',
          source: 'a',
          target: 'b',
          style: 'solid',
          arrow: 'arrow',
        },
      ],
    });
    const results = computePartialLayout(doc);
    expect(results).toHaveLength(2);

    const aResult = results.find((r) => r.nodeId === 'a')!;
    const bResult = results.find((r) => r.nodeId === 'b')!;

    // With LR layout, a should be to the left of b
    expect(aResult.x).toBeLessThan(bResult.x);
  });

  it('should handle nodes with custom config', () => {
    const doc = makeDoc({
      nodes: [
        {
          id: 'a',
          label: 'A',
          x: 0,
          y: 0,
          width: 160,
          height: 48,
          shape: 'rectangle',
          color: 'default',
          pinned: false,
        },
      ],
    });
    const results = computePartialLayout(doc, {
      rankdir: 'TB',
      ranksep: 100,
      nodesep: 50,
      marginx: 20,
      marginy: 20,
    });
    expect(results).toHaveLength(1);
    expect(results[0].x).toBe(20);
    expect(results[0].y).toBe(20);
  });

  it('should handle chains of nodes', () => {
    const doc = makeDoc({
      nodes: [
        { id: 'a', label: 'A', x: 0, y: 0, width: 160, height: 48, shape: 'rectangle', color: 'default', pinned: false },
        { id: 'b', label: 'B', x: 0, y: 0, width: 160, height: 48, shape: 'rectangle', color: 'default', pinned: false },
        { id: 'c', label: 'C', x: 0, y: 0, width: 160, height: 48, shape: 'rectangle', color: 'default', pinned: false },
      ],
      edges: [
        { id: 'e1', source: 'a', target: 'b', style: 'solid', arrow: 'arrow' },
        { id: 'e2', source: 'b', target: 'c', style: 'solid', arrow: 'arrow' },
      ],
    });
    const results = computePartialLayout(doc);
    expect(results).toHaveLength(3);

    const positions = results.sort((a, b) => a.x - b.x);
    expect(positions[0].nodeId).toBe('a');
    expect(positions[1].nodeId).toBe('b');
    expect(positions[2].nodeId).toBe('c');
  });

  it('should handle cycles without crashing', () => {
    const doc = makeDoc({
      nodes: [
        { id: 'a', label: 'A', x: 0, y: 0, width: 160, height: 48, shape: 'rectangle', color: 'default', pinned: false },
        { id: 'b', label: 'B', x: 0, y: 0, width: 160, height: 48, shape: 'rectangle', color: 'default', pinned: false },
      ],
      edges: [
        { id: 'e1', source: 'a', target: 'b', style: 'solid', arrow: 'arrow' },
        { id: 'e2', source: 'b', target: 'a', style: 'solid', arrow: 'arrow' },
      ],
    });
    const results = computePartialLayout(doc);
    expect(results).toHaveLength(2);
  });
});

describe('computeFullLayout', () => {
  it('should return empty array for empty document', () => {
    const doc = makeDoc();
    const results = computeFullLayout(doc);
    expect(results).toHaveLength(0);
  });

  it('should layout all nodes regardless of pinned status', () => {
    const doc = makeDoc({
      nodes: [
        {
          id: 'a',
          label: 'A',
          x: 999,
          y: 999,
          width: 160,
          height: 48,
          shape: 'rectangle',
          color: 'default',
          pinned: true,
        },
        {
          id: 'b',
          label: 'B',
          x: 200,
          y: 200,
          width: 160,
          height: 48,
          shape: 'rectangle',
          color: 'default',
          pinned: false,
        },
      ],
    });
    const results = computeFullLayout(doc);
    expect(results).toHaveLength(2);
  });

  it('should produce different positions for connected nodes', () => {
    const doc = makeDoc({
      nodes: [
        { id: 'a', label: 'A', x: 0, y: 0, width: 160, height: 48, shape: 'rectangle', color: 'default', pinned: false },
        { id: 'b', label: 'B', x: 0, y: 0, width: 160, height: 48, shape: 'rectangle', color: 'default', pinned: false },
      ],
      edges: [
        { id: 'e1', source: 'a', target: 'b', style: 'solid', arrow: 'arrow' },
      ],
    });
    const results = computeFullLayout(doc);
    expect(results).toHaveLength(2);
    const aPos = results.find((r) => r.nodeId === 'a')!;
    const bPos = results.find((r) => r.nodeId === 'b')!;
    expect(aPos.x !== bPos.x || aPos.y !== bPos.y).toBe(true);
  });
});
