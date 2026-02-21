# DiagramFlow — VSCode Diagram Editor

## Complete Implementation Specification v2

**Version:** 2.0.0
**Date:** 2025-02-20
**Target agent:** This document is written to be consumed directly by a coding agent. Every architectural decision is made. No open questions remain. Implement top-to-bottom.

---

## Table of Contents

1. [Concept & Philosophy](#1-concept--philosophy)
2. [File Format Specification](#2-file-format-specification)
3. [System Architecture](#3-system-architecture)
4. [Repository Structure](#4-repository-structure)
5. [Extension Host (TypeScript)](#5-extension-host-typescript)
6. [Webview Application (React)](#6-webview-application-react)
7. [Copilot Integration — Language Model Tools](#7-copilot-integration--language-model-tools)
8. [Message Protocol (Extension ↔ Webview)](#8-message-protocol-extension--webview)
9. [Layout Engine](#9-layout-engine)
10. [Node & Edge Types](#10-node--edge-types)
11. [Build System](#11-build-system)
12. [Testing Strategy](#12-testing-strategy)
13. [E2E Testing with Playwright](#13-e2e-testing-with-playwright)
14. [Unit Tests](#14-unit-tests)
15. [Agent Ownership Guidelines](#15-agent-ownership-guidelines)
16. [Implementation Phases](#16-implementation-phases)
17. [Dependencies & Versions](#17-dependencies--versions)

---

## 1. Concept & Philosophy

### What This Is

A VSCode extension that provides a **bidirectional visual diagram editor** with native **GitHub Copilot integration**. Users edit diagrams visually on a canvas. Copilot's agent mode can read and modify diagrams through registered Language Model Tools. The extension does NOT build its own LLM agent — it exposes tools that Copilot invokes automatically.

### Core Design Decisions (non-negotiable)

**Decision 1: JSON is the single source of truth.**
The `.diagram` file on disk is structured JSON. It stores everything: nodes, edges, labels, styles, AND positions. There is no separate layout file, no sidecar, no computed state. What's in the file is exactly what renders.

**Decision 2: LLM edits via semantic operations, not JSON Patch.**
Instead of RFC 6902 JSON Patch (which suffers from index-shift bugs), the extension uses semantic operations: `add_node`, `remove_node`, `update_node`, `add_edge`, `remove_edge`, `update_edge`. These are exposed as Language Model Tools that Copilot invokes directly. The extension translates them to document edits internally.

**Decision 3: Human-positioned nodes are pinned.**
A node touched by the human gets `"pinned": true` in the JSON. The auto-layout engine skips pinned nodes. Only newly-added nodes (which have no position yet) get auto-laid out.

**Decision 4: VSCode undo/redo is free.**
Because the file is a `TextDocument`, every change goes through `WorkspaceEdit.replace()`. This gives us VSCode's undo stack, git diff, and autosave for free without any custom implementation.

**Decision 5: The webview is stateless.**
The webview holds no canonical state. It is a view. If it closes and reopens, it re-renders from the file. This simplifies the architecture enormously.

**Decision 6: No custom LLM panel — Copilot IS the LLM.**
The extension registers Language Model Tools via `vscode.lm.registerTool()`. Copilot's agent mode discovers and invokes these tools when users ask diagram-related questions in chat. No prompt input in the webview. No API key management. No provider switching.

**Decision 7: Export is secondary.**
Mermaid, SVG, and PNG are export targets. They are never the source of truth.

### What Changed from v1

| v1 Approach | v2 Approach | Why |
|---|---|---|
| Custom LLMPanel in webview | Copilot agent mode via Tools API | No API key management, no provider code, leverages existing Copilot UX |
| RFC 6902 JSON Patch for LLM edits | Semantic operations (`add_node`, etc.) | Eliminates index-shift bugs, cleaner LLM tool schemas |
| Raw HTTP to Anthropic/OpenAI/Ollama | `vscode.lm.registerTool()` | Zero provider management, works with any Copilot-supported model |
| 8 node shapes | 4 node shapes (rectangle, rounded, diamond, cylinder) | Simpler to implement and maintain; covers 95% of use cases |
| `$schema` and `meta.version` fields | Removed | Redundant — VSCode tracks document versions internally |
| `x,y >= 0` constraint | Negative coordinates allowed | Canvas panning requires negative coords |
| WebdriverIO for E2E | Playwright + CDP (already scaffolded) | Already set up in the project, more reliable |
| `onNodesChange` debounced 300ms | `onNodeDragStop` for position commits | Cleaner — only fires once per drag, no debounce needed |

---

## 2. File Format Specification

### File Extension

`.diagram`

### Full Schema

```typescript
// types/DiagramDocument.ts — canonical type definition

export type NodeShape =
  | 'rectangle'      // default box
  | 'rounded'        // rounded corners
  | 'diamond'        // decision
  | 'cylinder';      // database

export type EdgeStyle =
  | 'solid'
  | 'dashed'
  | 'dotted';

export type ArrowType =
  | 'arrow'          // → standard
  | 'open'           // ⟶ open
  | 'none';          // — no arrowhead

export type NodeColor =
  | 'default'
  | 'blue'
  | 'green'
  | 'red'
  | 'yellow'
  | 'purple'
  | 'gray';

export interface DiagramNode {
  id: string;            // nanoid(8), e.g. "xkd9f2m1". NEVER auto-increment integers.
  label: string;         // display text, may contain \n for multiline
  x: number;             // canvas x position (pixels). 0 if not yet positioned. May be negative.
  y: number;             // canvas y position (pixels). 0 if not yet positioned. May be negative.
  width: number;         // default 160
  height: number;        // default 48
  shape: NodeShape;      // default 'rectangle'
  color: NodeColor;      // default 'default'
  pinned: boolean;       // true = human has manually positioned this node
  notes?: string;        // optional hover tooltip / annotation
  group?: string;        // optional group/subgraph id this node belongs to
}

export interface DiagramEdge {
  id: string;            // nanoid(8)
  source: string;        // node id
  target: string;        // node id
  label?: string;        // optional edge label
  style: EdgeStyle;      // default 'solid'
  arrow: ArrowType;      // default 'arrow'
  animated?: boolean;    // animated dash flow
}

export interface DiagramGroup {
  id: string;            // nanoid(8)
  label: string;
  color?: NodeColor;
}

export interface DiagramMeta {
  title: string;
  description?: string;
  created: string;       // ISO8601
  modified: string;      // ISO8601
}

export interface DiagramDocument {
  meta: DiagramMeta;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  groups?: DiagramGroup[];
  viewport?: {
    x: number;
    y: number;
    zoom: number;
  };
}
```

### Example Document

```json
{
  "meta": {
    "title": "Auth Service Architecture",
    "created": "2025-02-20T10:00:00Z",
    "modified": "2025-02-20T10:15:00Z"
  },
  "nodes": [
    {
      "id": "xkd9f2m1",
      "label": "Client",
      "x": 80,
      "y": 200,
      "width": 120,
      "height": 48,
      "shape": "rectangle",
      "color": "default",
      "pinned": true
    },
    {
      "id": "p3n8a1zq",
      "label": "Auth Service",
      "x": 300,
      "y": 200,
      "width": 160,
      "height": 48,
      "shape": "rounded",
      "color": "blue",
      "pinned": true
    },
    {
      "id": "m7t2k9wr",
      "label": "Database",
      "x": 520,
      "y": 200,
      "width": 140,
      "height": 48,
      "shape": "cylinder",
      "color": "gray",
      "pinned": false
    }
  ],
  "edges": [
    {
      "id": "e1a2b3c4",
      "source": "xkd9f2m1",
      "target": "p3n8a1zq",
      "label": "JWT request",
      "style": "solid",
      "arrow": "arrow"
    },
    {
      "id": "e5d6e7f8",
      "source": "p3n8a1zq",
      "target": "m7t2k9wr",
      "label": "queries",
      "style": "dashed",
      "arrow": "arrow"
    }
  ],
  "viewport": {
    "x": 0,
    "y": 0,
    "zoom": 1
  }
}
```

### Validation Rules

- `id` fields must be unique across `nodes`, `edges`, and `groups`
- `source` and `target` on edges must reference existing node ids
- `group` on nodes must reference existing group ids
- `width`, `height` must be positive numbers
- `x`, `y` may be any number (negative allowed for canvas panning)

---

## 3. System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    VSCode Extension Host                         │
│                                                                  │
│  ┌──────────────────────┐    ┌────────────────────────────────┐  │
│  │  DiagramEditorProvider│    │   Language Model Tools          │  │
│  │  (CustomTextEditor)   │    │  - diagramflow_getDiagram      │  │
│  │  - resolveEditor()    │    │  - diagramflow_addNodes        │  │
│  │  - updateDocument()   │◄──►│  - diagramflow_removeNodes     │  │
│  │  - onMessage()        │    │  - diagramflow_updateNodes     │  │
│  └──────────┬───────────┘    │  - diagramflow_addEdges        │  │
│             │                 │  - diagramflow_removeEdges     │  │
│             │                 │  - diagramflow_updateEdges     │  │
│             │                 └────────────────────────────────┘  │
│             │ postMessage / onDidReceiveMessage                   │
│             │                                                     │
│   ┌─────────┴─────────┐                                         │
│   │  DiagramService    │  (shared state: active document ref)    │
│   │  - getDocument()   │                                         │
│   │  - applyOps()      │                                         │
│   │  - validate()      │                                         │
│   └───────────────────┘                                          │
└─────────────┼───────────────────────────────────────────────────┘
              │  iframe boundary
┌─────────────┼───────────────────────────────────────────────────┐
│             │           Webview (React)                          │
│  ┌──────────┴───────────────────────────────────────────────┐   │
│  │                    App.tsx                                │   │
│  │   ┌────────────────────────────────────────────────────┐ │   │
│  │   │              CanvasPanel (ReactFlow)                │ │   │
│  │   │  - custom nodes (4 shapes)                         │ │   │
│  │   │  - edge drawing                                    │ │   │
│  │   │  - drag/drop                                       │ │   │
│  │   │  - context menu                                    │ │   │
│  │   │  - toolbar (layout, export, zoom)                  │ │   │
│  │   └────────────────────────────────────────────────────┘ │   │
│  │                                                            │   │
│  │   useVSCodeBridge() hook — handles all postMessage I/O    │   │
│  └────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
              │
              │  Copilot invokes tools via vscode.lm
              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   GitHub Copilot (Agent Mode)                    │
│  User: "add a Redis cache between Auth Service and Database"    │
│  → Copilot selects diagramflow_addNodes tool                    │
│  → Copilot selects diagramflow_addEdges tool                    │
│  → Tools modify the .diagram file                               │
│  → Webview re-renders automatically                             │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow: Human Edits

```
User drags node → onNodeDragStop fires
  → posts { type: 'NODE_DRAGGED', id, position } to extension
  → DiagramService.applyOps([{ op: 'update_node', id, x, y, pinned: true }])
  → WorkspaceEdit.replace() writes new JSON
  → onDidChangeTextDocument fires → posts { type: 'DOCUMENT_UPDATED', doc } back
  → webview updates ReactFlow state from new doc (idempotent, no loop)
```

### Data Flow: Copilot Edits

```
User types in Copilot Chat: "add a cache between API and DB"
  → Copilot determines diagramflow_addNodes + diagramflow_addEdges tools are relevant
  → Copilot invokes diagramflow_addNodes({ nodes: [{ label: "Redis Cache", shape: "cylinder" }] })
  → Tool reads active .diagram document via DiagramService
  → Tool creates node with x=0, y=0, pinned=false
  → DiagramService.applyOps() writes to file
  → Auto-layout runs on unpinned nodes with x=0, y=0
  → Copilot invokes diagramflow_addEdges({ edges: [...] })
  → File updated again → webview re-renders
  → Copilot returns summary to user in chat
```

---

## 4. Repository Structure

```
diagramflow/
├── package.json                    # Extension manifest + contributes.languageModelTools
├── tsconfig.json                   # Extension host TypeScript config
├── tsconfig.webview.json           # Webview TypeScript config
├── esbuild.config.mjs              # Build configuration
├── .vscodeignore
│
├── src/                            # Extension host source
│   ├── extension.ts                # Activation, command + tool registration
│   ├── DiagramEditorProvider.ts    # CustomTextEditorProvider
│   ├── DiagramService.ts           # Shared doc access + semantic operations
│   ├── SchemaValidator.ts          # JSON validation of DiagramDocument
│   ├── ExportService.ts            # SVG / PNG / Mermaid export
│   ├── getWebviewContent.ts        # HTML shell generation
│   ├── types/
│   │   └── DiagramDocument.ts      # Canonical type definitions
│   ├── messages/
│   │   └── protocol.ts             # Extension ↔ Webview message types
│   └── tools/                      # Language Model Tools (Copilot integration)
│       ├── index.ts                # Registers all tools
│       ├── GetDiagramTool.ts       # Read current diagram state
│       ├── GetDiagramTool.test.ts
│       ├── AddNodesTool.ts         # Add one or more nodes
│       ├── AddNodesTool.test.ts
│       ├── RemoveNodesTool.ts      # Remove nodes by id
│       ├── RemoveNodesTool.test.ts
│       ├── UpdateNodesTool.ts      # Update node properties
│       ├── UpdateNodesTool.test.ts
│       ├── AddEdgesTool.ts         # Add edges
│       ├── AddEdgesTool.test.ts
│       ├── RemoveEdgesTool.ts      # Remove edges by id
│       ├── RemoveEdgesTool.test.ts
│       ├── UpdateEdgesTool.ts      # Update edge properties
│       └── UpdateEdgesTool.test.ts
│
├── webview/                        # Webview React application
│   ├── index.tsx                   # React root
│   ├── App.tsx                     # Root component
│   ├── hooks/
│   │   ├── useVSCodeBridge.ts      # postMessage ↔ onmessage bridge
│   │   └── useGraphState.ts        # ReactFlow nodes/edges state management
│   ├── components/
│   │   └── CanvasPanel/
│   │       ├── index.tsx           # ReactFlow wrapper
│   │       ├── CustomNode.tsx      # All node shape renderers
│   │       ├── CustomEdge.tsx      # Edge with label
│   │       ├── NodeContextMenu.tsx # Right-click menu
│   │       └── Toolbar.tsx         # Canvas toolbar (layout, export, etc.)
│   ├── lib/
│   │   ├── docToFlow.ts            # DiagramDocument → ReactFlow nodes/edges
│   │   ├── docToFlow.test.ts
│   │   ├── flowToDoc.ts            # ReactFlow state → semantic operations
│   │   ├── flowToDoc.test.ts
│   │   ├── layoutEngine.ts         # Partial dagre layout (respects pinned)
│   │   ├── layoutEngine.test.ts
│   │   └── exporters.ts            # SVG/Mermaid serializers
│   └── styles/
│       └── canvas.css
│
├── e2e/                            # Playwright + CDP (already scaffolded)
│   ├── fixtures/
│   │   ├── simple.diagram
│   │   ├── complex.diagram
│   │   └── empty.diagram
│   └── specs/
│       ├── 01-open-file.spec.ts
│       ├── 02-drag-node.spec.ts
│       ├── 03-add-node.spec.ts
│       ├── 04-add-edge.spec.ts
│       ├── 05-delete-node.spec.ts
│       ├── 06-undo-redo.spec.ts
│       ├── 07-export.spec.ts
│       └── 08-file-sync.spec.ts
```

---

## 5. Extension Host (TypeScript)

### `extension.ts`

```typescript
import * as vscode from 'vscode';
import { DiagramEditorProvider } from './DiagramEditorProvider';
import { DiagramService } from './DiagramService';
import { registerDiagramTools } from './tools';

export function activate(context: vscode.ExtensionContext) {
  const diagramService = new DiagramService();

  // Register custom editor for .diagram files
  context.subscriptions.push(
    DiagramEditorProvider.register(context, diagramService)
  );

  // Register Language Model Tools for Copilot integration
  registerDiagramTools(context, diagramService);

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('diagramflow.newDiagram', async () => {
      const uri = await promptForNewDiagramLocation();
      if (uri) {
        await createEmptyDiagramFile(uri);
        await vscode.commands.executeCommand('vscode.open', uri);
      }
    }),
    vscode.commands.registerCommand('diagramflow.exportSVG', () => {
      vscode.commands.executeCommand('diagramflow.internal.export', 'svg');
    }),
    vscode.commands.registerCommand('diagramflow.exportMermaid', () => {
      vscode.commands.executeCommand('diagramflow.internal.export', 'mermaid');
    }),
    vscode.commands.registerCommand('diagramflow.autoLayout', () => {
      diagramService.autoLayoutAll();
    })
  );
}

export function deactivate() {}
```

### `DiagramService.ts`

This is the shared service that both the editor provider and the Language Model Tools use to read and modify diagrams.

```typescript
import * as vscode from 'vscode';
import { DiagramDocument, DiagramNode, DiagramEdge } from './types/DiagramDocument';
import { SchemaValidator } from './SchemaValidator';
import { computePartialLayout } from '../webview/lib/layoutEngine';
import { nanoid } from 'nanoid';

export interface SemanticOp =
  | { op: 'add_node'; node: Partial<DiagramNode> & { label: string } }
  | { op: 'remove_node'; id: string }
  | { op: 'update_node'; id: string; changes: Partial<Omit<DiagramNode, 'id'>> }
  | { op: 'add_edge'; edge: Partial<DiagramEdge> & { source: string; target: string } }
  | { op: 'remove_edge'; id: string }
  | { op: 'update_edge'; id: string; changes: Partial<Omit<DiagramEdge, 'id'>> };

export class DiagramService {
  private validator = new SchemaValidator();
  private activeDocument: vscode.TextDocument | null = null;

  /** Called by DiagramEditorProvider when a .diagram file is opened */
  setActiveDocument(doc: vscode.TextDocument | null): void {
    this.activeDocument = doc;
  }

  getActiveDocument(): vscode.TextDocument | null {
    return this.activeDocument;
  }

  /** Parse the active document into a DiagramDocument */
  parseDocument(doc?: vscode.TextDocument): DiagramDocument | null {
    const target = doc ?? this.activeDocument;
    if (!target) return null;
    try {
      return JSON.parse(target.getText()) as DiagramDocument;
    } catch {
      return null;
    }
  }

  /** Apply semantic operations to the active document */
  async applyOps(ops: SemanticOp[], doc?: vscode.TextDocument): Promise<{ success: boolean; error?: string }> {
    const target = doc ?? this.activeDocument;
    if (!target) return { success: false, error: 'No active diagram document' };

    const current = this.parseDocument(target);
    if (!current) return { success: false, error: 'Failed to parse diagram document' };

    let modified = structuredClone(current);

    for (const op of ops) {
      switch (op.op) {
        case 'add_node': {
          const node: DiagramNode = {
            id: nanoid(8),
            label: op.node.label,
            x: op.node.x ?? 0,
            y: op.node.y ?? 0,
            width: op.node.width ?? 160,
            height: op.node.height ?? 48,
            shape: op.node.shape ?? 'rectangle',
            color: op.node.color ?? 'default',
            pinned: op.node.pinned ?? false,
            notes: op.node.notes,
            group: op.node.group,
          };
          modified.nodes.push(node);
          break;
        }
        case 'remove_node': {
          // Remove connected edges first
          modified.edges = modified.edges.filter(
            e => e.source !== op.id && e.target !== op.id
          );
          modified.nodes = modified.nodes.filter(n => n.id !== op.id);
          break;
        }
        case 'update_node': {
          const node = modified.nodes.find(n => n.id === op.id);
          if (!node) return { success: false, error: `Node ${op.id} not found` };
          // Protect pinned positions: if node is pinned, ignore x/y changes
          const { x, y, ...safeChanges } = op.changes;
          if (!node.pinned) {
            if (x !== undefined) node.x = x;
            if (y !== undefined) node.y = y;
          }
          Object.assign(node, safeChanges);
          break;
        }
        case 'add_edge': {
          const edge: DiagramEdge = {
            id: nanoid(8),
            source: op.edge.source,
            target: op.edge.target,
            label: op.edge.label,
            style: op.edge.style ?? 'solid',
            arrow: op.edge.arrow ?? 'arrow',
            animated: op.edge.animated,
          };
          modified.edges.push(edge);
          break;
        }
        case 'remove_edge': {
          modified.edges = modified.edges.filter(e => e.id !== op.id);
          break;
        }
        case 'update_edge': {
          const edge = modified.edges.find(e => e.id === op.id);
          if (!edge) return { success: false, error: `Edge ${op.id} not found` };
          Object.assign(edge, op.changes);
          break;
        }
      }
    }

    // Validate
    const validation = this.validator.validate(modified);
    if (!validation.valid) {
      return { success: false, error: `Invalid diagram: ${validation.errors.join(', ')}` };
    }

    // Auto-layout unpinned nodes at origin
    const layoutOps = computePartialLayout(modified);
    if (layoutOps.length > 0) {
      for (const lop of layoutOps) {
        const node = modified.nodes.find(n => n.id === lop.nodeId);
        if (node) {
          node.x = lop.x;
          node.y = lop.y;
        }
      }
    }

    // Update timestamp
    modified.meta.modified = new Date().toISOString();

    // Write to document
    const newText = JSON.stringify(modified, null, 2);
    const edit = new vscode.WorkspaceEdit();
    edit.replace(
      target.uri,
      new vscode.Range(0, 0, target.lineCount, 0),
      newText
    );
    const applied = await vscode.workspace.applyEdit(edit);
    return applied ? { success: true } : { success: false, error: 'Failed to apply edit' };
  }

  async autoLayoutAll(): Promise<void> {
    if (!this.activeDocument) return;
    const doc = this.parseDocument();
    if (!doc) return;

    const ops: SemanticOp[] = doc.nodes.map(n => ({
      op: 'update_node' as const,
      id: n.id,
      changes: { pinned: false, x: 0, y: 0 },
    }));
    await this.applyOps(ops);
  }

  emptyDocument(): DiagramDocument {
    return {
      meta: {
        title: 'Untitled Diagram',
        created: new Date().toISOString(),
        modified: new Date().toISOString(),
      },
      nodes: [],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
    };
  }
}
```

### `DiagramEditorProvider.ts`

```typescript
import * as vscode from 'vscode';
import { DiagramService, SemanticOp } from './DiagramService';
import { getWebviewContent } from './getWebviewContent';
import { DiagramDocument } from './types/DiagramDocument';
import { WebviewMessage } from './messages/protocol';

export class DiagramEditorProvider implements vscode.CustomTextEditorProvider {
  public static readonly viewType = 'diagramflow.editor';

  private constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly diagramService: DiagramService
  ) {}

  public static register(
    context: vscode.ExtensionContext,
    diagramService: DiagramService
  ): vscode.Disposable {
    const provider = new DiagramEditorProvider(context, diagramService);
    return vscode.window.registerCustomEditorProvider(
      DiagramEditorProvider.viewType,
      provider,
      {
        webviewOptions: { retainContextWhenHidden: true },
        supportsMultipleEditorsPerDocument: false,
      }
    );
  }

  public async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    // Track active document for tools
    this.diagramService.setActiveDocument(document);

    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview'),
      ],
    };
    webviewPanel.webview.html = getWebviewContent(
      webviewPanel.webview,
      this.context.extensionUri
    );

    const sendDocument = () => {
      const doc = this.diagramService.parseDocument(document);
      if (doc) {
        webviewPanel.webview.postMessage({ type: 'DOCUMENT_UPDATED', doc });
      }
    };

    // Sync: file changes → webview
    const changeSubscription = vscode.workspace.onDidChangeTextDocument(e => {
      if (e.document.uri.toString() === document.uri.toString()) {
        sendDocument();
      }
    });

    // Receive messages from webview
    webviewPanel.webview.onDidReceiveMessage(async (msg: WebviewMessage) => {
      switch (msg.type) {
        case 'WEBVIEW_READY':
          sendDocument();
          break;

        case 'NODE_DRAGGED':
          await this.diagramService.applyOps([{
            op: 'update_node',
            id: msg.id,
            changes: { x: Math.round(msg.position.x), y: Math.round(msg.position.y), pinned: true },
          }], document);
          break;

        case 'NODE_RESIZED':
          await this.diagramService.applyOps([{
            op: 'update_node',
            id: msg.id,
            changes: { width: Math.round(msg.dimensions.width), height: Math.round(msg.dimensions.height) },
          }], document);
          break;

        case 'ADD_NODE':
          await this.diagramService.applyOps([{
            op: 'add_node',
            node: msg.node,
          }], document);
          break;

        case 'DELETE_NODES':
          await this.diagramService.applyOps(
            msg.nodeIds.map(id => ({ op: 'remove_node' as const, id })),
            document
          );
          break;

        case 'ADD_EDGE':
          await this.diagramService.applyOps([{
            op: 'add_edge',
            edge: msg.edge,
          }], document);
          break;

        case 'DELETE_EDGES':
          await this.diagramService.applyOps(
            msg.edgeIds.map(id => ({ op: 'remove_edge' as const, id })),
            document
          );
          break;

        case 'UPDATE_NODE_LABEL':
          await this.diagramService.applyOps([{
            op: 'update_node',
            id: msg.id,
            changes: { label: msg.label },
          }], document);
          break;

        case 'REQUEST_LAYOUT':
          await this.diagramService.autoLayoutAll();
          break;

        case 'EXPORT':
          // Handle export via ExportService
          break;
      }
    });

    webviewPanel.onDidDispose(() => {
      changeSubscription.dispose();
      if (this.diagramService.getActiveDocument() === document) {
        this.diagramService.setActiveDocument(null);
      }
    });
  }
}
```

---

## 6. Webview Application (React)

### `webview/index.tsx`

```tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import { ReactFlowProvider } from '@xyflow/react';
import App from './App';
import './styles/canvas.css';

const root = createRoot(document.getElementById('root')!);
root.render(
  <ReactFlowProvider>
    <App />
  </ReactFlowProvider>
);
```

### `webview/App.tsx`

```tsx
import React, { useState } from 'react';
import { CanvasPanel } from './components/CanvasPanel';
import { useVSCodeBridge } from './hooks/useVSCodeBridge';
import { useGraphState } from './hooks/useGraphState';
import type { DiagramDocument } from '../src/types/DiagramDocument';

export default function App() {
  const [doc, setDoc] = useState<DiagramDocument | null>(null);

  const bridge = useVSCodeBridge({
    onDocumentUpdated: setDoc,
  });

  const graphState = useGraphState(doc, bridge);

  if (!doc) {
    return <div className="loading">Loading diagram...</div>;
  }

  return (
    <div className="app-root">
      <CanvasPanel
        nodes={graphState.nodes}
        edges={graphState.edges}
        onNodesChange={graphState.onNodesChange}
        onEdgesChange={graphState.onEdgesChange}
        onConnect={graphState.onConnect}
        onNodeDragStop={graphState.onNodeDragStop}
        onNodeDelete={graphState.onNodeDelete}
        onEdgeDelete={graphState.onEdgeDelete}
        onNodeLabelEdit={graphState.onNodeLabelEdit}
        onRequestLayout={() => bridge.postMessage({ type: 'REQUEST_LAYOUT' })}
        onExport={(format) => bridge.postMessage({ type: 'EXPORT', format })}
      />
    </div>
  );
}
```

### `webview/hooks/useVSCodeBridge.ts`

```typescript
import { useEffect, useCallback, useRef } from 'react';
import type { DiagramDocument } from '../../src/types/DiagramDocument';
import type { ExtensionMessage, WebviewMessage } from '../../src/messages/protocol';

declare const acquireVsCodeApi: () => {
  postMessage: (msg: WebviewMessage) => void;
  getState: () => unknown;
  setState: (state: unknown) => void;
};

interface BridgeOptions {
  onDocumentUpdated: (doc: DiagramDocument) => void;
}

export function useVSCodeBridge(options: BridgeOptions) {
  const vscode = useRef(acquireVsCodeApi());

  const postMessage = useCallback((msg: WebviewMessage) => {
    vscode.current.postMessage(msg);
  }, []);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data as ExtensionMessage;
      switch (msg.type) {
        case 'DOCUMENT_UPDATED':
          options.onDocumentUpdated(msg.doc);
          break;
      }
    };

    window.addEventListener('message', handler);
    postMessage({ type: 'WEBVIEW_READY' });

    return () => window.removeEventListener('message', handler);
  }, []);

  return { postMessage };
}
```

### `webview/lib/docToFlow.ts`

```typescript
import { Node, Edge } from '@xyflow/react';
import type { DiagramDocument } from '../../src/types/DiagramDocument';

export function docToFlowNodes(doc: DiagramDocument): Node[] {
  return doc.nodes.map(n => ({
    id: n.id,
    type: 'diagramNode',
    position: { x: n.x, y: n.y },
    data: {
      label: n.label,
      shape: n.shape,
      color: n.color,
      pinned: n.pinned,
      notes: n.notes,
      width: n.width,
      height: n.height,
    },
    width: n.width,
    height: n.height,
    draggable: true,
    selectable: true,
  }));
}

export function docToFlowEdges(doc: DiagramDocument): Edge[] {
  return doc.edges.map(e => ({
    id: e.id,
    source: e.source,
    target: e.target,
    type: 'diagramEdge',
    label: e.label,
    animated: e.animated ?? false,
    data: {
      style: e.style,
      arrow: e.arrow,
    },
  }));
}
```

### `webview/lib/layoutEngine.ts`

```typescript
import dagre from '@dagrejs/dagre';
import type { DiagramDocument } from '../../src/types/DiagramDocument';

export interface LayoutResult {
  nodeId: string;
  x: number;
  y: number;
}

/**
 * Runs auto-layout ONLY on unpinned nodes at origin (x=0, y=0).
 * Pinned nodes are treated as fixed constraints.
 */
export function computePartialLayout(doc: DiagramDocument): LayoutResult[] {
  const unpinnedNew = doc.nodes.filter(n => !n.pinned && n.x === 0 && n.y === 0);

  if (unpinnedNew.length === 0) return [];

  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'LR', ranksep: 120, nodesep: 60, marginx: 40, marginy: 40 });

  for (const node of doc.nodes) {
    g.setNode(node.id, { width: node.width, height: node.height });
  }

  for (const edge of doc.edges) {
    if (g.hasNode(edge.source) && g.hasNode(edge.target)) {
      g.setEdge(edge.source, edge.target);
    }
  }

  dagre.layout(g);

  const results: LayoutResult[] = [];
  for (const node of unpinnedNew) {
    const laid = g.node(node.id);
    if (!laid) continue;
    results.push({
      nodeId: node.id,
      x: Math.round(laid.x - node.width / 2),
      y: Math.round(laid.y - node.height / 2),
    });
  }

  return results;
}
```

---

## 7. Copilot Integration — Language Model Tools

This is the core differentiator of v2. Instead of building a custom LLM panel, the extension registers tools that GitHub Copilot's agent mode invokes automatically.

### How It Works

1. The extension declares tools in `package.json` under `contributes.languageModelTools`
2. On activation, the extension registers tool implementations via `vscode.lm.registerTool()`
3. When a user asks Copilot something diagram-related, Copilot sees the tool descriptions and invokes them
4. Each tool reads/modifies the active `.diagram` document through `DiagramService`
5. The webview re-renders automatically via the existing `onDidChangeTextDocument` → `DOCUMENT_UPDATED` flow

### `package.json` — Tool Declarations

```json
{
  "contributes": {
    "languageModelTools": [
      {
        "name": "diagramflow_getDiagram",
        "tags": ["diagram", "diagramflow", "visualization"],
        "toolReferenceName": "getDiagram",
        "displayName": "Get Diagram",
        "modelDescription": "Reads the currently open .diagram file and returns its full JSON representation including all nodes (with id, label, shape, color, position, pinned status), edges (with id, source, target, label, style), and groups. Use this to understand the current state of a diagram before making modifications.",
        "userDescription": "Read the current diagram's nodes, edges, and layout.",
        "canBeReferencedInPrompt": true,
        "icon": "$(eye)",
        "inputSchema": {
          "type": "object",
          "properties": {}
        }
      },
      {
        "name": "diagramflow_addNodes",
        "tags": ["diagram", "diagramflow"],
        "toolReferenceName": "addNodes",
        "displayName": "Add Diagram Nodes",
        "modelDescription": "Adds one or more nodes to the currently open .diagram file. Each node requires a label and optionally accepts shape ('rectangle'|'rounded'|'diamond'|'cylinder'), color ('default'|'blue'|'green'|'red'|'yellow'|'purple'|'gray'), and notes. Nodes are auto-positioned by the layout engine. Do NOT specify x, y, or id — they are generated automatically. Returns the created nodes with their assigned ids.",
        "userDescription": "Add new nodes to the diagram.",
        "canBeReferencedInPrompt": true,
        "icon": "$(add)",
        "inputSchema": {
          "type": "object",
          "required": ["nodes"],
          "properties": {
            "nodes": {
              "type": "array",
              "description": "Array of nodes to add. Each requires at minimum a 'label'.",
              "items": {
                "type": "object",
                "required": ["label"],
                "properties": {
                  "label": { "type": "string", "description": "Display text for the node" },
                  "shape": { "type": "string", "enum": ["rectangle", "rounded", "diamond", "cylinder"], "description": "Node shape. Default: rectangle" },
                  "color": { "type": "string", "enum": ["default", "blue", "green", "red", "yellow", "purple", "gray"], "description": "Node color. Default: default" },
                  "notes": { "type": "string", "description": "Optional tooltip/annotation" },
                  "group": { "type": "string", "description": "Optional group id to assign this node to" }
                }
              }
            }
          }
        }
      },
      {
        "name": "diagramflow_removeNodes",
        "tags": ["diagram", "diagramflow"],
        "toolReferenceName": "removeNodes",
        "displayName": "Remove Diagram Nodes",
        "modelDescription": "Removes one or more nodes from the currently open .diagram file by their ids. Also automatically removes all edges connected to the removed nodes. Use getDiagram first to find the correct node ids.",
        "userDescription": "Remove nodes from the diagram by id.",
        "canBeReferencedInPrompt": true,
        "icon": "$(trash)",
        "inputSchema": {
          "type": "object",
          "required": ["nodeIds"],
          "properties": {
            "nodeIds": {
              "type": "array",
              "description": "Array of node id strings to remove.",
              "items": { "type": "string" }
            }
          }
        }
      },
      {
        "name": "diagramflow_updateNodes",
        "tags": ["diagram", "diagramflow"],
        "toolReferenceName": "updateNodes",
        "displayName": "Update Diagram Nodes",
        "modelDescription": "Updates properties of one or more existing nodes in the currently open .diagram file. Each update requires the node id and an object of properties to change. Updatable properties: label, shape, color, notes, group. Position (x, y) changes are only applied to unpinned nodes. Use getDiagram first to find node ids.",
        "userDescription": "Update properties of existing diagram nodes.",
        "canBeReferencedInPrompt": true,
        "icon": "$(edit)",
        "inputSchema": {
          "type": "object",
          "required": ["updates"],
          "properties": {
            "updates": {
              "type": "array",
              "description": "Array of node updates.",
              "items": {
                "type": "object",
                "required": ["id"],
                "properties": {
                  "id": { "type": "string", "description": "The node id to update" },
                  "label": { "type": "string" },
                  "shape": { "type": "string", "enum": ["rectangle", "rounded", "diamond", "cylinder"] },
                  "color": { "type": "string", "enum": ["default", "blue", "green", "red", "yellow", "purple", "gray"] },
                  "notes": { "type": "string" },
                  "group": { "type": "string" }
                }
              }
            }
          }
        }
      },
      {
        "name": "diagramflow_addEdges",
        "tags": ["diagram", "diagramflow"],
        "toolReferenceName": "addEdges",
        "displayName": "Add Diagram Edges",
        "modelDescription": "Adds one or more edges (connections) between existing nodes in the currently open .diagram file. Each edge requires source and target node ids. Optionally accepts label, style ('solid'|'dashed'|'dotted'), arrow ('arrow'|'open'|'none'), and animated (boolean). Use getDiagram first to find valid node ids for source and target.",
        "userDescription": "Add edges (connections) between diagram nodes.",
        "canBeReferencedInPrompt": true,
        "icon": "$(git-merge)",
        "inputSchema": {
          "type": "object",
          "required": ["edges"],
          "properties": {
            "edges": {
              "type": "array",
              "description": "Array of edges to add.",
              "items": {
                "type": "object",
                "required": ["source", "target"],
                "properties": {
                  "source": { "type": "string", "description": "Source node id" },
                  "target": { "type": "string", "description": "Target node id" },
                  "label": { "type": "string", "description": "Optional edge label" },
                  "style": { "type": "string", "enum": ["solid", "dashed", "dotted"], "description": "Edge line style. Default: solid" },
                  "arrow": { "type": "string", "enum": ["arrow", "open", "none"], "description": "Arrow type. Default: arrow" },
                  "animated": { "type": "boolean", "description": "Animated dash flow. Default: false" }
                }
              }
            }
          }
        }
      },
      {
        "name": "diagramflow_removeEdges",
        "tags": ["diagram", "diagramflow"],
        "toolReferenceName": "removeEdges",
        "displayName": "Remove Diagram Edges",
        "modelDescription": "Removes one or more edges from the currently open .diagram file by their ids. Use getDiagram first to find edge ids.",
        "userDescription": "Remove edges from the diagram by id.",
        "canBeReferencedInPrompt": true,
        "icon": "$(trash)",
        "inputSchema": {
          "type": "object",
          "required": ["edgeIds"],
          "properties": {
            "edgeIds": {
              "type": "array",
              "description": "Array of edge id strings to remove.",
              "items": { "type": "string" }
            }
          }
        }
      },
      {
        "name": "diagramflow_updateEdges",
        "tags": ["diagram", "diagramflow"],
        "toolReferenceName": "updateEdges",
        "displayName": "Update Diagram Edges",
        "modelDescription": "Updates properties of one or more existing edges in the currently open .diagram file. Each update requires the edge id. Updatable properties: label, style, arrow, animated, source, target. Use getDiagram first to find edge ids.",
        "userDescription": "Update properties of existing diagram edges.",
        "canBeReferencedInPrompt": true,
        "icon": "$(edit)",
        "inputSchema": {
          "type": "object",
          "required": ["updates"],
          "properties": {
            "updates": {
              "type": "array",
              "description": "Array of edge updates.",
              "items": {
                "type": "object",
                "required": ["id"],
                "properties": {
                  "id": { "type": "string", "description": "The edge id to update" },
                  "label": { "type": "string" },
                  "style": { "type": "string", "enum": ["solid", "dashed", "dotted"] },
                  "arrow": { "type": "string", "enum": ["arrow", "open", "none"] },
                  "animated": { "type": "boolean" },
                  "source": { "type": "string" },
                  "target": { "type": "string" }
                }
              }
            }
          }
        }
      }
    ]
  }
}
```

### `src/tools/index.ts`

```typescript
import * as vscode from 'vscode';
import { DiagramService } from '../DiagramService';
import { GetDiagramTool } from './GetDiagramTool';
import { AddNodesTool } from './AddNodesTool';
import { RemoveNodesTool } from './RemoveNodesTool';
import { UpdateNodesTool } from './UpdateNodesTool';
import { AddEdgesTool } from './AddEdgesTool';
import { RemoveEdgesTool } from './RemoveEdgesTool';
import { UpdateEdgesTool } from './UpdateEdgesTool';

export function registerDiagramTools(
  context: vscode.ExtensionContext,
  diagramService: DiagramService
): void {
  const tools: [string, vscode.LanguageModelTool<any>][] = [
    ['diagramflow_getDiagram', new GetDiagramTool(diagramService)],
    ['diagramflow_addNodes', new AddNodesTool(diagramService)],
    ['diagramflow_removeNodes', new RemoveNodesTool(diagramService)],
    ['diagramflow_updateNodes', new UpdateNodesTool(diagramService)],
    ['diagramflow_addEdges', new AddEdgesTool(diagramService)],
    ['diagramflow_removeEdges', new RemoveEdgesTool(diagramService)],
    ['diagramflow_updateEdges', new UpdateEdgesTool(diagramService)],
  ];

  for (const [name, tool] of tools) {
    context.subscriptions.push(vscode.lm.registerTool(name, tool));
  }
}
```

### `src/tools/GetDiagramTool.ts`

```typescript
import * as vscode from 'vscode';
import { DiagramService } from '../DiagramService';

export class GetDiagramTool implements vscode.LanguageModelTool<{}> {
  constructor(private readonly diagramService: DiagramService) {}

  async prepareInvocation(
    _options: vscode.LanguageModelToolInvocationPrepareOptions<{}>,
    _token: vscode.CancellationToken
  ) {
    return {
      invocationMessage: 'Reading current diagram...',
    };
  }

  async invoke(
    _options: vscode.LanguageModelToolInvocationOptions<{}>,
    _token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult> {
    const doc = this.diagramService.parseDocument();
    if (!doc) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart('No .diagram file is currently open. Open a .diagram file first.'),
      ]);
    }

    // Return compact representation to save tokens
    const compact = {
      title: doc.meta.title,
      nodes: doc.nodes.map(n => ({
        id: n.id,
        label: n.label,
        shape: n.shape !== 'rectangle' ? n.shape : undefined,
        color: n.color !== 'default' ? n.color : undefined,
        pinned: n.pinned || undefined,
        group: n.group,
      })),
      edges: doc.edges.map(e => ({
        id: e.id,
        source: e.source,
        target: e.target,
        label: e.label,
        style: e.style !== 'solid' ? e.style : undefined,
      })),
      groups: doc.groups,
    };

    return new vscode.LanguageModelToolResult([
      new vscode.LanguageModelTextPart(JSON.stringify(compact, null, 2)),
    ]);
  }
}
```

### `src/tools/AddNodesTool.ts`

```typescript
import * as vscode from 'vscode';
import { DiagramService } from '../DiagramService';

interface AddNodesInput {
  nodes: Array<{
    label: string;
    shape?: string;
    color?: string;
    notes?: string;
    group?: string;
  }>;
}

export class AddNodesTool implements vscode.LanguageModelTool<AddNodesInput> {
  constructor(private readonly diagramService: DiagramService) {}

  async prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<AddNodesInput>,
    _token: vscode.CancellationToken
  ) {
    const count = options.input.nodes.length;
    const labels = options.input.nodes.map(n => n.label).join(', ');
    return {
      invocationMessage: `Adding ${count} node(s): ${labels}`,
      confirmationMessages: {
        title: 'Add diagram nodes',
        message: new vscode.MarkdownString(`Add **${count}** node(s) to the diagram: ${labels}`),
      },
    };
  }

  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<AddNodesInput>,
    _token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult> {
    const ops = options.input.nodes.map(n => ({
      op: 'add_node' as const,
      node: n,
    }));

    const result = await this.diagramService.applyOps(ops);

    if (!result.success) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(`Failed to add nodes: ${result.error}`),
      ]);
    }

    // Return the updated diagram state so Copilot knows the new node ids
    const doc = this.diagramService.parseDocument();
    const addedNodes = doc?.nodes.slice(-options.input.nodes.length) ?? [];
    return new vscode.LanguageModelToolResult([
      new vscode.LanguageModelTextPart(
        `Successfully added ${options.input.nodes.length} node(s). New node ids: ${addedNodes.map(n => `${n.id} (${n.label})`).join(', ')}`
      ),
    ]);
  }
}
```

### `src/tools/RemoveNodesTool.ts`

```typescript
import * as vscode from 'vscode';
import { DiagramService } from '../DiagramService';

interface RemoveNodesInput {
  nodeIds: string[];
}

export class RemoveNodesTool implements vscode.LanguageModelTool<RemoveNodesInput> {
  constructor(private readonly diagramService: DiagramService) {}

  async prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<RemoveNodesInput>,
    _token: vscode.CancellationToken
  ) {
    return {
      invocationMessage: `Removing ${options.input.nodeIds.length} node(s)...`,
      confirmationMessages: {
        title: 'Remove diagram nodes',
        message: new vscode.MarkdownString(
          `Remove **${options.input.nodeIds.length}** node(s) and their connected edges?\n\nNode ids: ${options.input.nodeIds.join(', ')}`
        ),
      },
    };
  }

  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<RemoveNodesInput>,
    _token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult> {
    const ops = options.input.nodeIds.map(id => ({
      op: 'remove_node' as const,
      id,
    }));

    const result = await this.diagramService.applyOps(ops);

    return new vscode.LanguageModelToolResult([
      new vscode.LanguageModelTextPart(
        result.success
          ? `Successfully removed ${options.input.nodeIds.length} node(s) and their connected edges.`
          : `Failed to remove nodes: ${result.error}`
      ),
    ]);
  }
}
```

### Other tools (`UpdateNodesTool`, `AddEdgesTool`, `RemoveEdgesTool`, `UpdateEdgesTool`)

These follow the same pattern: implement `vscode.LanguageModelTool<T>` with `prepareInvocation` (confirmation message) and `invoke` (calls `diagramService.applyOps`). Each tool:

1. Validates input
2. Translates to `SemanticOp[]`
3. Calls `diagramService.applyOps()`
4. Returns success/failure as `LanguageModelToolResult`

### Copilot Interaction Examples

With these tools registered, users can say in Copilot Chat (agent mode):

```
"Add a Redis cache node between the Auth Service and the Database"
→ Copilot calls getDiagram → sees current nodes → calls addNodes → calls addEdges

"Rename the Auth Service to API Gateway"
→ Copilot calls getDiagram → finds the node → calls updateNodes

"Remove the deprecated gateway and reconnect its edges"
→ Copilot calls getDiagram → calls removeNodes → calls addEdges

"Make all database nodes red cylinders"
→ Copilot calls getDiagram → filters nodes → calls updateNodes

"Create a microservices architecture with 5 services and a load balancer"
→ Copilot calls addNodes (6 nodes) → calls addEdges (connections)
```

---

## 8. Message Protocol (Extension ↔ Webview)

### `src/messages/protocol.ts`

```typescript
import type { DiagramDocument, DiagramNode, DiagramEdge } from '../types/DiagramDocument';

// Messages FROM webview TO extension
export type WebviewMessage =
  | { type: 'WEBVIEW_READY' }
  | { type: 'NODE_DRAGGED'; id: string; position: { x: number; y: number } }
  | { type: 'NODE_RESIZED'; id: string; dimensions: { width: number; height: number } }
  | { type: 'ADD_NODE'; node: Partial<DiagramNode> & { label: string } }
  | { type: 'DELETE_NODES'; nodeIds: string[] }
  | { type: 'ADD_EDGE'; edge: { source: string; target: string; label?: string } }
  | { type: 'DELETE_EDGES'; edgeIds: string[] }
  | { type: 'UPDATE_NODE_LABEL'; id: string; label: string }
  | { type: 'REQUEST_LAYOUT' }
  | { type: 'EXPORT'; format: 'svg' | 'png' | 'mermaid'; svgContent?: string };

// Messages FROM extension TO webview
export type ExtensionMessage =
  | { type: 'DOCUMENT_UPDATED'; doc: DiagramDocument };
```

Note: Compared to v1, the protocol is much simpler. No `LLM_PROMPT`, `LLM_THINKING`, `LLM_PATCH_PREVIEW`, or `LLM_ERROR` messages — all LLM interaction happens through Copilot Chat, not the webview.

---

## 9. Layout Engine

### Behavior Contract

| Node state | Auto-layout behavior |
|---|---|
| `pinned: true` | Never moved. Position in JSON is authoritative. |
| `pinned: false, x=0, y=0` | Position computed by dagre after add |
| `pinned: false, x≠0 or y≠0` | Position preserved |

### When Layout Runs

- **After `DiagramService.applyOps()` adds nodes** with `x=0, y=0` — auto-layout positions them
- **When user clicks "Auto Layout"** — unpins all nodes, sets all to `x=0, y=0`, runs full dagre

### Layout Algorithm Configuration

```typescript
g.setGraph({
  rankdir: 'LR',   // left-to-right
  ranksep: 120,     // pixels between ranks (columns)
  nodesep: 60,      // pixels between nodes in same rank
  marginx: 40,
  marginy: 40,
});
```

---

## 10. Node & Edge Types

### Custom Node Component

Each of the 4 shapes is an SVG-based renderer:

```typescript
const SHAPE_RENDERERS: Record<NodeShape, React.FC<NodeRenderProps>> = {
  rectangle:  RectangleNode,
  rounded:    RoundedNode,
  diamond:    DiamondNode,
  cylinder:   CylinderNode,
};
```

All shapes:
- Render handles on all 4 sides
- Show a lock icon (🔒) in top-right when pinned
- Support double-click for inline label editing
- Support right-click for context menu (change shape, color, pin/unpin, notes)

### Node Color Palette

```typescript
export const COLOR_VARS: Record<NodeColor, { bg: string; border: string; text: string }> = {
  default:  { bg: 'var(--vscode-editor-background)', border: 'var(--vscode-foreground)', text: 'var(--vscode-foreground)' },
  blue:     { bg: '#1e3a5f',  border: '#4a9eff', text: '#4a9eff' },
  green:    { bg: '#1a3a1f',  border: '#4ade80', text: '#4ade80' },
  red:      { bg: '#3a1a1a',  border: '#f87171', text: '#f87171' },
  yellow:   { bg: '#3a321a',  border: '#fbbf24', text: '#fbbf24' },
  purple:   { bg: '#2e1a3a',  border: '#c084fc', text: '#c084fc' },
  gray:     { bg: '#2a2a2a',  border: '#9ca3af', text: '#9ca3af' },
};
```

---

## 11. Build System

### `esbuild.config.mjs`

```javascript
import * as esbuild from 'esbuild';

const watch = process.argv.includes('--watch');

// Build 1: Extension Host
await esbuild.build({
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'dist/extension.js',
  external: ['vscode'],
  format: 'cjs',
  platform: 'node',
  sourcemap: true,
  watch: watch ? { onRebuild: (err) => err && console.error(err) } : false,
});

// Build 2: Webview React App
await esbuild.build({
  entryPoints: ['webview/index.tsx'],
  bundle: true,
  outfile: 'dist/webview/index.js',
  format: 'esm',
  platform: 'browser',
  sourcemap: true,
  loader: { '.css': 'css' },
  define: { 'process.env.NODE_ENV': '"production"' },
  watch: watch ? { onRebuild: (err) => err && console.error(err) } : false,
});
```

---

## 12. Testing Strategy

### Philosophy

**Unit tests are the primary correctness mechanism.** E2E tests verify integration at the VSCode level.

- **Unit tests (Vitest):** Co-located with source files (e.g. `DiagramService.test.ts` next to `DiagramService.ts`). Cover all pure logic — DiagramService, SchemaValidator, docToFlow, layoutEngine, and each Language Model Tool. Run in <1 second.
- **E2E tests (Playwright + CDP):** Live in `e2e/` at the package root. User-level scenarios — open file, drag node, undo/redo. Already scaffolded in the project. Run in ~30 seconds.

### Agent-Friendly Test Design

1. **Zero shared mutable state** — each test creates its own fixture
2. **Explicit assertions** — every assertion checks a specific value
3. **Fixture-driven** — deterministic JSON files in `e2e/fixtures/`

---

## 13. E2E Testing with Playwright

The project already has a Playwright + CDP infrastructure for testing VS Code extensions. See `packages/vscode-extension/e2e/` for the scaffolding:

- `vscode-desktop-server.ts`: Spawns VS Code Desktop, connects Playwright via CDP
- `fixtures/vscode-desktop-fixtures.ts`: Worker-scoped fixtures for server/browser, test-scoped for page
- `helpers/vscode-page-helpers.ts`: `waitForWorkbench`, `openFile`, `executeCommand`, etc.

### Key E2E Specs

```
01-open-file.spec.ts    — Open .diagram file, verify canvas renders, correct node/edge count
02-drag-node.spec.ts    — Drag node, verify JSON position updated, verify pinned=true
03-add-node.spec.ts     — Add node via toolbar, verify it appears in JSON
04-add-edge.spec.ts     — Draw edge between nodes, verify in JSON
05-delete-node.spec.ts  — Delete node, verify connected edges also removed
06-undo-redo.spec.ts    — Ctrl+Z undoes last operation
07-export.spec.ts       — Export to SVG/Mermaid verifies output
08-file-sync.spec.ts    — External file edit re-renders in canvas
```

---

## 14. Unit Tests

### `src/DiagramService.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DiagramService } from '../../src/DiagramService';

// Mock vscode module
vi.mock('vscode', () => ({ /* ... */ }));

const baseDoc = () => ({
  meta: { title: 'Test', created: '2025-01-01T00:00:00Z', modified: '2025-01-01T00:00:00Z' },
  nodes: [
    { id: 'node0001', label: 'A', x: 100, y: 100, width: 160, height: 48, shape: 'rectangle', color: 'default', pinned: false },
    { id: 'node0002', label: 'B', x: 300, y: 100, width: 160, height: 48, shape: 'rectangle', color: 'default', pinned: true },
  ],
  edges: [
    { id: 'edge0001', source: 'node0001', target: 'node0002', style: 'solid', arrow: 'arrow' },
  ],
});

describe('DiagramService', () => {
  it('should add a node', async () => {
    // Test add_node operation adds to nodes array
  });

  it('should remove a node and its connected edges', async () => {
    // Test remove_node also removes edges referencing that node
  });

  it('should not change position of pinned nodes via update_node', async () => {
    // Test that x/y changes are ignored when node.pinned === true
  });

  it('should reject edge referencing non-existent node', async () => {
    // Test add_edge with invalid source/target fails validation
  });
});
```

### `webview/lib/layoutEngine.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { computePartialLayout } from '../../webview/lib/layoutEngine';

describe('layoutEngine', () => {
  it('should position unpinned nodes at origin', () => {
    const doc = {
      meta: { title: '', created: '', modified: '' },
      nodes: [
        { id: 'a', label: 'A', x: 100, y: 100, width: 160, height: 48, shape: 'rectangle', color: 'default', pinned: true },
        { id: 'b', label: 'B', x: 0, y: 0, width: 160, height: 48, shape: 'rectangle', color: 'default', pinned: false },
      ],
      edges: [{ id: 'e1', source: 'a', target: 'b', style: 'solid', arrow: 'arrow' }],
    };

    const results = computePartialLayout(doc as any);
    expect(results.length).toBe(1);
    expect(results[0].nodeId).toBe('b');
    expect(results[0].x).toBeGreaterThan(100); // positioned right of A
  });

  it('should not move pinned nodes', () => {
    const doc = {
      meta: { title: '', created: '', modified: '' },
      nodes: [
        { id: 'a', label: 'A', x: 999, y: 999, width: 160, height: 48, shape: 'rectangle', color: 'default', pinned: true },
      ],
      edges: [],
    };

    const results = computePartialLayout(doc as any);
    expect(results.length).toBe(0);
  });
});
```

### `src/tools/AddNodesTool.test.ts`

```typescript
import { describe, it, expect, vi } from 'vitest';
// Test that AddNodesTool.invoke() calls diagramService.applyOps with correct ops
// Test that prepareInvocation returns meaningful confirmation message
// Test error case when no diagram is open
```

---

## 15. Agent Ownership Guidelines

### File Ownership Map

| File | Change frequency | Notes |
|---|---|---|
| `src/types/DiagramDocument.ts` | Low | Core schema. Changes ripple everywhere. |
| `src/messages/protocol.ts` | Low | Both extension and webview depend on this. |
| `src/DiagramService.ts` | Medium | Central logic. All tools and editor route through this. |
| `src/tools/*.ts` | Medium | One file per tool. Add new tools without breaking existing. |
| `src/DiagramEditorProvider.ts` | Medium | Orchestration. Handle webview message → DiagramService call. |
| `webview/lib/docToFlow.ts` | Low | Mapping. Must be kept in sync with DiagramDocument types. |
| `webview/lib/layoutEngine.ts` | Low | Keep pure (no side effects). |
| `webview/components/CanvasPanel/` | High | UI iteration. Change freely within ReactFlow API. |
| `src/**/*.test.ts`, `webview/**/*.test.ts` | Always in sync | Tests live next to their module. When logic changes, update the test. |

### Invariants the Agent Must Never Break

1. **`docToFlow(doc)` must render all nodes and edges from the JSON.** No data loss in the mapping.
2. **`pinned: true` nodes must never have their `x` or `y` changed by the layout engine or by Copilot tools.**
3. **All changes to `.diagram` files go through `WorkspaceEdit.replace()`.** This preserves undo/redo.
4. **All messages between extension and webview must use the typed protocol.** No `any` in message handlers.
5. **Language Model Tools must always call `diagramService.applyOps()`.** Never write to the document directly.
6. **Removing a node must also remove all connected edges.** The `remove_node` semantic op handles this.

### How to Add a New Tool

1. Define the input interface
2. Add tool declaration to `package.json` under `contributes.languageModelTools`
3. Create a new class implementing `vscode.LanguageModelTool<T>`
4. Register it in `src/tools/index.ts`
5. Write unit test for the tool
6. Run tests — all green before commit

---

## 16. Implementation Phases

### Phase 1 — Foundation (Days 1–3)

**Goal:** `.diagram` file opens in VSCode with a working canvas. No Copilot tools yet.

1. Set up esbuild for dual-target build (extension + webview)
2. Implement `DiagramDocument` types and `SchemaValidator`
3. Implement `DiagramService` with semantic operations + unit tests
4. Implement `docToFlow` and `flowToDoc` with unit tests
5. Create React app with ReactFlow, custom `diagramNode` type (4 shapes)
6. Implement `useVSCodeBridge` — bidirectional postMessage
7. Wire up: open file → parse → render nodes/edges
8. Wire up: `onNodeDragStop` → update position → write file → re-render
9. Wire up: double-click node → edit label inline
10. Wire up: draw edge between nodes
11. Wire up: delete selected (node + connected edges)
12. **E2E tests: specs 01, 02**

### Phase 2 — Copilot Tools (Days 4–5)

**Goal:** Copilot agent mode can read and modify diagrams.

1. Declare all 7 tools in `package.json`
2. Implement `GetDiagramTool`
3. Implement `AddNodesTool` + `AddEdgesTool`
4. Implement `RemoveNodesTool` + `RemoveEdgesTool`
5. Implement `UpdateNodesTool` + `UpdateEdgesTool`
6. Implement `layoutEngine` (partial dagre) — auto-position new nodes
7. Unit tests for all tools
8. Manual testing with Copilot agent mode

### Phase 3 — Polish & Export (Days 6–8)

**Goal:** Right-click menu, toolbar, export, theme integration.

1. Implement `NodeContextMenu` (right-click: change shape, color, pin/unpin, notes)
2. Implement toolbar (auto-layout, fit view, zoom controls)
3. Implement SVG export
4. Implement Mermaid export
5. VSCode theme integration (CSS variables)
6. **E2E tests: specs 03, 04, 05, 06, 07, 08**

### Phase 4 — Stability (Days 9–10)

1. Performance test: 200-node diagram
2. Edge cases: empty file, malformed JSON recovery
3. Extension package and test install
4. README and usage documentation

---

## 17. Dependencies & Versions

### Extension Host

```json
{
  "dependencies": {},
  "devDependencies": {
    "@types/vscode": "^1.103.0",
    "@types/node": "^20.0.0",
    "typescript": "^5.3.0",
    "esbuild": "^0.20.0",
    "vitest": "^1.3.0",
    "nanoid": "^5.0.0",
    "@vscode/vsce": "^2.24.0"
  }
}
```

### Webview (bundled by esbuild)

```json
{
  "devDependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@xyflow/react": "^12.0.0",
    "@dagrejs/dagre": "^1.1.4"
  }
}
```

### E2E (already in project)

```json
{
  "devDependencies": {
    "@playwright/test": "^1.x",
    "electron": "^33.x"
  }
}
```

### Key Version Constraints

- `@xyflow/react` must be `^12.x` — React 18 compatible (formerly `reactflow`)
- VSCode minimum engine: `^1.103.0` (Language Model Tools API)
- Node.js minimum: `18.0.0`
- No `fast-json-patch` dependency — semantic operations replace RFC 6902

---

## Appendix A: Migration from v1

If you have already started implementing from v1, here are the key changes:

1. **Delete**: `LLMService.ts`, `PatchEngine.ts`, `LLMPanel/` component, all LLM config settings
2. **Replace**: `PatchEngine.apply()` calls → `DiagramService.applyOps()` calls
3. **Add**: `src/tools/` directory with 7 tool classes
4. **Add**: `contributes.languageModelTools` to `package.json`
5. **Simplify**: `protocol.ts` — remove all `LLM_*` message types
6. **Simplify**: `App.tsx` — remove `LLMPanel`, remove `llmThinking` / `llmError` state
7. **Change**: `onNodesChange` debounced → `onNodeDragStop` direct

---

*End of specification v2. This document fully specifies the DiagramFlow VSCode extension with GitHub Copilot integration via Language Model Tools API.*
