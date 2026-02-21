# DiagramFlow — VSCode Diagram Editor
## Complete Implementation Specification

**Version:** 1.0.0  
**File:** `DIAGRAM_EDITOR_SPEC.md`  
**Target agent:** This document is written to be consumed directly by a coding agent. Every architectural decision is made. No open questions remain. Implement top-to-bottom.

---

## Table of Contents

1. [Concept & Philosophy](#1-concept--philosophy)
2. [File Format Specification](#2-file-format-specification)
3. [System Architecture](#3-system-architecture)
4. [Repository Structure](#4-repository-structure)
5. [Extension Host (TypeScript)](#5-extension-host-typescript)
6. [Webview Application (React)](#6-webview-application-react)
7. [LLM Integration Protocol](#7-llm-integration-protocol)
8. [Message Protocol (Extension ↔ Webview)](#8-message-protocol-extension--webview)
9. [Layout Engine](#9-layout-engine)
10. [Node & Edge Types](#10-node--edge-types)
11. [Build System](#11-build-system)
12. [Testing Strategy](#12-testing-strategy)
13. [E2E Testing with WebdriverIO](#13-e2e-testing-with-webdriverio)
14. [Unit & Integration Tests](#14-unit--integration-tests)
15. [Agent Ownership Guidelines](#15-agent-ownership-guidelines)
16. [Implementation Phases](#16-implementation-phases)
17. [Dependencies & Versions](#17-dependencies--versions)

---

## 1. Concept & Philosophy

### What This Is

A VSCode extension that provides a **bidirectional visual diagram editor** with native LLM integration. The human and the LLM can each take control of the diagram at any time. Neither is blocked by the other.

### Core Design Decisions (non-negotiable)

**Decision 1: JSON is the single source of truth.**  
The `.diagram` file on disk is structured JSON. It stores everything: nodes, edges, labels, styles, AND positions. There is no separate layout file, no sidecar, no computed state. What's in the file is exactly what renders.

**Decision 2: LLM edits via surgical JSON Patch (RFC 6902).**  
The LLM never rewrites the whole file. It emits patch operations (`add`, `remove`, `replace`). This means human-positioned nodes are never destroyed by an LLM edit. The patch is applied atomically; if it fails, nothing changes.

**Decision 3: Human-positioned nodes are pinned.**  
A node touched by the human gets `"pinned": true` in the JSON. The auto-layout engine skips pinned nodes. Only LLM-added nodes (which have no position yet) get auto-laid out.

**Decision 4: VSCode undo/redo is free.**  
Because the file is a `TextDocument`, every change goes through `WorkspaceEdit.replace()`. This gives us VSCode's undo stack, git diff, and autosave for free without any custom implementation.

**Decision 5: The webview is stateless.**  
The webview holds no canonical state. It is a view. If it closes and reopens, it re-renders from the file. This simplifies the architecture enormously.

**Decision 6: Export is secondary.**  
Mermaid, SVG, and PNG are export targets. They are never the source of truth. The LLM never reads Mermaid — it reads the JSON graph.

---

## 2. File Format Specification

### File Extension
`.diagram`

### Full Schema

```typescript
// types/DiagramDocument.ts — this file is the canonical type definition

export type NodeShape =
  | 'rectangle'   // default box
  | 'rounded'     // rounded corners
  | 'diamond'     // decision
  | 'cylinder'    // database
  | 'circle'      // terminal
  | 'parallelogram' // input/output
  | 'hexagon'     // preparation
  | 'document';   // document/result

export type EdgeStyle =
  | 'solid'
  | 'dashed'
  | 'dotted';

export type ArrowType =
  | 'arrow'        // → standard
  | 'open'         // ⟶ open
  | 'none';        // — no arrowhead

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
  x: number;             // canvas x position (pixels). 0 if not yet positioned.
  y: number;             // canvas y position (pixels). 0 if not yet positioned.
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
  version: number;       // integer, increment on every file write
}

export interface DiagramDocument {
  $schema: string;       // always "https://diagramflow/schema/v1"
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
  "$schema": "https://diagramflow/schema/v1",
  "meta": {
    "title": "Auth Service Architecture",
    "created": "2025-02-20T10:00:00Z",
    "modified": "2025-02-20T10:15:00Z",
    "version": 7
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
- `x`, `y`, `width`, `height` must be non-negative numbers
- `version` must be a positive integer, monotonically increasing

---

## 3. System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    VSCode Extension Host                         │
│                                                                  │
│  ┌──────────────────────┐    ┌────────────────────────────────┐  │
│  │  DiagramEditorProvider│    │      LLM Service               │  │
│  │  (CustomTextEditor)   │    │  - buildContext()              │  │
│  │  - resolveEditor()    │    │  - applyPatch()                │  │
│  │  - updateDocument()   │────│  - callConfiguredLLM()         │  │
│  │  - onMessage()        │    │  - validatePatch()             │  │
│  └──────────┬───────────┘    └────────────────────────────────┘  │
│             │ postMessage / onDidReceiveMessage                   │
│             │                                                     │
└─────────────┼───────────────────────────────────────────────────┘
              │  iframe boundary
┌─────────────┼───────────────────────────────────────────────────┐
│             │           Webview (React)                          │
│  ┌──────────┴───────────────────────────────────────────────┐   │
│  │                    App.tsx                                │   │
│  │   ┌────────────────────┐  ┌────────────────────────────┐ │   │
│  │   │   CanvasPanel      │  │      LLMPanel              │ │   │
│  │   │  (ReactFlow)       │  │   - prompt input           │ │   │
│  │   │  - custom nodes    │  │   - streaming response     │ │   │
│  │   │  - edge drawing    │  │   - pending patch preview  │ │   │
│  │   │  - drag/drop       │  └────────────────────────────┘ │   │
│  │   │  - context menu    │                                  │   │
│  │   └────────────────────┘                                  │   │
│  │                                                            │   │
│  │   useVSCodeBridge() hook — handles all postMessage I/O    │   │
│  └────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow: Human Edits

```
User drags node
  → ReactFlow onNodesChange fires
  → useVSCodeBridge debounces 300ms
  → posts { type: 'APPLY_HUMAN_EDIT', patch: RFC6902Patch } to extension
  → DiagramEditorProvider.updateDocument() applies patch to TextDocument
  → onDidChangeTextDocument fires, posts { type: 'DOCUMENT_UPDATED', doc } back
  → webview updates ReactFlow state from new doc (idempotent, no loop)
```

### Data Flow: LLM Edits

```
User types prompt, presses Enter
  → webview posts { type: 'LLM_PROMPT', prompt: string, selection: string[] } 
  → LLMService.buildContext(doc, selection) builds compressed context
  → LLMService.callConfiguredLLM(context, prompt) → returns RFC6902 patch
  → LLMService.validatePatch(patch, doc) — dry-run, check referential integrity
  → DiagramEditorProvider.updateDocument() applies patch
  → onDidChangeTextDocument → webview re-renders
  → auto-layout runs ONLY on unpinned nodes with x=0, y=0
```

---

## 4. Repository Structure

```
diagramflow/
├── package.json                    # Extension manifest + scripts
├── tsconfig.json                   # Extension host TypeScript config
├── tsconfig.webview.json           # Webview TypeScript config
├── esbuild.config.mjs              # Build configuration
├── .vscodeignore
├── CHANGELOG.md
│
├── src/                            # Extension host source
│   ├── extension.ts                # Activation, command registration
│   ├── DiagramEditorProvider.ts    # CustomTextEditorProvider
│   ├── LLMService.ts               # All LLM logic
│   ├── PatchEngine.ts              # RFC6902 patch apply + validate
│   ├── SchemaValidator.ts          # JSON Schema validation of DiagramDocument
│   ├── ExportService.ts            # SVG / PNG / Mermaid export
│   ├── getWebviewContent.ts        # HTML shell generation
│   ├── types/
│   │   └── DiagramDocument.ts     # Canonical type definitions (shared)
│   └── messages/
│       └── protocol.ts            # All message type definitions
│
├── webview/                        # Webview React application
│   ├── index.tsx                   # React root
│   ├── App.tsx                     # Root component
│   ├── hooks/
│   │   ├── useVSCodeBridge.ts      # postMessage ↔ onmessage bridge
│   │   ├── useGraphState.ts        # ReactFlow nodes/edges state management
│   │   └── useLLMStream.ts         # LLM streaming state
│   ├── components/
│   │   ├── CanvasPanel/
│   │   │   ├── index.tsx           # ReactFlow wrapper
│   │   │   ├── CustomNode.tsx      # All node shape renderers
│   │   │   ├── CustomEdge.tsx      # Edge with label
│   │   │   ├── NodeContextMenu.tsx # Right-click menu
│   │   │   └── Toolbar.tsx         # Canvas toolbar (layout, export, etc.)
│   │   └── LLMPanel/
│   │       ├── index.tsx           # Prompt panel
│   │       ├── PatchPreview.tsx    # Shows what LLM wants to change
│   │       └── StreamingIndicator.tsx
│   ├── lib/
│   │   ├── docToFlow.ts            # DiagramDocument → ReactFlow nodes/edges
│   │   ├── flowToDoc.ts            # ReactFlow state → DiagramDocument patches
│   │   ├── layoutEngine.ts         # Partial dagre layout (respects pinned)
│   │   └── exporters.ts            # SVG/Mermaid serializers
│   └── styles/
│       └── canvas.css
│
├── test/
│   ├── unit/
│   │   ├── PatchEngine.test.ts
│   │   ├── SchemaValidator.test.ts
│   │   ├── docToFlow.test.ts
│   │   ├── flowToDoc.test.ts
│   │   └── layoutEngine.test.ts
│   ├── e2e/
│   │   ├── wdio.conf.ts
│   │   ├── fixtures/
│   │   │   ├── simple.diagram      # Minimal test fixture
│   │   │   ├── complex.diagram     # Many nodes
│   │   │   └── empty.diagram       # New file scenario
│   │   └── specs/
│   │       ├── 01-open-file.spec.ts
│   │       ├── 02-drag-node.spec.ts
│   │       ├── 03-add-node.spec.ts
│   │       ├── 04-add-edge.spec.ts
│   │       ├── 05-delete-node.spec.ts
│   │       ├── 06-llm-prompt.spec.ts
│   │       ├── 07-undo-redo.spec.ts
│   │       ├── 08-export.spec.ts
│   │       └── 09-file-sync.spec.ts
│   └── helpers/
│       ├── webviewHelper.ts        # Switch iframe context, get webview elements
│       └── fileHelper.ts          # Create/read/write .diagram files in temp dir
│
└── scripts/
    └── generate-test-fixtures.ts  # Script to generate fixture files programmatically
```

---

## 5. Extension Host (TypeScript)

### `extension.ts`

```typescript
import * as vscode from 'vscode';
import { DiagramEditorProvider } from './DiagramEditorProvider';

export function activate(context: vscode.ExtensionContext) {
  // Register custom editor for .diagram files
  context.subscriptions.push(
    DiagramEditorProvider.register(context)
  );

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
    })
  );
}

export function deactivate() {}
```

### `DiagramEditorProvider.ts`

```typescript
import * as vscode from 'vscode';
import { LLMService } from './LLMService';
import { PatchEngine } from './PatchEngine';
import { SchemaValidator } from './SchemaValidator';
import { getWebviewContent } from './getWebviewContent';
import { DiagramDocument } from './types/DiagramDocument';
import { ExtensionMessage, WebviewMessage } from './messages/protocol';

export class DiagramEditorProvider implements vscode.CustomTextEditorProvider {
  public static readonly viewType = 'diagramflow.editor';

  private readonly llmService: LLMService;
  private readonly patchEngine: PatchEngine;
  private readonly validator: SchemaValidator;

  private constructor(private readonly context: vscode.ExtensionContext) {
    this.llmService = new LLMService(context);
    this.patchEngine = new PatchEngine();
    this.validator = new SchemaValidator();
  }

  public static register(context: vscode.ExtensionContext): vscode.Disposable {
    const provider = new DiagramEditorProvider(context);
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

    // Send initial document to webview once it signals ready
    const sendDocument = () => {
      const doc = this.parseDocument(document);
      this.postToWebview(webviewPanel, { type: 'DOCUMENT_UPDATED', doc });
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

        case 'APPLY_HUMAN_EDIT':
          await this.applyPatch(document, msg.patch, 'human');
          break;

        case 'LLM_PROMPT':
          await this.handleLLMPrompt(document, webviewPanel, msg.prompt, msg.selectedNodeIds);
          break;

        case 'EXPORT':
          await this.handleExport(document, msg.format, msg.svgContent);
          break;

        case 'REQUEST_LAYOUT':
          // User clicked "Auto Layout" button — unpin all nodes and re-layout
          await this.applyPatch(document, this.buildUnpinAllPatch(document), 'human');
          break;
      }
    });

    webviewPanel.onDidDispose(() => {
      changeSubscription.dispose();
    });
  }

  private parseDocument(document: vscode.TextDocument): DiagramDocument {
    try {
      return JSON.parse(document.getText()) as DiagramDocument;
    } catch {
      // Return empty valid document on parse error
      return this.emptyDocument();
    }
  }

  private async applyPatch(
    document: vscode.TextDocument,
    patch: object[],
    source: 'human' | 'llm'
  ): Promise<void> {
    const current = this.parseDocument(document);
    const result = this.patchEngine.apply(current, patch);

    if (!result.success) {
      vscode.window.showErrorMessage(`Diagram patch failed: ${result.error}`);
      return;
    }

    const validation = this.validator.validate(result.document!);
    if (!validation.valid) {
      vscode.window.showErrorMessage(`Invalid diagram after patch: ${validation.errors.join(', ')}`);
      return;
    }

    // Increment version and update modified timestamp
    result.document!.meta.version += 1;
    result.document!.meta.modified = new Date().toISOString();

    const newText = JSON.stringify(result.document, null, 2);
    const edit = new vscode.WorkspaceEdit();
    edit.replace(
      document.uri,
      new vscode.Range(0, 0, document.lineCount, 0),
      newText
    );
    await vscode.workspace.applyEdit(edit);
  }

  private async handleLLMPrompt(
    document: vscode.TextDocument,
    panel: vscode.WebviewPanel,
    prompt: string,
    selectedNodeIds: string[]
  ): Promise<void> {
    this.postToWebview(panel, { type: 'LLM_THINKING', thinking: true });

    try {
      const doc = this.parseDocument(document);
      const patch = await this.llmService.generatePatch(doc, prompt, selectedNodeIds);

      // Preview the patch in the webview before applying
      this.postToWebview(panel, { type: 'LLM_PATCH_PREVIEW', patch });

      // Auto-apply after 800ms unless cancelled (webview can send CANCEL_PATCH)
      // For now: auto-apply immediately (configurable setting later)
      await this.applyPatch(document, patch, 'llm');
    } catch (err: any) {
      this.postToWebview(panel, { type: 'LLM_ERROR', error: err.message });
    } finally {
      this.postToWebview(panel, { type: 'LLM_THINKING', thinking: false });
    }
  }

  private postToWebview(panel: vscode.WebviewPanel, msg: ExtensionMessage): void {
    panel.webview.postMessage(msg);
  }

  private buildUnpinAllPatch(document: vscode.TextDocument): object[] {
    const doc = this.parseDocument(document);
    return doc.nodes.map((_, i) => ({
      op: 'replace',
      path: `/nodes/${i}/pinned`,
      value: false,
    }));
  }

  private emptyDocument(): DiagramDocument {
    return {
      $schema: 'https://diagramflow/schema/v1',
      meta: {
        title: 'Untitled Diagram',
        created: new Date().toISOString(),
        modified: new Date().toISOString(),
        version: 1,
      },
      nodes: [],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
    };
  }
}
```

### `PatchEngine.ts`

```typescript
import { applyPatch, validate } from 'fast-json-patch';
import { DiagramDocument } from './types/DiagramDocument';

export interface PatchResult {
  success: boolean;
  document?: DiagramDocument;
  error?: string;
}

export class PatchEngine {
  apply(document: DiagramDocument, patch: object[]): PatchResult {
    try {
      // Deep clone to avoid mutation
      const clone = JSON.parse(JSON.stringify(document)) as DiagramDocument;
      
      // Validate patch structure
      const errors = validate(patch as any, clone);
      if (errors && errors.length > 0) {
        return { success: false, error: `Invalid patch: ${errors[0].message}` };
      }

      const result = applyPatch(clone, patch as any, true, false);
      
      // Check for referential integrity after patch
      const integrityError = this.checkIntegrity(result.newDocument as DiagramDocument);
      if (integrityError) {
        return { success: false, error: integrityError };
      }

      return { success: true, document: result.newDocument as DiagramDocument };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  private checkIntegrity(doc: DiagramDocument): string | null {
    const nodeIds = new Set(doc.nodes.map(n => n.id));
    const groupIds = new Set((doc.groups ?? []).map(g => g.id));

    for (const edge of doc.edges) {
      if (!nodeIds.has(edge.source)) {
        return `Edge ${edge.id} references non-existent source node: ${edge.source}`;
      }
      if (!nodeIds.has(edge.target)) {
        return `Edge ${edge.id} references non-existent target node: ${edge.target}`;
      }
    }

    for (const node of doc.nodes) {
      if (node.group && !groupIds.has(node.group)) {
        return `Node ${node.id} references non-existent group: ${node.group}`;
      }
    }

    return null;
  }
}
```

### `LLMService.ts`

```typescript
import * as vscode from 'vscode';
import { DiagramDocument, DiagramNode } from './types/DiagramDocument';

const SYSTEM_PROMPT = `You are a diagram editor assistant. You modify diagrams by emitting RFC 6902 JSON Patch operations.

DIAGRAM SCHEMA:
- nodes: array of { id, label, x, y, width, height, shape, color, pinned, notes?, group? }
- edges: array of { id, source, target, label?, style, arrow, animated? }
- id values: 8-character alphanumeric strings (use format: "xxxxxxxx")
- shapes: rectangle, rounded, diamond, cylinder, circle, parallelogram, hexagon, document
- colors: default, blue, green, red, yellow, purple, gray
- edge styles: solid, dashed, dotted
- edge arrows: arrow, open, none

RULES:
1. ONLY emit RFC 6902 JSON patch operations: add, remove, replace, move, copy
2. NEVER rewrite the entire document
3. When adding a NEW node: set x=0, y=0 (layout engine will position it)
4. When adding a NEW node: set pinned=false
5. When modifying a human-positioned node: do NOT change x, y, or pinned
6. Node ids must be unique 8-char alphanumeric strings
7. Edge ids must be unique 8-char alphanumeric strings
8. Always maintain referential integrity (edge sources/targets must exist)
9. When removing a node, also remove all edges connected to it

OUTPUT FORMAT: Return ONLY a JSON array of patch operations. No explanation, no markdown, no preamble.

EXAMPLE OUTPUT:
[
  { "op": "add", "path": "/nodes/-", "value": { "id": "ab12cd34", "label": "New Service", "x": 0, "y": 0, "width": 160, "height": 48, "shape": "rounded", "color": "blue", "pinned": false } },
  { "op": "add", "path": "/edges/-", "value": { "id": "ef56gh78", "source": "existingNodeId", "target": "ab12cd34", "style": "solid", "arrow": "arrow" } }
]`;

export class LLMService {
  constructor(private readonly context: vscode.ExtensionContext) {}

  async generatePatch(
    doc: DiagramDocument,
    prompt: string,
    selectedNodeIds: string[]
  ): Promise<object[]> {
    const config = vscode.workspace.getConfiguration('diagramflow');
    const provider = config.get<string>('llm.provider', 'anthropic');

    const context = this.buildContext(doc, selectedNodeIds);
    const userMessage = this.buildUserMessage(prompt, context, selectedNodeIds);

    const rawResponse = await this.callLLM(provider, userMessage);
    return this.parseAndValidatePatchResponse(rawResponse, doc);
  }

  private buildContext(doc: DiagramDocument, selectedNodeIds: string[]): string {
    // If nodes are selected, only include those nodes + their immediate edges
    // This keeps the context window small for large diagrams
    const relevantNodes = selectedNodeIds.length > 0
      ? doc.nodes.filter(n => selectedNodeIds.includes(n.id))
      : doc.nodes;

    const relevantNodeIds = new Set(relevantNodes.map(n => n.id));
    const relevantEdges = doc.edges.filter(
      e => relevantNodeIds.has(e.source) || relevantNodeIds.has(e.target)
    );

    // Compact representation — omit default values to save tokens
    const compactNodes = relevantNodes.map(n => ({
      id: n.id,
      label: n.label,
      shape: n.shape !== 'rectangle' ? n.shape : undefined,
      color: n.color !== 'default' ? n.color : undefined,
      pinned: n.pinned || undefined,
      group: n.group,
    })).map(n => JSON.stringify(n)).join('\n');

    const compactEdges = relevantEdges.map(e => ({
      id: e.id,
      source: e.source,
      target: e.target,
      label: e.label,
      style: e.style !== 'solid' ? e.style : undefined,
    })).map(e => JSON.stringify(e)).join('\n');

    return `NODES:\n${compactNodes}\n\nEDGES:\n${compactEdges}`;
  }

  private buildUserMessage(prompt: string, context: string, selectedIds: string[]): string {
    const selectionNote = selectedIds.length > 0
      ? `\nSelected node ids: ${selectedIds.join(', ')} — focus changes on these nodes if relevant.\n`
      : '';
    return `Current diagram state:\n${context}${selectionNote}\nRequest: ${prompt}`;
  }

  private async callLLM(provider: string, userMessage: string): Promise<string> {
    // Implementation depends on provider setting
    // Supports: 'anthropic', 'openai', 'ollama'
    // Each uses the configured API key from VSCode settings
    
    const config = vscode.workspace.getConfiguration('diagramflow.llm');
    
    switch (provider) {
      case 'anthropic':
        return this.callAnthropic(config, userMessage);
      case 'openai':
        return this.callOpenAI(config, userMessage);
      case 'ollama':
        return this.callOllama(config, userMessage);
      default:
        throw new Error(`Unknown LLM provider: ${provider}`);
    }
  }

  private async callAnthropic(config: vscode.WorkspaceConfiguration, userMessage: string): Promise<string> {
    const apiKey = config.get<string>('apiKey', '');
    const model = config.get<string>('model', 'claude-sonnet-4-6');
    
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json() as any;
    return data.content[0].text;
  }

  private async callOpenAI(config: vscode.WorkspaceConfiguration, userMessage: string): Promise<string> {
    const apiKey = config.get<string>('apiKey', '');
    const model = config.get<string>('model', 'gpt-4o');
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ],
        response_format: { type: 'json_object' },
      }),
    });

    const data = await response.json() as any;
    return data.choices[0].message.content;
  }

  private async callOllama(config: vscode.WorkspaceConfiguration, userMessage: string): Promise<string> {
    const baseUrl = config.get<string>('ollamaBaseUrl', 'http://localhost:11434');
    const model = config.get<string>('model', 'llama3.1');
    
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ],
        stream: false,
        format: 'json',
      }),
    });

    const data = await response.json() as any;
    return data.message.content;
  }

  private parseAndValidatePatchResponse(raw: string, doc: DiagramDocument): object[] {
    // Strip markdown fences if present
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    let patch: object[];
    try {
      const parsed = JSON.parse(cleaned);
      // Handle both array-wrapped and direct array responses
      patch = Array.isArray(parsed) ? parsed : parsed.patch ?? parsed.operations ?? [];
    } catch {
      throw new Error('LLM returned invalid JSON. Please try again.');
    }

    if (!Array.isArray(patch) || patch.length === 0) {
      throw new Error('LLM returned an empty patch. No changes to apply.');
    }

    return patch;
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
import { LLMPanel } from './components/LLMPanel';
import { useVSCodeBridge } from './hooks/useVSCodeBridge';
import { useGraphState } from './hooks/useGraphState';
import type { DiagramDocument } from '../src/types/DiagramDocument';

export default function App() {
  const [doc, setDoc] = useState<DiagramDocument | null>(null);
  const [llmThinking, setLLMThinking] = useState(false);
  const [llmError, setLLMError] = useState<string | null>(null);

  const bridge = useVSCodeBridge({
    onDocumentUpdated: setDoc,
    onLLMThinking: setLLMThinking,
    onLLMError: setLLMError,
  });

  const graphState = useGraphState(doc, bridge.postHumanEdit);

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
        onNodeDelete={graphState.onNodeDelete}
        onEdgeDelete={graphState.onEdgeDelete}
        onNodeLabelEdit={graphState.onNodeLabelEdit}
        onRequestLayout={() => bridge.postMessage({ type: 'REQUEST_LAYOUT' })}
        onExport={(format) => bridge.postMessage({ type: 'EXPORT', format })}
        selectedNodeIds={graphState.selectedNodeIds}
        onSelectionChange={graphState.setSelectedNodeIds}
      />
      <LLMPanel
        thinking={llmThinking}
        error={llmError}
        onPrompt={(prompt) => bridge.postMessage({
          type: 'LLM_PROMPT',
          prompt,
          selectedNodeIds: graphState.selectedNodeIds,
        })}
        onClearError={() => setLLMError(null)}
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

// VSCode API available inside webview context
declare const acquireVsCodeApi: () => {
  postMessage: (msg: WebviewMessage) => void;
  getState: () => unknown;
  setState: (state: unknown) => void;
};

interface BridgeOptions {
  onDocumentUpdated: (doc: DiagramDocument) => void;
  onLLMThinking: (thinking: boolean) => void;
  onLLMError: (error: string) => void;
}

export function useVSCodeBridge(options: BridgeOptions) {
  const vscode = useRef(acquireVsCodeApi());

  const postMessage = useCallback((msg: WebviewMessage) => {
    vscode.current.postMessage(msg);
  }, []);

  // Debounced human edit poster
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>();
  const postHumanEdit = useCallback((patch: object[]) => {
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      postMessage({ type: 'APPLY_HUMAN_EDIT', patch });
    }, 300);
  }, [postMessage]);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data as ExtensionMessage;
      switch (msg.type) {
        case 'DOCUMENT_UPDATED':
          options.onDocumentUpdated(msg.doc);
          break;
        case 'LLM_THINKING':
          options.onLLMThinking(msg.thinking);
          break;
        case 'LLM_ERROR':
          options.onLLMError(msg.error);
          break;
      }
    };

    window.addEventListener('message', handler);

    // Signal ready to receive initial document
    postMessage({ type: 'WEBVIEW_READY' });

    return () => window.removeEventListener('message', handler);
  }, []);

  return { postMessage, postHumanEdit };
}
```

### `webview/lib/docToFlow.ts`

```typescript
import { Node, Edge } from '@xyflow/react';
import type { DiagramDocument, DiagramNode, DiagramEdge } from '../../src/types/DiagramDocument';

export function docToFlowNodes(doc: DiagramDocument): Node[] {
  return doc.nodes.map(n => ({
    id: n.id,
    type: 'diagramNode',         // our custom node type
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
    type: 'diagramEdge',         // our custom edge type
    label: e.label,
    animated: e.animated ?? false,
    data: {
      style: e.style,
      arrow: e.arrow,
    },
  }));
}
```

### `webview/lib/flowToDoc.ts`

```typescript
import { Node, Edge, NodeChange, EdgeChange } from '@xyflow/react';
import type { DiagramDocument } from '../../src/types/DiagramDocument';

/**
 * Converts ReactFlow node position changes into RFC 6902 patch operations.
 * Only emits patches for actual position changes on draggable nodes.
 */
export function nodeChangesToPatch(
  doc: DiagramDocument,
  changes: NodeChange[]
): object[] {
  const ops: object[] = [];

  for (const change of changes) {
    if (change.type === 'position' && change.position && !change.dragging) {
      const idx = doc.nodes.findIndex(n => n.id === change.id);
      if (idx === -1) continue;

      ops.push(
        { op: 'replace', path: `/nodes/${idx}/x`, value: Math.round(change.position.x) },
        { op: 'replace', path: `/nodes/${idx}/y`, value: Math.round(change.position.y) },
        { op: 'replace', path: `/nodes/${idx}/pinned`, value: true }   // Mark as pinned on human drag
      );
    }

    if (change.type === 'dimensions' && change.dimensions) {
      const idx = doc.nodes.findIndex(n => n.id === change.id);
      if (idx === -1) continue;
      ops.push(
        { op: 'replace', path: `/nodes/${idx}/width`, value: Math.round(change.dimensions.width) },
        { op: 'replace', path: `/nodes/${idx}/height`, value: Math.round(change.dimensions.height) }
      );
    }
  }

  return ops;
}

export function addNodePatch(doc: DiagramDocument, node: Partial<DiagramDocument['nodes'][0]>): object[] {
  return [{ op: 'add', path: '/nodes/-', value: { ...defaultNode(), ...node } }];
}

export function removeNodePatch(doc: DiagramDocument, nodeId: string): object[] {
  const ops: object[] = [];
  
  // Remove all connected edges first
  const edgesToRemove = doc.edges
    .map((e, i) => ({ e, i }))
    .filter(({ e }) => e.source === nodeId || e.target === nodeId)
    .reverse();  // reverse so indices stay valid
  
  for (const { i } of edgesToRemove) {
    ops.push({ op: 'remove', path: `/edges/${i}` });
  }
  
  const nodeIdx = doc.nodes.findIndex(n => n.id === nodeId);
  if (nodeIdx !== -1) {
    ops.push({ op: 'remove', path: `/nodes/${nodeIdx}` });
  }
  
  return ops;
}

export function addEdgePatch(doc: DiagramDocument, edge: DiagramDocument['edges'][0]): object[] {
  return [{ op: 'add', path: '/edges/-', value: edge }];
}

export function removeEdgePatch(doc: DiagramDocument, edgeId: string): object[] {
  const idx = doc.edges.findIndex(e => e.id === edgeId);
  if (idx === -1) return [];
  return [{ op: 'remove', path: `/edges/${idx}` }];
}

export function updateNodeLabelPatch(doc: DiagramDocument, nodeId: string, label: string): object[] {
  const idx = doc.nodes.findIndex(n => n.id === nodeId);
  if (idx === -1) return [];
  return [{ op: 'replace', path: `/nodes/${idx}/label`, value: label }];
}

function defaultNode() {
  return {
    x: 0, y: 0, width: 160, height: 48,
    shape: 'rectangle', color: 'default', pinned: false,
  };
}
```

### `webview/lib/layoutEngine.ts`

```typescript
import dagre from '@dagrejs/dagre';
import type { DiagramDocument, DiagramNode } from '../../src/types/DiagramDocument';

/**
 * Runs auto-layout ONLY on unpinned nodes with no position (x=0, y=0).
 * Pinned nodes are treated as fixed constraints.
 * Returns RFC 6902 patches to position the unpinned nodes.
 */
export function computePartialLayout(doc: DiagramDocument): object[] {
  const unpinnedNew = doc.nodes.filter(n => !n.pinned && n.x === 0 && n.y === 0);
  
  if (unpinnedNew.length === 0) return [];

  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'LR', ranksep: 100, nodesep: 60 });

  // Add ALL nodes to dagre (pinned ones as fixed anchors with their existing positions)
  for (const node of doc.nodes) {
    g.setNode(node.id, { width: node.width, height: node.height });
  }

  for (const edge of doc.edges) {
    if (g.hasNode(edge.source) && g.hasNode(edge.target)) {
      g.setEdge(edge.source, edge.target);
    }
  }

  dagre.layout(g);

  const ops: object[] = [];

  for (const node of unpinnedNew) {
    const laid = g.node(node.id);
    if (!laid) continue;
    const idx = doc.nodes.findIndex(n => n.id === node.id);
    
    // Position the new node, offset from its dagre position
    // If there are pinned nodes nearby, dagre will have arranged around them
    ops.push(
      { op: 'replace', path: `/nodes/${idx}/x`, value: Math.round(laid.x - node.width / 2) },
      { op: 'replace', path: `/nodes/${idx}/y`, value: Math.round(laid.y - node.height / 2) }
    );
  }

  return ops;
}
```

---

## 7. LLM Integration Protocol

### System Prompt Strategy

The system prompt (defined in `LLMService.ts`) is fixed and never changes. It defines the patch format contract. This makes LLM behavior predictable and testable.

### Context Compression

For diagrams with >50 nodes, the context sent to the LLM is compressed:
1. If nodes are selected: only selected nodes + their 1-hop neighborhood
2. Omit default values from node JSON (`shape: 'rectangle'` → omitted)
3. Omit positions (`x`, `y`) — the LLM should not try to set positions for existing nodes
4. Cap at 100 nodes maximum; if over, include only the selection neighborhood

### Patch Validation

Before applying any LLM patch to the document, the PatchEngine runs:
1. RFC 6902 structural validation
2. Referential integrity check (node ids, edge source/target)
3. Schema validation on the resulting document

If validation fails, the error is shown in the LLM panel. Nothing is written to the file.

### Prompt Examples That Should Work

```
"add a Redis cache between the Auth Service and the Database"
"rename the Auth Service node to API Gateway"  
"split the monolith into three microservices: users, orders, payments"
"add a load balancer in front of all the web servers"
"connect the frontend to all three backend services with dashed lines"
"remove the deprecated gateway and reconnect its edges directly"
"group the database nodes and mark them red"
```

---

## 8. Message Protocol (Extension ↔ Webview)

### `src/messages/protocol.ts`

```typescript
import type { DiagramDocument } from '../types/DiagramDocument';

