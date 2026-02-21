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

  // ── Node-level Tier-1 enrichments ──────────────────────────────────────────

  it('includes node type in nodeIndex when set', () => {
    const doc = makeDoc({
      nodes: [
        { id: 'n1', label: 'Order DB', x: 0, y: 0, width: 160, height: 48, shape: 'cylinder', color: 'default', pinned: false, type: 'Database' },
      ],
    });
    const ctx = generateAgentContext(doc);
    expect(ctx.nodeIndex[0].type).toBe('Database');
  });

  it('omits type from nodeIndex when not set', () => {
    const doc = makeDoc({
      nodes: [{ id: 'n1', label: 'Node', x: 0, y: 0, width: 160, height: 48, shape: 'rectangle', color: 'default', pinned: false }],
    });
    const ctx = generateAgentContext(doc);
    expect(ctx.nodeIndex[0].type).toBeUndefined();
  });

  it('includes tags in nodeIndex when set', () => {
    const doc = makeDoc({
      nodes: [
        { id: 'n1', label: 'Legacy Gateway', x: 0, y: 0, width: 160, height: 48, shape: 'rectangle', color: 'default', pinned: false, tags: ['deprecated', 'external-facing'] },
      ],
    });
    const ctx = generateAgentContext(doc);
    expect(ctx.nodeIndex[0].tags).toEqual(['deprecated', 'external-facing']);
  });

  it('omits tags from nodeIndex when empty', () => {
    const doc = makeDoc({
      nodes: [
        { id: 'n1', label: 'Node', x: 0, y: 0, width: 160, height: 48, shape: 'rectangle', color: 'default', pinned: false, tags: [] },
      ],
    });
    const ctx = generateAgentContext(doc);
    expect(ctx.nodeIndex[0].tags).toBeUndefined();
  });

  it('includes properties in nodeIndex when set', () => {
    const doc = makeDoc({
      nodes: [
        {
          id: 'n1', label: 'Auth Service', x: 0, y: 0, width: 160, height: 48, shape: 'rectangle', color: 'default', pinned: false,
          properties: { repo: 'github.com/org/auth', team: 'Security Squad', entrypoint: 'src/main.ts' },
        },
      ],
    });
    const ctx = generateAgentContext(doc);
    expect(ctx.nodeIndex[0].properties?.repo).toBe('github.com/org/auth');
    expect(ctx.nodeIndex[0].properties?.team).toBe('Security Squad');
    expect(ctx.nodeIndex[0].properties?.entrypoint).toBe('src/main.ts');
  });

  it('includes securityClassification in nodeIndex when set', () => {
    const doc = makeDoc({
      nodes: [
        { id: 'n1', label: 'PII DB', x: 0, y: 0, width: 160, height: 48, shape: 'cylinder', color: 'default', pinned: false, securityClassification: 'pii-data-store' },
      ],
    });
    const ctx = generateAgentContext(doc);
    expect(ctx.nodeIndex[0].securityClassification).toBe('pii-data-store');
  });

  it('includes deploymentEnvironment in nodeIndex when set', () => {
    const doc = makeDoc({
      nodes: [
        { id: 'n1', label: 'Prod DB', x: 0, y: 0, width: 160, height: 48, shape: 'cylinder', color: 'default', pinned: false, deploymentEnvironment: 'production' },
      ],
    });
    const ctx = generateAgentContext(doc);
    expect(ctx.nodeIndex[0].deploymentEnvironment).toBe('production');
  });

  // ── Edge-level enrichments ─────────────────────────────────────────────────

  it('includes protocol in edgeIndex when set', () => {
    const doc = makeDoc({
      nodes: [
        { id: 'a', label: 'Order Service', x: 0, y: 0, width: 160, height: 48, shape: 'rectangle', color: 'default', pinned: false },
        { id: 'b', label: 'Kafka', x: 200, y: 0, width: 160, height: 48, shape: 'cylinder', color: 'default', pinned: false },
      ],
      edges: [{ id: 'e1', source: 'a', target: 'b', style: 'dashed', arrow: 'arrow', protocol: 'Kafka (async)' }],
    });
    const ctx = generateAgentContext(doc);
    expect(ctx.edgeIndex[0].protocol).toBe('Kafka (async)');
  });

  it('omits protocol from edgeIndex when not set', () => {
    const doc = makeDoc({
      nodes: [
        { id: 'a', label: 'A', x: 0, y: 0, width: 160, height: 48, shape: 'rectangle', color: 'default', pinned: false },
        { id: 'b', label: 'B', x: 200, y: 0, width: 160, height: 48, shape: 'rectangle', color: 'default', pinned: false },
      ],
      edges: [{ id: 'e', source: 'a', target: 'b', style: 'solid', arrow: 'arrow' }],
    });
    const ctx = generateAgentContext(doc);
    expect(ctx.edgeIndex[0].protocol).toBeUndefined();
  });

  it('includes dataTypes in edgeIndex when set', () => {
    const doc = makeDoc({
      nodes: [
        { id: 'a', label: 'Order Service', x: 0, y: 0, width: 160, height: 48, shape: 'rectangle', color: 'default', pinned: false },
        { id: 'b', label: 'Inventory', x: 200, y: 0, width: 160, height: 48, shape: 'rectangle', color: 'default', pinned: false },
      ],
      edges: [{ id: 'e1', source: 'a', target: 'b', style: 'solid', arrow: 'arrow', dataTypes: ['OrderDTO', 'CustomerPII'] }],
    });
    const ctx = generateAgentContext(doc);
    expect(ctx.edgeIndex[0].dataTypes).toEqual(['OrderDTO', 'CustomerPII']);
  });

  // ── Meta-level enrichments ─────────────────────────────────────────────────

  it('includes glossary from meta in agentContext', () => {
    const doc = makeDoc({
      meta: {
        title: 'E-Commerce',
        created: '',
        modified: '',
        glossary: { fulfilment: 'Process of preparing and shipping a placed order' },
      },
    });
    const ctx = generateAgentContext(doc);
    expect(ctx.glossary?.fulfilment).toBe('Process of preparing and shipping a placed order');
  });

  it('omits glossary from agentContext when not set', () => {
    const ctx = generateAgentContext(makeDoc());
    expect(ctx.glossary).toBeUndefined();
  });

  it('includes abstractionLevel in summary when set', () => {
    const doc = makeDoc({
      meta: { title: 'Platform', created: '', modified: '', abstractionLevel: 'container' },
      nodes: [{ id: 'n1', label: 'Service A', x: 0, y: 0, width: 160, height: 48, shape: 'rectangle', color: 'default', pinned: false }],
    });
    const ctx = generateAgentContext(doc);
    expect(ctx.summary).toContain('container');
  });

  it('includes owners in summary when set', () => {
    const doc = makeDoc({
      meta: { title: 'Platform', created: '', modified: '', owners: ['platform-team', 'core-eng'] },
      nodes: [{ id: 'n1', label: 'Service', x: 0, y: 0, width: 160, height: 48, shape: 'rectangle', color: 'default', pinned: false }],
    });
    const ctx = generateAgentContext(doc);
    expect(ctx.summary).toContain('platform-team');
    expect(ctx.summary).toContain('core-eng');
  });

  // ── Insights ───────────────────────────────────────────────────────────────

  it('generates insight for deprecated node via properties.status', () => {
    const doc = makeDoc({
      nodes: [
        { id: 'n1', label: 'Legacy API', x: 0, y: 0, width: 160, height: 48, shape: 'rectangle', color: 'default', pinned: false, properties: { status: 'deprecated' } },
      ],
    });
    const ctx = generateAgentContext(doc);
    expect(ctx.insights).toBeDefined();
    expect(ctx.insights?.some((i) => i.includes('"Legacy API"') && i.includes('deprecated'))).toBe(true);
  });

  it('generates insight for being-replaced-by status', () => {
    const doc = makeDoc({
      nodes: [
        { id: 'n1', label: 'Old Service', x: 0, y: 0, width: 160, height: 48, shape: 'rectangle', color: 'default', pinned: false, properties: { status: 'being-replaced-by:New Service' } },
      ],
    });
    const ctx = generateAgentContext(doc);
    expect(ctx.insights?.some((i) => i.includes('"New Service"'))).toBe(true);
  });

  it('generates insight for deprecated tag', () => {
    const doc = makeDoc({
      nodes: [
        { id: 'n1', label: 'Old Gateway', x: 0, y: 0, width: 160, height: 48, shape: 'rectangle', color: 'default', pinned: false, tags: ['deprecated'] },
      ],
    });
    const ctx = generateAgentContext(doc);
    expect(ctx.insights?.some((i) => i.includes('"Old Gateway"') && i.includes('deprecated'))).toBe(true);
  });

  it('generates insight for pii-data-store securityClassification', () => {
    const doc = makeDoc({
      nodes: [
        { id: 'n1', label: 'Customer DB', x: 0, y: 0, width: 160, height: 48, shape: 'cylinder', color: 'default', pinned: false, securityClassification: 'pii-data-store' },
      ],
    });
    const ctx = generateAgentContext(doc);
    expect(ctx.insights?.some((i) => i.includes('"Customer DB"') && i.includes('pii-data-store'))).toBe(true);
  });

  it('generates insight for security-boundary securityClassification', () => {
    const doc = makeDoc({
      nodes: [
        { id: 'n1', label: 'API Gateway', x: 0, y: 0, width: 160, height: 48, shape: 'rectangle', color: 'default', pinned: false, securityClassification: 'security-boundary' },
      ],
    });
    const ctx = generateAgentContext(doc);
    expect(ctx.insights?.some((i) => i.includes('"API Gateway"') && i.includes('security-boundary'))).toBe(true);
  });

  it('generates insight for technical debt', () => {
    const doc = makeDoc({
      nodes: [
        { id: 'n1', label: 'Order Service', x: 0, y: 0, width: 160, height: 48, shape: 'rectangle', color: 'default', pinned: false, properties: { technicalDebt: 'Synchronous DB calls in hot path, JIRA-1234' } },
      ],
    });
    const ctx = generateAgentContext(doc);
    expect(ctx.insights?.some((i) => i.includes('"Order Service"') && i.includes('JIRA-1234'))).toBe(true);
  });

  it('generates insight for ADR reference', () => {
    const doc = makeDoc({
      nodes: [
        { id: 'n1', label: 'Event Bus', x: 0, y: 0, width: 160, height: 48, shape: 'cylinder', color: 'default', pinned: false, properties: { adr: 'docs/adr/0003-use-kafka.md' } },
      ],
    });
    const ctx = generateAgentContext(doc);
    expect(ctx.insights?.some((i) => i.includes('"Event Bus"') && i.includes('docs/adr/0003-use-kafka.md'))).toBe(true);
  });

  it('omits insights when no special conditions exist', () => {
    const doc = makeDoc({
      nodes: [
        { id: 'n1', label: 'Normal Node', x: 0, y: 0, width: 160, height: 48, shape: 'rectangle', color: 'default', pinned: false },
      ],
    });
    const ctx = generateAgentContext(doc);
    expect(ctx.insights).toBeUndefined();
  });
});
