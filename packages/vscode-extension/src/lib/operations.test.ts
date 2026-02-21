import { describe, it, expect, beforeEach } from 'vitest';
import { applyOps, createEmptyDocument } from './operations';
import type { DiagramDocument } from '../types/DiagramDocument';
import type { SemanticOp } from '../types/operations';

let idCounter = 0;
const mockId = () => `gen_${++idCounter}`;

function makeBaseDoc(): DiagramDocument {
  return {
    meta: {
      title: 'Test',
      created: '2025-01-01T00:00:00Z',
      modified: '2025-01-01T00:00:00Z',
    },
    nodes: [
      {
        id: 'n1',
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
        id: 'n2',
        label: 'B',
        x: 300,
        y: 100,
        width: 160,
        height: 48,
        shape: 'rectangle',
        color: 'blue',
        pinned: true,
      },
    ],
    edges: [
      {
        id: 'e1',
        source: 'n1',
        target: 'n2',
        style: 'solid',
        arrow: 'arrow',
      },
    ],
  };
}

describe('createEmptyDocument', () => {
  it('should create a document with default title', () => {
    const doc = createEmptyDocument();
    expect(doc.meta.title).toBe('Untitled Diagram');
    expect(doc.nodes).toHaveLength(0);
    expect(doc.edges).toHaveLength(0);
    expect(doc.viewport).toEqual({ x: 0, y: 0, zoom: 1 });
  });

  it('should create a document with custom title', () => {
    const doc = createEmptyDocument('My Diagram');
    expect(doc.meta.title).toBe('My Diagram');
  });

  it('should set ISO8601 timestamps', () => {
    const before = new Date().toISOString();
    const doc = createEmptyDocument();
    const after = new Date().toISOString();
    expect(doc.meta.created >= before).toBe(true);
    expect(doc.meta.created <= after).toBe(true);
  });
});

describe('applyOps - add_node', () => {
  beforeEach(() => {
    idCounter = 0;
  });

  it('should add a node with defaults', () => {
    const doc = makeBaseDoc();
    const result = applyOps(
      doc,
      [{ op: 'add_node', node: { label: 'New' } }],
      mockId,
    );
    expect(result.success).toBe(true);
    expect(result.document!.nodes).toHaveLength(3);
    const newNode = result.document!.nodes[2];
    expect(newNode.label).toBe('New');
    expect(newNode.id).toBe('gen_1');
    expect(newNode.x).toBe(0);
    expect(newNode.y).toBe(0);
    expect(newNode.width).toBe(160);
    expect(newNode.height).toBe(48);
    expect(newNode.shape).toBe('rectangle');
    expect(newNode.color).toBe('default');
    expect(newNode.pinned).toBe(false);
  });

  it('should add a node with custom properties', () => {
    const doc = makeBaseDoc();
    const result = applyOps(
      doc,
      [
        {
          op: 'add_node',
          node: {
            label: 'Custom',
            shape: 'diamond',
            color: 'red',
            notes: 'Decision node',
          },
        },
      ],
      mockId,
    );
    expect(result.success).toBe(true);
    const newNode = result.document!.nodes[2];
    expect(newNode.shape).toBe('diamond');
    expect(newNode.color).toBe('red');
    expect(newNode.notes).toBe('Decision node');
  });

  it('should add multiple nodes', () => {
    const doc = makeBaseDoc();
    const ops: SemanticOp[] = [
      { op: 'add_node', node: { label: 'X' } },
      { op: 'add_node', node: { label: 'Y' } },
    ];
    const result = applyOps(doc, ops, mockId);
    expect(result.success).toBe(true);
    expect(result.document!.nodes).toHaveLength(4);
  });

  it('should not mutate the original document', () => {
    const doc = makeBaseDoc();
    const originalLength = doc.nodes.length;
    applyOps(doc, [{ op: 'add_node', node: { label: 'New' } }], mockId);
    expect(doc.nodes).toHaveLength(originalLength);
  });
});