// Messages FROM webview TO extension
export type WebviewMessage =
  | { type: 'WEBVIEW_READY' }
  | { type: 'APPLY_HUMAN_EDIT'; patch: object[] }
  | { type: 'LLM_PROMPT'; prompt: string; selectedNodeIds: string[] }
  | { type: 'EXPORT'; format: 'svg' | 'png' | 'mermaid'; svgContent?: string }
  | { type: 'REQUEST_LAYOUT' }
  | { type: 'CANCEL_PATCH' };

// Messages FROM extension TO webview
export type ExtensionMessage =
  | { type: 'DOCUMENT_UPDATED'; doc: DiagramDocument }
  | { type: 'LLM_THINKING'; thinking: boolean }
  | { type: 'LLM_PATCH_PREVIEW'; patch: object[] }
  | { type: 'LLM_ERROR'; error: string };
```

---

## 9. Layout Engine

### Behavior Contract

| Node state | Auto-layout behavior |
|---|---|
| `pinned: true` | Never moved. Position in JSON is authoritative. |
| `pinned: false, x=0, y=0` | Position computed by dagre on each LLM add |
| `pinned: false, x≠0 or y≠0` | Position preserved (user may have dragged before pin) |

### When Layout Runs

- **After LLM applies a patch** that added one or more nodes with `x=0, y=0`
- **When user clicks "Auto Layout"** — unpins all nodes, runs full dagre, re-pins all

### Layout Algorithm Configuration

```typescript
g.setGraph({
  rankdir: 'LR',   // left-to-right (most natural for architecture diagrams)
  ranksep: 120,    // pixels between ranks (columns)
  nodesep: 60,     // pixels between nodes in same rank
  marginx: 40,
  marginy: 40,
});
```

---

## 10. Node & Edge Types

### Custom Node Component (`CustomNode.tsx`)

```tsx
// Each node shape is a separate SVG-based renderer
// The node data contains: label, shape, color, pinned, notes, width, height

