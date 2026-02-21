import { describe, it, expect } from 'vitest';
import { generateAgentContext } from './agentContext';
import type { DiagramDocument } from '../types/DiagramDocument';

function makeDoc(overrides: Partial<DiagramDocument> = {}): DiagramDocument {
  const now = '2025-01-01T00:00:00.000Z';
  return {
    meta: { title: 'Test Diagram', created: now, modified: now },
    nodes: [],
    edges: [],
    ...overrides,
  };
}

describe('generateAgentContext', () => {
  it('includes the diagramflow-v1 format marker', () => {
    const ctx = generateAgentContext(makeDoc());
    expect(ctx.format).toBe('diagramflow-v1');
  });

  it('sets generatedAt to an ISO-8601 timestamp', () => {
    const before = Date.now();
    const ctx = generateAgentContext(makeDoc());
    const ts = new Date(ctx.generatedAt).getTime();
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(Date.now());
  });

  it('describes an empty diagram', () => {
    const ctx = generateAgentContext(makeDoc({ meta: { title: 'Empty', created: '', modified: '' } }));
    expect(ctx.summary).toContain('"Empty"');
    expect(ctx.summary).toContain('empty');
    expect(ctx.nodeIndex).toHaveLength(0);
    expect(ctx.edgeIndex).toHaveLength(0);
  });

  it('includes node labels in the summary', () => {
    const doc = makeDoc({
      nodes: [
        { id: 'n1', label: 'API Gateway', x: 0, y: 0, width: 160, height: 48, shape: 'rectangle', color: 'default', pinned: false },
        { id: 'n2', label: 'Auth Service', x: 200, y: 0, width: 160, height: 48, shape: 'rectangle', color: 'blue', pinned: false },
      ],
      edges: [
        { id: 'e1', source: 'n1', target: 'n2', style: 'solid', arrow: 'arrow' },
      ],
    });
    const ctx = generateAgentContext(doc);
    expect(ctx.summary).toContain('"Test Diagram"');
    expect(ctx.summary).toContain('2 nodes');
    expect(ctx.summary).toContain('1 edge');
    expect(ctx.summary).toContain('"API Gateway"');
  });

  it('builds nodeIndex with id and label', () => {
    const doc = makeDoc({
      nodes: [
        { id: 'n1', label: 'Frontend', x: 0, y: 0, width: 160, height: 48, shape: 'rectangle', color: 'default', pinned: false, notes: 'React SPA' },
      ],
    });
    const ctx = generateAgentContext(doc);
    expect(ctx.nodeIndex).toHaveLength(1);
    expect(ctx.nodeIndex[0]).toMatchObject({ id: 'n1', label: 'Frontend', notes: 'React SPA' });
  });

  it('omits notes from nodeIndex when not set', () => {
    const doc = makeDoc({
      nodes: [
        { id: 'n1', label: 'Node', x: 0, y: 0, width: 160, height: 48, shape: 'rectangle', color: 'default', pinned: false },
      ],
    });
    const ctx = generateAgentContext(doc);
    expect(ctx.nodeIndex[0].notes).toBeUndefined();
  });

  it('maps edge source/target to labels in edgeIndex', () => {
    const doc = makeDoc({
      nodes: [
        { id: 'src', label: 'Browser', x: 0, y: 0, width: 160, height: 48, shape: 'rectangle', color: 'default', pinned: false },
        { id: 'tgt', label: 'CDN', x: 200, y: 0, width: 160, height: 48, shape: 'rectangle', color: 'default', pinned: false },
      ],
      edges: [
        { id: 'e1', source: 'src', target: 'tgt', label: 'HTTPS', style: 'solid', arrow: 'arrow' },
      ],
    });
    const ctx = generateAgentContext(doc);
    expect(ctx.edgeIndex).toHaveLength(1);
    expect(ctx.edgeIndex[0]).toMatchObject({ from: 'Browser', to: 'CDN', label: 'HTTPS' });
  });

  it('omits solid style from edgeIndex (it is the default)', () => {
    const doc = makeDoc({
      nodes: [
        { id: 'a', label: 'A', x: 0, y: 0, width: 160, height: 48, shape: 'rectangle', color: 'default', pinned: false },
        { id: 'b', label: 'B', x: 200, y: 0, width: 160, height: 48, shape: 'rectangle', color: 'default', pinned: false },
      ],
      edges: [{ id: 'e', source: 'a', target: 'b', style: 'solid', arrow: 'arrow' }],
    });
    const ctx = generateAgentContext(doc);
    expect(ctx.edgeIndex[0].style).toBeUndefined();
  });

  it('includes non-solid style in edgeIndex', () => {
    const doc = makeDoc({
      nodes: [
        { id: 'a', label: 'A', x: 0, y: 0, width: 160, height: 48, shape: 'rectangle', color: 'default', pinned: false },
        { id: 'b', label: 'B', x: 200, y: 0, width: 160, height: 48, shape: 'rectangle', color: 'default', pinned: false },
      ],
      edges: [{ id: 'e', source: 'a', target: 'b', style: 'dashed', arrow: 'arrow' }],
    });
    const ctx = generateAgentContext(doc);
    expect(ctx.edgeIndex[0].style).toBe('dashed');
  });

  it('builds groupIndex from groups and node assignments', () => {
    const doc = makeDoc({
      groups: [
        { id: 'g1', label: 'Frontend Layer' },
        { id: 'g2', label: 'Backend Layer' },
      ],
      nodes: [
        { id: 'n1', label: 'React App', x: 0, y: 0, width: 160, height: 48, shape: 'rectangle', color: 'default', pinned: false, group: 'g1' },
        { id: 'n2', label: 'API Server', x: 0, y: 0, width: 160, height: 48, shape: 'rectangle', color: 'default', pinned: false, group: 'g2' },
        { id: 'n3', label: 'DB', x: 0, y: 0, width: 160, height: 48, shape: 'rectangle', color: 'default', pinned: false, group: 'g2' },
      ],
      edges: [],
    });
    const ctx = generateAgentContext(doc);
    expect(ctx.groupIndex).toHaveLength(2);
    const fe = ctx.groupIndex.find((g) => g.group === 'Frontend Layer');
    expect(fe?.members).toEqual(['React App']);
    const be = ctx.groupIndex.find((g) => g.group === 'Backend Layer');
    expect(be?.members).toContain('API Server');
    expect(be?.members).toContain('DB');
  });

  it('includes >5 nodes with truncation hint in summary', () => {
    const nodes = Array.from({ length: 8 }, (_, i) => ({
      id: `n${i}`,
      label: `Node ${i}`,
      x: 0, y: 0, width: 160, height: 48,
      shape: 'rectangle' as const,
      color: 'default' as const,
      pinned: false,
    }));
    const doc = makeDoc({ nodes, edges: [] });
    const ctx = generateAgentContext(doc);
    expect(ctx.summary).toContain('8 nodes');
    expect(ctx.summary).toContain('and 3 more');
  });

  it('includes usage hint for Copilot tools', () => {
    const ctx = generateAgentContext(makeDoc());
    expect(ctx.usage).toContain('diagramflow_getDiagram');
    expect(ctx.usage).toContain('diagramflow_addNodes');
  });

  it('includes description from meta when present', () => {
    const doc = makeDoc({
      meta: { title: 'My Arch', description: 'Shows the microservices topology.', created: '', modified: '' },
    });
    const ctx = generateAgentContext(doc);
    expect(ctx.summary).toContain('Shows the microservices topology');
  });

  it('handles orphan group assignments gracefully (empty members)', () => {
    const doc = makeDoc({
      groups: [{ id: 'g1', label: 'Empty Group' }],
      nodes: [],
      edges: [],
    });
    const ctx = generateAgentContext(doc);
    expect(ctx.groupIndex[0].members).toHaveLength(0);
  });
});