describe('applyOps - remove_node', () => {
  it('should remove a node', () => {
    const doc = makeBaseDoc();
    const result = applyOps(doc, [{ op: 'remove_node', id: 'n1' }], mockId);
    expect(result.success).toBe(true);
    expect(result.document!.nodes).toHaveLength(1);
    expect(result.document!.nodes[0].id).toBe('n2');
  });

  it('should remove connected edges when removing a node', () => {
    const doc = makeBaseDoc();
    const result = applyOps(doc, [{ op: 'remove_node', id: 'n1' }], mockId);
    expect(result.success).toBe(true);
    expect(result.document!.edges).toHaveLength(0);
  });

  it('should fail when removing non-existent node', () => {
    const doc = makeBaseDoc();
    const result = applyOps(
      doc,
      [{ op: 'remove_node', id: 'nonexistent' }],
      mockId,
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('should not mutate the original document', () => {
    const doc = makeBaseDoc();
    applyOps(doc, [{ op: 'remove_node', id: 'n1' }], mockId);
    expect(doc.nodes).toHaveLength(2);
    expect(doc.edges).toHaveLength(1);
  });
});

describe('applyOps - update_node', () => {
  it('should update node label', () => {
    const doc = makeBaseDoc();
    const result = applyOps(
      doc,
      [{ op: 'update_node', id: 'n1', changes: { label: 'Updated' } }],
      mockId,
    );
    expect(result.success).toBe(true);
    expect(result.document!.nodes[0].label).toBe('Updated');
  });

  it('should update node shape and color', () => {
    const doc = makeBaseDoc();
    const result = applyOps(
      doc,
      [
        {
          op: 'update_node',
          id: 'n1',
          changes: { shape: 'diamond', color: 'green' },
        },
      ],
      mockId,
    );
    expect(result.success).toBe(true);
    expect(result.document!.nodes[0].shape).toBe('diamond');
    expect(result.document!.nodes[0].color).toBe('green');
  });

  it('should update position of unpinned node', () => {
    const doc = makeBaseDoc();
    const result = applyOps(
      doc,
      [{ op: 'update_node', id: 'n1', changes: { x: 500, y: 500 } }],
      mockId,
    );
    expect(result.success).toBe(true);
    expect(result.document!.nodes[0].x).toBe(500);
    expect(result.document!.nodes[0].y).toBe(500);
  });

  it('should NOT update position of pinned node', () => {
    const doc = makeBaseDoc();
    const result = applyOps(
      doc,
      [{ op: 'update_node', id: 'n2', changes: { x: 999, y: 999 } }],
      mockId,
    );
    expect(result.success).toBe(true);
    expect(result.document!.nodes[1].x).toBe(300);
    expect(result.document!.nodes[1].y).toBe(100);
  });

  it('should allow updating label of pinned node', () => {
    const doc = makeBaseDoc();
    const result = applyOps(
      doc,
      [{ op: 'update_node', id: 'n2', changes: { label: 'New Label' } }],
      mockId,
    );
    expect(result.success).toBe(true);
    expect(result.document!.nodes[1].label).toBe('New Label');
  });

  it('should fail when updating non-existent node', () => {
    const doc = makeBaseDoc();
    const result = applyOps(
      doc,
      [
        {
          op: 'update_node',
          id: 'nonexistent',
          changes: { label: 'X' },
        },
      ],
      mockId,
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('should set pinned via update_node', () => {
    const doc = makeBaseDoc();
    const result = applyOps(
      doc,
      [
        {
          op: 'update_node',
          id: 'n1',
          changes: { pinned: true, x: 200, y: 200 },
        },
      ],
      mockId,
    );
    expect(result.success).toBe(true);
    const node = result.document!.nodes[0];
    expect(node.pinned).toBe(true);
    expect(node.x).toBe(200);
    expect(node.y).toBe(200);
  });
});

describe('applyOps - add_edge', () => {
  beforeEach(() => {
    idCounter = 0;
  });

  it('should add an edge between existing nodes', () => {
    const doc = makeBaseDoc();
    const result = applyOps(
      doc,
      [{ op: 'add_edge', edge: { source: 'n2', target: 'n1' } }],
      mockId,
    );
    expect(result.success).toBe(true);
    expect(result.document!.edges).toHaveLength(2);
    const newEdge = result.document!.edges[1];
    expect(newEdge.source).toBe('n2');
    expect(newEdge.target).toBe('n1');
    expect(newEdge.style).toBe('solid');
    expect(newEdge.arrow).toBe('arrow');
  });

  it('should add an edge with label and style', () => {
    const doc = makeBaseDoc();
    const result = applyOps(
      doc,
      [
        {
          op: 'add_edge',
          edge: {
            source: 'n2',
            target: 'n1',
            label: 'returns',
            style: 'dashed',
            arrow: 'open',
          },
        },
      ],
      mockId,
    );
    expect(result.success).toBe(true);
    const newEdge = result.document!.edges[1];
    expect(newEdge.label).toBe('returns');
    expect(newEdge.style).toBe('dashed');
    expect(newEdge.arrow).toBe('open');
  });

  it('should fail when source node does not exist', () => {
    const doc = makeBaseDoc();
    const result = applyOps(
      doc,
      [{ op: 'add_edge', edge: { source: 'bad', target: 'n1' } }],
      mockId,
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('Source node');
  });

  it('should fail when target node does not exist', () => {
    const doc = makeBaseDoc();
    const result = applyOps(
      doc,
      [{ op: 'add_edge', edge: { source: 'n1', target: 'bad' } }],
      mockId,
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('Target node');
  });
});

describe('applyOps - remove_edge', () => {
  it('should remove an edge', () => {
    const doc = makeBaseDoc();
    const result = applyOps(doc, [{ op: 'remove_edge', id: 'e1' }], mockId);
    expect(result.success).toBe(true);
    expect(result.document!.edges).toHaveLength(0);
  });

  it('should fail when removing non-existent edge', () => {
    const doc = makeBaseDoc();
    const result = applyOps(
      doc,
      [{ op: 'remove_edge', id: 'nonexistent' }],
      mockId,
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('should not affect nodes when removing an edge', () => {
    const doc = makeBaseDoc();
    const result = applyOps(doc, [{ op: 'remove_edge', id: 'e1' }], mockId);
    expect(result.success).toBe(true);
    expect(result.document!.nodes).toHaveLength(2);
  });
});

describe('applyOps - update_edge', () => {
  it('should update edge label', () => {
    const doc = makeBaseDoc();
    const result = applyOps(
      doc,
      [{ op: 'update_edge', id: 'e1', changes: { label: 'connects' } }],
      mockId,
    );
    expect(result.success).toBe(true);
    expect(result.document!.edges[0].label).toBe('connects');
  });

  it('should update edge style and arrow', () => {
    const doc = makeBaseDoc();
    const result = applyOps(
      doc,
      [
        {
          op: 'update_edge',
          id: 'e1',
          changes: { style: 'dotted', arrow: 'none' },
        },
      ],
      mockId,
    );
    expect(result.success).toBe(true);
    expect(result.document!.edges[0].style).toBe('dotted');
    expect(result.document!.edges[0].arrow).toBe('none');
  });

  it('should fail when updating non-existent edge', () => {
    const doc = makeBaseDoc();
    const result = applyOps(
      doc,
      [{ op: 'update_edge', id: 'bad', changes: { label: 'X' } }],
      mockId,
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('should fail when changing source to non-existent node', () => {
    const doc = makeBaseDoc();
    const result = applyOps(
      doc,
      [{ op: 'update_edge', id: 'e1', changes: { source: 'bad' } }],
      mockId,
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('Source node');
  });

  it('should fail when changing target to non-existent node', () => {
    const doc = makeBaseDoc();
    const result = applyOps(
      doc,
      [{ op: 'update_edge', id: 'e1', changes: { target: 'bad' } }],
      mockId,
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('Target node');
  });

  it('should update animated property', () => {
    const doc = makeBaseDoc();
    const result = applyOps(
      doc,
      [{ op: 'update_edge', id: 'e1', changes: { animated: true } }],
      mockId,
    );
    expect(result.success).toBe(true);
    expect(result.document!.edges[0].animated).toBe(true);
  });
});

describe('applyOps - compound operations', () => {
  beforeEach(() => {
    idCounter = 0;
  });

  it('should apply multiple operations in sequence', () => {
    const doc = makeBaseDoc();
    const ops: SemanticOp[] = [
      { op: 'add_node', node: { label: 'C' } },
      { op: 'update_node', id: 'n1', changes: { label: 'Updated A' } },
    ];
    const result = applyOps(doc, ops, mockId);
    expect(result.success).toBe(true);
    expect(result.document!.nodes).toHaveLength(3);
    expect(result.document!.nodes[0].label).toBe('Updated A');
    expect(result.document!.nodes[2].label).toBe('C');
  });

  it('should add node then edge to the new node', () => {
    const doc = makeBaseDoc();
    const ops: SemanticOp[] = [
      { op: 'add_node', node: { label: 'C' } },
      { op: 'add_edge', edge: { source: 'n1', target: 'gen_1' } },
    ];
    const result = applyOps(doc, ops, mockId);
    expect(result.success).toBe(true);
    expect(result.document!.edges).toHaveLength(2);
  });

  it('should update meta.modified timestamp', () => {
    const doc = makeBaseDoc();
    const result = applyOps(
      doc,
      [{ op: 'update_node', id: 'n1', changes: { label: 'Z' } }],
      mockId,
    );
    expect(result.success).toBe(true);
    expect(result.document!.meta.modified).not.toBe(doc.meta.modified);
  });

  it('should stop on first failing operation', () => {
    const doc = makeBaseDoc();
    const ops: SemanticOp[] = [
      { op: 'update_node', id: 'nonexistent', changes: { label: 'X' } },
      { op: 'add_node', node: { label: 'C' } },
    ];
    const result = applyOps(doc, ops, mockId);
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// agentContext auto-generation
// ---------------------------------------------------------------------------

describe('applyOps — agentContext auto-generation', () => {
  beforeEach(() => { idCounter = 0; });

  it('generates agentContext after a successful op', () => {
    const doc = makeBaseDoc();
    const result = applyOps(doc, [{ op: 'add_node', node: { label: 'New' } }], mockId);

    expect(result.success).toBe(true);
    expect(result.document!.agentContext).toBeDefined();
    expect(result.document!.agentContext!.format).toBe('diagramflow-v1');
  });

  it('agentContext.nodeIndex contains all node labels', () => {
    const doc = makeBaseDoc();
    const result = applyOps(doc, [{ op: 'add_node', node: { label: 'C' } }], mockId);

    const labels = result.document!.agentContext!.nodeIndex.map((n) => n.label);
    expect(labels).toContain('A');
    expect(labels).toContain('B');
    expect(labels).toContain('C');
  });

  it('agentContext.edgeIndex maps IDs to labels', () => {
    const doc = makeBaseDoc();
    // base doc has n1→n2 edge e1
    const result = applyOps(doc, [{ op: 'update_node', id: 'n1', changes: { label: 'A' } }], mockId);

    const edge = result.document!.agentContext!.edgeIndex[0];
    expect(edge.from).toBe('A');
    expect(edge.to).toBe('B');
  });

  it('does not generate agentContext on validation failure', () => {
    const doc = makeBaseDoc();
    const result = applyOps(doc, [{ op: 'remove_node', id: 'nonexistent' }], mockId);

    expect(result.success).toBe(false);
    expect(result.document).toBeUndefined();
  });

  it('agentContext.summary includes title and node count', () => {
    const doc = makeBaseDoc();
    const result = applyOps(doc, [{ op: 'update_node', id: 'n1', changes: { label: 'n1' } }], mockId);

    const summary = result.document!.agentContext!.summary;
    expect(summary).toContain('"Test"');
    expect(summary).toContain('2 nodes');
    expect(summary).toContain('1 edge');
  });
});