const SHAPE_RENDERERS: Record<NodeShape, React.FC<NodeRenderProps>> = {
  rectangle:     RectangleNode,
  rounded:       RoundedNode,
  diamond:       DiamondNode,
  cylinder:      CylinderNode,
  circle:        CircleNode,
  parallelogram: ParallelogramNode,
  hexagon:       HexagonNode,
  document:      DocumentNode,
};

// All shapes must render handles on all 4 sides
// Pinned nodes show a lock icon (🔒) in top-right corner
// Double-click opens inline label editor (contenteditable div)
// Right-click opens NodeContextMenu
```

### Node Color Palette

```typescript
export const COLOR_VARS: Record<NodeColor, { bg: string; border: string; text: string }> = {
  default:  { bg: 'var(--vscode-editor-background)',      border: 'var(--vscode-foreground)',    text: 'var(--vscode-foreground)' },
  blue:     { bg: '#1e3a5f',  border: '#4a9eff', text: '#4a9eff' },
  green:    { bg: '#1a3a1f',  border: '#4ade80', text: '#4ade80' },
  red:      { bg: '#3a1a1a',  border: '#f87171', text: '#f87171' },
  yellow:   { bg: '#3a321a',  border: '#fbbf24', text: '#fbbf24' },
  purple:   { bg: '#2e1a3a',  border: '#c084fc', text: '#c084fc' },
  gray:     { bg: '#2a2a2a',  border: '#9ca3af', text: '#9ca3af' },
};
// Colors respect both dark and light VSCode themes
```

### Edge Types

```tsx
// Custom edge: draws label, respects style (solid/dashed/dotted)
// Uses bezier path by default
// Animated edges use CSS dash animation
// Click edge to select, Delete key to remove
```

---

## 11. Build System

### `esbuild.config.mjs`

```javascript
import * as esbuild from 'esbuild';
import { resolve } from 'path';

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

### `package.json` (relevant sections)

```json
{
  "name": "diagramflow",
  "displayName": "DiagramFlow",
  "description": "LLM-powered diagram editor with human-in-the-loop editing",
  "version": "0.1.0",
  "engines": { "vscode": "^1.85.0" },
  "categories": ["Visualization", "Other"],
  "activationEvents": ["onCustomEditor:diagramflow.editor"],
  "main": "./dist/extension.js",
  "contributes": {
    "customEditors": [{
      "viewType": "diagramflow.editor",
      "displayName": "DiagramFlow Editor",
      "selector": [{ "filenamePattern": "*.diagram" }],
      "priority": "default"
    }],
    "commands": [
      { "command": "diagramflow.newDiagram", "title": "DiagramFlow: New Diagram" },
      { "command": "diagramflow.exportSVG", "title": "DiagramFlow: Export as SVG" },
      { "command": "diagramflow.exportMermaid", "title": "DiagramFlow: Export as Mermaid" }
    ],
    "configuration": {
      "title": "DiagramFlow",
      "properties": {
        "diagramflow.llm.provider": {
          "type": "string",
          "enum": ["anthropic", "openai", "ollama"],
          "default": "anthropic",
          "description": "LLM provider for diagram generation"
        },
        "diagramflow.llm.apiKey": {
          "type": "string",
          "default": "",
          "description": "API key for the configured LLM provider"
        },
        "diagramflow.llm.model": {
          "type": "string",
          "default": "",
          "description": "Model to use (leave blank for provider default)"
        },
        "diagramflow.llm.ollamaBaseUrl": {
          "type": "string",
          "default": "http://localhost:11434",
          "description": "Ollama base URL (only used when provider=ollama)"
        }
      }
    }
  },
  "scripts": {
    "build": "node esbuild.config.mjs",
    "watch": "node esbuild.config.mjs --watch",
    "test:unit": "vitest run test/unit",
    "test:e2e": "wdio run test/e2e/wdio.conf.ts",
    "test": "npm run test:unit && npm run test:e2e",
    "package": "vsce package",
    "lint": "eslint src webview --ext .ts,.tsx"
  }
}
```

---

## 12. Testing Strategy

### Philosophy

**Unit tests are the primary correctness mechanism.** E2E tests verify integration at the VSCode level. The split is:

- **Unit tests (Vitest):** All pure logic — PatchEngine, SchemaValidator, docToFlow, flowToDoc, layoutEngine. These run in <1 second and are the agent's primary feedback loop.
- **E2E tests (WebdriverIO + wdio-vscode-service):** User-level scenarios — open file, drag node, LLM prompt, undo/redo. These run in ~30 seconds and catch integration failures.

### Agent-Friendly Test Design

Every test file follows this contract:
1. **Zero shared mutable state** — each test creates its own fixture
2. **Explicit assertions** — no "it works" tests, every assertion checks a specific value
3. **Fixture-driven** — test fixtures are deterministic JSON files in `test/e2e/fixtures/`
4. **Self-describing test IDs** — test names read as behavior specs, not implementation details

---

## 13. E2E Testing with WebdriverIO

### `test/e2e/wdio.conf.ts`

```typescript
import type { Options } from '@wdio/types';
import path from 'path';

export const config: Options.Testrunner = {
  runner: 'local',
  specs: ['test/e2e/specs/**/*.spec.ts'],
  maxInstances: 1,  // VSCode E2E must run serially
  capabilities: [{
    browserName: 'vscode',
    browserVersion: 'stable',
    'wdio:enforceWebDriverClassic': true,
    'wdio:vscodeOptions': {
      extensionPath: path.resolve(__dirname, '../../'),
      workspacePath: path.resolve(__dirname, '../fixtures'),
      userSettings: {
        'diagramflow.llm.provider': 'anthropic',
        'diagramflow.llm.apiKey': process.env.ANTHROPIC_API_KEY ?? 'test-key',
      },
    },
  }],
  services: ['vscode'],
  framework: 'mocha',
  reporters: ['spec'],
  mochaOpts: { timeout: 60000 },
};
```

### `test/helpers/webviewHelper.ts`

```typescript
import { browser } from '@wdio/globals';

export class WebviewHelper {
  /**
   * Switch WebDriver context into the DiagramFlow webview iframe.
   * Must be called before interacting with any canvas elements.
   */
  static async enterWebview() {
    const workbench = await browser.getWorkbench();
    const webviews = await workbench.getAllWebViews();
    const diagramWebview = webviews.find(async (wv) =>
      (await wv.getTitle()).includes('DiagramFlow') ||
      (await wv.getViewType()) === 'diagramflow.editor'
    );
    if (!diagramWebview) throw new Error('DiagramFlow webview not found');
    await diagramWebview.open();
  }

  /**
   * Exit webview iframe context back to main VSCode.
   */
  static async exitWebview() {
    await browser.switchToFrame(null);
  }

  /**
   * Get a ReactFlow node element by its diagram node id.
   */
  static async getNodeElement(nodeId: string) {
    return browser.$(`[data-id="${nodeId}"]`);
  }

  /**
   * Get a ReactFlow edge element by its diagram edge id.
   */
  static async getEdgeElement(edgeId: string) {
    return browser.$(`[data-testid="edge-${edgeId}"]`);
  }

  /**
   * Read the diagram JSON from the active TextDocument via VSCode API.
   * This bypasses the webview to test the actual file state.
   */
  static async getDocumentJSON(): Promise<any> {
    const workbench = await browser.getWorkbench();
    const result = await browser.executeWorkbench((vscode) => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return null;
      return editor.document.getText();
    });
    return result ? JSON.parse(result as string) : null;
  }

  /**
   * Write content to the active document via VSCode API.
   */
  static async setDocumentJSON(content: object): Promise<void> {
    const text = JSON.stringify(content, null, 2);
    await browser.executeWorkbench((vscode, txt) => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;
      const edit = new vscode.WorkspaceEdit();
      edit.replace(editor.document.uri, new vscode.Range(0, 0, editor.document.lineCount, 0), txt);
      return vscode.workspace.applyEdit(edit);
    }, text);
  }
}
```

### `test/e2e/specs/01-open-file.spec.ts`

```typescript
import { browser, expect } from '@wdio/globals';
import { WebviewHelper } from '../helpers/webviewHelper';

describe('01 - Open .diagram file', () => {
  before(async () => {
    const workbench = await browser.getWorkbench();
    await workbench.executeCommand('workbench.action.files.openFile');
    // Select the simple.diagram fixture
    const input = await workbench.openCommandPrompt();
    await input.setText('simple.diagram');
    await input.confirm();
    await browser.pause(1500);  // Wait for editor to load
  });

  it('should render the canvas webview', async () => {
    await WebviewHelper.enterWebview();
    const canvas = await browser.$('.react-flow');
    await expect(canvas).toBeExisting();
    await WebviewHelper.exitWebview();
  });

  it('should render the correct number of nodes', async () => {
    const doc = await WebviewHelper.getDocumentJSON();
    await WebviewHelper.enterWebview();
    const nodes = await browser.$$('.react-flow__node');
    expect(nodes.length).toBe(doc.nodes.length);
    await WebviewHelper.exitWebview();
  });

  it('should render edges', async () => {
    const doc = await WebviewHelper.getDocumentJSON();
    await WebviewHelper.enterWebview();
    const edges = await browser.$$('.react-flow__edge');
    expect(edges.length).toBe(doc.edges.length);
    await WebviewHelper.exitWebview();
  });
});
```

### `test/e2e/specs/02-drag-node.spec.ts`

```typescript
import { browser, expect } from '@wdio/globals';
import { WebviewHelper } from '../helpers/webviewHelper';

describe('02 - Drag node to new position', () => {
  let initialDoc: any;
  let targetNodeId: string;

  before(async () => {
    initialDoc = await WebviewHelper.getDocumentJSON();
    targetNodeId = initialDoc.nodes[0].id;
  });

  it('should update node position in JSON after drag', async () => {
    await WebviewHelper.enterWebview();
    const nodeEl = await WebviewHelper.getNodeElement(targetNodeId);

    const initialX = initialDoc.nodes[0].x;
    const initialY = initialDoc.nodes[0].y;

    // Simulate drag: move 150px to the right
    await nodeEl.dragAndDrop({ x: 150, y: 0 });
    await browser.pause(500);  // Wait for debounce + file write

    await WebviewHelper.exitWebview();

    const updatedDoc = await WebviewHelper.getDocumentJSON();
    const updatedNode = updatedDoc.nodes.find((n: any) => n.id === targetNodeId);

    expect(updatedNode.x).toBeGreaterThan(initialX + 100);
    expect(updatedNode.y).toBeCloseTo(initialY, 10);
  });

  it('should mark the dragged node as pinned', async () => {
    const doc = await WebviewHelper.getDocumentJSON();
    const node = doc.nodes.find((n: any) => n.id === targetNodeId);
    expect(node.pinned).toBe(true);
  });

  it('should be undoable via Ctrl+Z', async () => {
    const docBeforeUndo = await WebviewHelper.getDocumentJSON();
    const nodeBeforeUndo = docBeforeUndo.nodes.find((n: any) => n.id === targetNodeId);

    await browser.keys(['Control', 'z']);
    await browser.pause(500);

    const docAfterUndo = await WebviewHelper.getDocumentJSON();
    const nodeAfterUndo = docAfterUndo.nodes.find((n: any) => n.id === targetNodeId);

    expect(nodeAfterUndo.x).not.toEqual(nodeBeforeUndo.x);
    expect(docAfterUndo.meta.version).toBeLessThan(docBeforeUndo.meta.version);
  });
});
```

### `test/e2e/specs/06-llm-prompt.spec.ts`

```typescript
import { browser, expect } from '@wdio/globals';
import { WebviewHelper } from '../helpers/webviewHelper';

// NOTE: This test uses a MOCK LLM response for determinism.
// The wdio config sets MOCK_LLM=true for the test environment.
// When MOCK_LLM is true, LLMService returns a pre-canned patch instead of calling the API.

describe('06 - LLM prompt creates nodes', () => {
  let docBefore: any;

  before(async () => {
    docBefore = await WebviewHelper.getDocumentJSON();
    await WebviewHelper.enterWebview();
  });

  after(async () => {
    await WebviewHelper.exitWebview();
  });

  it('should show the LLM panel', async () => {
    const panel = await browser.$('[data-testid="llm-panel"]');
    await expect(panel).toBeExisting();
  });

  it('should accept a prompt and show thinking state', async () => {
    const input = await browser.$('[data-testid="llm-prompt-input"]');
    await input.setValue('add a cache between the API and the database');
    await input.keys(['Enter']);

    const thinking = await browser.$('[data-testid="llm-thinking-indicator"]');
    await expect(thinking).toBeExisting();
  });

  it('should add a new node after LLM responds', async () => {
    await browser.pause(3000);  // Wait for LLM response and file write

    const docAfter = await WebviewHelper.getDocumentJSON();
    expect(docAfter.nodes.length).toBeGreaterThan(docBefore.nodes.length);
  });

  it('should not have destroyed any pinned node positions', async () => {
    const docAfter = await WebviewHelper.getDocumentJSON();
    const pinnedBefore = docBefore.nodes.filter((n: any) => n.pinned);

    for (const node of pinnedBefore) {
      const after = docAfter.nodes.find((n: any) => n.id === node.id);
      expect(after).toBeDefined();
      expect(after.x).toBe(node.x);
      expect(after.y).toBe(node.y);
      expect(after.pinned).toBe(true);
    }
  });
});
```

### `test/e2e/specs/09-file-sync.spec.ts`

```typescript
// Verify that external edits to the .diagram file are reflected in the canvas
describe('09 - External file changes sync to canvas', () => {
  it('should re-render when file is modified externally', async () => {
    const docBefore = await WebviewHelper.getDocumentJSON();
    
    // Add a new node directly via VSCode API (simulates another process writing the file)
    const newNode = {
      id: 'sync0001',
      label: 'External Node',
      x: 400, y: 400,
      width: 160, height: 48,
      shape: 'rounded',
      color: 'green',
      pinned: false,
    };

    const modified = { ...docBefore, nodes: [...docBefore.nodes, newNode] };
    await WebviewHelper.setDocumentJSON(modified);
    await browser.pause(500);

    await WebviewHelper.enterWebview();
    const nodeEl = await WebviewHelper.getNodeElement('sync0001');
    await expect(nodeEl).toBeExisting();
    await WebviewHelper.exitWebview();
  });
});
```

---

## 14. Unit & Integration Tests

### `test/unit/PatchEngine.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { PatchEngine } from '../../src/PatchEngine';
import type { DiagramDocument } from '../../src/types/DiagramDocument';

const baseDoc = (): DiagramDocument => ({
  $schema: 'https://diagramflow/schema/v1',
  meta: { title: 'Test', created: '2025-01-01T00:00:00Z', modified: '2025-01-01T00:00:00Z', version: 1 },
  nodes: [
    { id: 'node0001', label: 'A', x: 100, y: 100, width: 160, height: 48, shape: 'rectangle', color: 'default', pinned: false },
    { id: 'node0002', label: 'B', x: 300, y: 100, width: 160, height: 48, shape: 'rectangle', color: 'default', pinned: false },
  ],
  edges: [
    { id: 'edge0001', source: 'node0001', target: 'node0002', style: 'solid', arrow: 'arrow' },
  ],
});

describe('PatchEngine', () => {
  const engine = new PatchEngine();

  it('should apply add node patch', () => {
    const result = engine.apply(baseDoc(), [
      { op: 'add', path: '/nodes/-', value: { id: 'node0003', label: 'C', x: 0, y: 0, width: 160, height: 48, shape: 'rectangle', color: 'default', pinned: false } }
    ]);
    expect(result.success).toBe(true);
    expect(result.document!.nodes.length).toBe(3);
    expect(result.document!.nodes[2].id).toBe('node0003');
  });

  it('should apply remove node patch', () => {
    const result = engine.apply(baseDoc(), [
      { op: 'remove', path: '/nodes/1' }
    ]);
    expect(result.success).toBe(true);
    expect(result.document!.nodes.length).toBe(1);
  });

  it('should reject patch that creates dangling edge', () => {
    const result = engine.apply(baseDoc(), [
      { op: 'remove', path: '/nodes/0' }
      // node0001 removed but edge still references it
    ]);
    expect(result.success).toBe(false);
    expect(result.error).toContain('non-existent source');
  });

  it('should apply position update', () => {
    const result = engine.apply(baseDoc(), [
      { op: 'replace', path: '/nodes/0/x', value: 500 },
      { op: 'replace', path: '/nodes/0/y', value: 250 },
    ]);
    expect(result.success).toBe(true);
    expect(result.document!.nodes[0].x).toBe(500);
    expect(result.document!.nodes[0].y).toBe(250);
  });

  it('should reject malformed patch operations', () => {
    const result = engine.apply(baseDoc(), [
      { op: 'replace', path: '/nodes/99/x', value: 100 }  // out of bounds
    ]);
    expect(result.success).toBe(false);
  });
});
```

### `test/unit/layoutEngine.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { computePartialLayout } from '../../webview/lib/layoutEngine';
import type { DiagramDocument } from '../../src/types/DiagramDocument';

describe('layoutEngine - partial layout', () => {
  it('should position unpinned nodes with x=0, y=0', () => {
    const doc: DiagramDocument = {
      $schema: 'https://diagramflow/schema/v1',
      meta: { title: '', created: '', modified: '', version: 1 },
      nodes: [
        { id: 'a', label: 'A', x: 100, y: 100, width: 160, height: 48, shape: 'rectangle', color: 'default', pinned: true },
        { id: 'b', label: 'B', x: 0, y: 0, width: 160, height: 48, shape: 'rectangle', color: 'default', pinned: false },
      ],
      edges: [{ id: 'e1', source: 'a', target: 'b', style: 'solid', arrow: 'arrow' }],
    };

    const patches = computePartialLayout(doc);
    expect(patches.length).toBeGreaterThan(0);

    const xPatch = patches.find((p: any) => p.path === '/nodes/1/x');
    const yPatch = patches.find((p: any) => p.path === '/nodes/1/y');
    expect(xPatch).toBeDefined();
    expect(yPatch).toBeDefined();
    // Node B should be positioned to the right of A (LR layout)
    expect((xPatch as any).value).toBeGreaterThan(100);
  });

  it('should NOT move pinned nodes', () => {
    const doc: DiagramDocument = {
      $schema: 'https://diagramflow/schema/v1',
      meta: { title: '', created: '', modified: '', version: 1 },
      nodes: [
        { id: 'a', label: 'A', x: 999, y: 999, width: 160, height: 48, shape: 'rectangle', color: 'default', pinned: true },
      ],
      edges: [],
    };

    const patches = computePartialLayout(doc);
    expect(patches.length).toBe(0);  // pinned, no unpinned new nodes
  });
});
```

---

## 15. Agent Ownership Guidelines

This section tells a coding agent how to navigate this codebase safely.

### File Ownership Map

| File | Change frequency | Notes for agent |
|---|---|---|
| `src/types/DiagramDocument.ts` | Low | Core schema. Changes here ripple everywhere. Update tests if changed. |
| `src/messages/protocol.ts` | Low | Message types. Both extension and webview depend on this. |
| `src/PatchEngine.ts` | Low | Pure logic. Any change needs corresponding unit test. |
| `src/LLMService.ts` | Medium | Provider logic. Add new providers without breaking existing. |
| `src/DiagramEditorProvider.ts` | Medium | Orchestration. Be careful with async patterns and subscription cleanup. |
| `webview/lib/docToFlow.ts` | Low | Mapping logic. Must be the inverse of flowToDoc. Test together. |
| `webview/lib/flowToDoc.ts` | Medium | Patch generation. Every function must have a unit test. |
| `webview/lib/layoutEngine.ts` | Low | Layout logic. Keep pure (no side effects). |
| `webview/components/CanvasPanel/` | High | UI iteration. Can change freely within the ReactFlow API. |
| `webview/components/LLMPanel/` | High | UI iteration. Can change freely. |
| `test/unit/**` | Always in sync | When logic changes, update the test. Never delete tests. |
| `test/e2e/fixtures/*.diagram` | Stable | Only add new fixtures; never modify existing ones (break test assumptions). |

### Invariants the Agent Must Never Break

1. **`docToFlow(flowToDoc(doc)) ≅ doc`** — the round-trip must be lossy only for cosmetic things, never for structure.
2. **LLM patches must pass validation before being applied.** Never call `updateDocument` without calling `validator.validate` first.
3. **`pinned: true` nodes must never have their `x` or `y` changed by the layout engine.** The layout engine invariant is tested; do not remove that test.
4. **All messages between extension and webview must use the typed protocol.** Never use `any` in message handlers.
5. **Version must increment on every file write.** The `meta.version++` in `applyPatch()` is load-bearing for external sync detection.

### How to Add a New Feature

1. Define the data types in `DiagramDocument.ts` or `protocol.ts` first
2. Write failing unit tests for the pure logic
3. Implement the logic until tests pass
4. Wire the logic into the extension host or webview components
5. Write an E2E spec for the user-visible behavior
6. Run `npm test` — all green before commit

### How to Debug a Failing E2E Test

1. Add `await browser.pause(5000)` to see the state visually during test
2. Use `await WebviewHelper.getDocumentJSON()` to inspect the file state at any point
3. Add `console.log` in `DiagramEditorProvider.ts` — output appears in VSCode Extension Development Host's output channel
4. Webview console.log appears in the webview's DevTools (open via `Help > Toggle Developer Tools`)

---

## 16. Implementation Phases

### Phase 1 — Foundation (Days 1–3)

**Goal:** `.diagram` file opens in VSCode with a working canvas. No LLM yet.

1. Scaffold extension with `yo code` → Custom Text Editor template
2. Set up esbuild for dual-target build (extension + webview)
3. Implement `DiagramDocument` types and `SchemaValidator`
4. Implement `PatchEngine` with unit tests
5. Implement `docToFlow` and `flowToDoc` with unit tests
6. Create minimal React app with ReactFlow, custom `diagramNode` type
7. Implement `useVSCodeBridge` — bidirectional postMessage
8. Wire up: open file → parse → render nodes/edges
9. Wire up: drag node → patch → write file → re-render
10. Wire up: double-click node → edit label inline
11. Wire up: draw edge between nodes
12. Wire up: delete selected (node + connected edges)
13. **E2E tests: specs 01, 02**

### Phase 2 — LLM Integration (Days 4–6)

**Goal:** LLM can add, remove, and modify diagram elements.

1. Implement `LLMService` with Anthropic provider
2. Implement `layoutEngine` (partial dagre)
3. Wire LLM panel into webview
4. Wire LLM prompt → patch → apply → layout new nodes
5. Add OpenAI provider
6. Add Ollama provider
7. Mock LLM for E2E testing (`MOCK_LLM` env var)
8. **E2E tests: specs 06**

### Phase 3 — Polish & Node Shapes (Days 7–9)

**Goal:** All node shapes, colors, export, right-click menu.

1. Implement all 8 node shape SVG renderers
2. Implement `NodeContextMenu` (right-click: change shape, color, pin/unpin, notes)
3. Implement toolbar (auto-layout, fit view, zoom controls)
4. Implement SVG export (serialize ReactFlow canvas to SVG string)
5. Implement Mermaid export
6. Implement PNG export (html2canvas or SVG→canvas)
7. VSCode theme integration (CSS variables)
8. **E2E tests: specs 03, 04, 05, 07, 08**

### Phase 4 — Stability & Testing (Days 10–12)

1. Complete E2E spec 09 (file sync)
2. Performance test: 200-node diagram drag performance
3. Edge cases: empty file, malformed JSON recovery
4. Extension package and test install
5. README and usage documentation

---

## 17. Dependencies & Versions

### Extension Host (`package.json` dependencies)

```json
{
  "dependencies": {
    "fast-json-patch": "^3.1.1"
  },
  "devDependencies": {
    "@types/vscode": "^1.85.0",
    "@types/node": "^20.0.0",
    "typescript": "^5.3.0",
    "esbuild": "^0.20.0",
    "vitest": "^1.3.0",
    "@wdio/cli": "^8.32.0",
    "@wdio/local-runner": "^8.32.0",
    "@wdio/mocha-framework": "^8.32.0",
    "@wdio/spec-reporter": "^8.32.0",
    "wdio-vscode-service": "^6.1.4",
    "expect-webdriverio": "^4.12.0",
    "@vscode/vsce": "^2.24.0",
    "eslint": "^8.57.0",
    "@typescript-eslint/eslint-plugin": "^7.0.0"
  }
}
```

### Webview (`package.json` devDependencies — bundled by esbuild)

```json
{
  "devDependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@xyflow/react": "^12.0.0",
    "@dagrejs/dagre": "^1.1.4",
    "nanoid": "^5.0.0"
  }
}
```

### Key Version Constraints

- `@xyflow/react` must be `^12.x` — this is the React 18 compatible version (formerly `reactflow`)
- `wdio-vscode-service` must use `wdio:enforceWebDriverClassic: true` with v9+
- Node.js minimum: `18.0.0` (fetch is built-in)
- VSCode minimum engine: `1.85.0` (Custom Text Editor API is stable)

---

## Appendix A: JSON Schema for Validation

```json
{
  "$schema": "http://json-schema.org/draft-07/schema",
  "$id": "https://diagramflow/schema/v1",
  "type": "object",
  "required": ["$schema", "meta", "nodes", "edges"],
  "properties": {
    "$schema": { "type": "string" },
    "meta": {
      "type": "object",
      "required": ["title", "created", "modified", "version"],
      "properties": {
        "title": { "type": "string" },
        "description": { "type": "string" },
        "created": { "type": "string", "format": "date-time" },
        "modified": { "type": "string", "format": "date-time" },
        "version": { "type": "integer", "minimum": 1 }
      }
    },
    "nodes": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["id", "label", "x", "y", "width", "height", "shape", "color", "pinned"],
        "properties": {
          "id": { "type": "string", "minLength": 8, "maxLength": 8 },
          "label": { "type": "string" },
          "x": { "type": "number", "minimum": 0 },
          "y": { "type": "number", "minimum": 0 },
          "width": { "type": "number", "minimum": 1 },
          "height": { "type": "number", "minimum": 1 },
          "shape": { "type": "string", "enum": ["rectangle","rounded","diamond","cylinder","circle","parallelogram","hexagon","document"] },
          "color": { "type": "string", "enum": ["default","blue","green","red","yellow","purple","gray"] },
          "pinned": { "type": "boolean" },
          "notes": { "type": "string" },
          "group": { "type": "string" }
        }
      }
    },
    "edges": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["id", "source", "target", "style", "arrow"],
        "properties": {
          "id": { "type": "string" },
          "source": { "type": "string" },
          "target": { "type": "string" },
          "label": { "type": "string" },
          "style": { "type": "string", "enum": ["solid","dashed","dotted"] },
          "arrow": { "type": "string", "enum": ["arrow","open","none"] },
          "animated": { "type": "boolean" }
        }
      }
    }
  }
}
```

---

## Appendix B: LLM Prompt Tuning Notes

### Things That Break LLM Patch Generation

1. **Asking to reposition existing pinned nodes** — the system prompt forbids it, but LLMs sometimes still emit `replace` patches on `x`/`y` of existing nodes. The PatchEngine should NOT reject these — the validator should, because the node is pinned. Actually: implement a `pinned` check in PatchEngine that rejects position changes to pinned nodes.

2. **Inventing node IDs** — LLMs sometimes try to reference nodes by label rather than id. The context sent to the LLM always includes `id` in the compact node format so the LLM can use real ids.

3. **Off-by-one array indices** — RFC 6902 uses index-based paths (`/nodes/2`). After an `add` or `remove`, the indices shift. The LLM may get the indices wrong for multi-step patches. To prevent this, the system prompt instructs use of `/nodes/-` (append) and node-id-based operations via `replace` — not index-based removes. For removes, the LLM outputs the node id, and the PatchEngine translates `remove_by_id` to the correct index.

**Enhanced Patch Operations (domain-specific, translated by PatchEngine):**

```json
{ "op": "remove_node", "id": "xkd9f2m1" }
{ "op": "remove_edge", "id": "e1a2b3c4" }
{ "op": "update_node", "id": "xkd9f2m1", "label": "New Label", "color": "blue" }
```

These higher-level ops are translated to RFC 6902 by a `PatchTranslator` layer before `PatchEngine` sees them. This prevents index-shift bugs entirely.

---

*End of specification. This document fully specifies the DiagramFlow VSCode extension. A coding agent should be able to implement the complete extension from this document without requiring any additional design decisions.*
