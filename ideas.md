
## Pending Implementation

> Ideas that have been implemented are removed from this list.
> Ideas marked **[SKIP]** are archived at the bottom.

### 1. Node Templates / Quick-Add Panel
**Priority: High**
Re-typing common node labels and choosing shapes/colors is repetitive. A node template library (database, API gateway, frontend app, queue, service, etc.) would speed up diagram creation significantly.

Spec:
- Define a `NodeTemplate[]` array in config (label pattern, shape, color, notes template)
- Toolbar button or `T` keyboard shortcut opens a quick-pick popup
- Selecting a template inserts a new node with those defaults
- Allow user-defined templates stored in VS Code workspace settings (`diagramflow.nodeTemplates`)

---

### 2. Alignment Guides (Smart Snap)
**Priority: Medium**
When dragging a node, show temporary alignment guide lines when the node's edges align with nearby nodes (similar to Figma/Excalidraw). This makes manual layout much cleaner.

Spec:
- During `onNodeDrag` (not just stop), compute horizontal and vertical alignment candidates from all other nodes
- Draw SVG guide lines (dashed lines) at matching positions
- Snap node position to the nearest guide within a threshold (e.g. 8px) before sending `NODE_DRAGGED`
- Implemented entirely in the webview — no extension changes needed

---

### 3. Edge Bundling (Parallel Edge Deduplication)
**Priority: Low**
When multiple edges connect the same pair of nodes, they overlap and become invisible. Bundling them with slight offsets (or displaying a count badge on a single edge) cleans up the visual.

Spec:
- Detect parallel edges in `docToFlowEdges` (same source+target or reverse)
- Assign each parallel edge a small perpendicular offset (bezier control point adjustment)
- Alternatively, show a label like `×3` when ≥3 parallel edges exist

---

### 4. Diagram Auto-Documentation
**Priority: Medium**
Use the Copilot LLM to generate structured documentation from a diagram — architecture decision records, system overview docs, or README sections.

Spec:
- Register VS Code command `diagramflow.generateDocs`
- Use `diagramflow_readDiagram` to get context, then ask LLM to generate one of: README section, ADR, C4 model description, or threat model
- Output to a new VS Code editor tab as Markdown
- Optionally persist the generated doc path in `diagram.meta`

---

### 5. Diagram Diff / Change Tracking
**Priority: Medium**
When a `.diagram` file is modified by an LLM agent or collaborator, it's hard to see what changed. A visual diff mode (highlight added/removed/changed nodes & edges) would help review.

Spec:
- Compare current document against git HEAD version using `git show HEAD:<file>`
- Highlight added nodes/edges in green, removed in red, changed in yellow
- Activated via `diagramflow.showDiff` command or a toolbar toggle
- Reset highlight when leaving diff mode

---

### 6. Zoom to Selection
**Priority: Low**
After selecting one or more nodes, pressing a key (e.g. `Z`) should zoom and pan so the selected nodes fill the viewport. Useful for navigating large diagrams.

Spec:
- Listen for `z` key in `CanvasPanel` keyboard handler
- If `selectedNodeId` or multiple selected nodes, call `rf.fitView({ nodes: selected, padding: 0.3 })`
- Add to shortcuts panel list

---

### 7. Multi-Diagram Navigation Panel
**Priority: Low**
When a workspace has multiple `.diagram` files, switching between them requires the file explorer. A dedicated panel listing all `.diagram` files in the workspace would improve discoverability.

Spec:
- Register a `TreeDataProvider` for a DiagramFlow sidebar view
- List all `*.diagram` files in the workspace
- Clicking opens the file in the custom editor
- Show node/edge/group counts as descriptions
- Refresh on file create/delete

---

### 8. Performance: Virtual Rendering for Large Diagrams
**Priority: Low**
ReactFlow already virtualises node rendering to some degree, but very large diagrams (500+ nodes) may still lag. Investigate the ReactFlow `<NodeRenderer>` lazy-rendering options and measure performance benchmarks.

Spec:
- Profile current rendering with 200, 500, 1000 nodes
- Evaluate `<ReactFlow onlyRenderVisibleElements>` prop
- Consider splitting very large diagrams into linked sub-diagrams
- Document findings in `information/` and implement if gain > 30%

---

### 9. Collaborative/Shared Cursors (Future / Research)
**Priority: Very Low**
If a team opens the same `.diagram` file via a shared workspace (VS Code Live Share), show collaborator cursors and selection on the canvas.

Spec:
- Requires VS Code Live Share API integration
- Broadcast cursor positions over the Live Share channel
- Render ghost cursors (colored rings) on the canvas for each collaborator
- Highly experimental — document feasibility in `information/`

---

## LLM / Agent Context Enrichment Ideas

> Research question: *What additional information can be stored in the diagram so an LLM agent understands the project architecture more accurately and makes better decisions?*

### 10. Semantic Node Type Tags
**Priority: High**
Assign each node a machine-readable semantic type (`service`, `database`, `queue`, `ui`, `gateway`, `cache`, `worker`, `external`) stored in `DiagramNode.nodeType`. An LLM can then reason about architecture patterns (e.g., "no caching layer between gateway and DB") without parsing free-text labels.

Spec:
- Add optional `nodeType?: string` to `DiagramNode` and the JSON schema
- Surface as a dropdown in the PropertiesPanel (well-known types + free text)
- Include in `agentContext.nodeIndex` entries
- Add `nodeType` to `diagramflow_addNodes` / `diagramflow_updateNodes` LM tool schemas
- Extend `generateAgentContext` to group nodes by type in the summary

---

### 11. C4 Architecture Level Classification
**Priority: Medium**
The C4 model (Context → Container → Component → Code) is the standard scope hierarchy. Tagging nodes with their C4 level lets the LLM know whether `AuthService` is a whole microservice container or an internal module.

Spec:
- Add optional `c4Level?: 'context' | 'container' | 'component' | 'code'` to `DiagramNode`
- Render as a small badge on the node (coloured pill)
- Include in `agentContext.summary` as a breakdown by level
- LM tool schemas updated to accept `c4Level`

---

### 12. Technology / Stack Metadata
**Priority: Medium**
Knowing that `AuthService` is `Go` and `Frontend` is `React/TypeScript` is critical context for agents writing code. Free-text `notes` is lossy; a structured `tech` field is precise.

Spec:
- Add optional `tech?: string` to `DiagramNode` (e.g. `"TypeScript"`, `"PostgreSQL"`, `"Redis"`)
- Render as a chip/tag below the node label or in the tooltip
- Include in `agentContext.nodeIndex[].tech`
- PropertiesPanel: show a text input with autocomplete from a built-in well-known list

---

### 13. Source Code Path Linking
**Priority: Medium**
When an LLM agent traces an issue, it needs to jump from a diagram node to actual source files. Linking a node to a workspace-relative glob pattern makes this trivial.

Spec:
- Add optional `sourcePath?: string` to `DiagramNode` (e.g. `"src/auth/**"`, `"packages/gateway/src/index.ts"`)
- Register VS Code command `diagramflow.openNodeSource` that opens the linked path
- Show "Open Source" in the NodeToolbar when `sourcePath` is set
- Include paths in `agentContext.nodeIndex` so LLM agents can cite them directly

---

### 14. Edge Semantics (Protocol / Data Flow)
**Priority: Medium**
Edges currently only carry style/arrow/label. Knowing *how* nodes communicate (sync HTTP, async Kafka event, SQL query, gRPC) enables the LLM to reason about latency, failure modes, and coupling.

Spec:
- Add optional `protocol?: string` to `DiagramEdge` (e.g. `"HTTP"`, `"gRPC"`, `"Kafka"`, `"SQL"`, `"WebSocket"`)
- Show protocol as a small badge on the edge midpoint
- Include in `agentContext.edgeIndex[].protocol`
- PropertiesPanel edge section: protocol dropdown + free-text fallback

---

### 15. Node Lifecycle Status
**Priority: Low**
Architecture diagrams go stale. Tagging nodes with their lifecycle status (`planned`, `in-progress`, `stable`, `deprecated`, `external`) helps both humans and LLMs distinguish real vs aspirational components.

Spec:
- Add optional `status?: 'planned' | 'in-progress' | 'stable' | 'deprecated' | 'external'` to `DiagramNode`
- Render as visual indicator (dimmed opacity for deprecated, dashed border for planned)
- Include in `agentContext.nodeIndex[].status`
- LM tool schemas updated accordingly

---

### 16. Diagram-Level Metadata (Scope, Owner, Version)
**Priority: Low**
Richer `meta` fields give the LLM context *before* it reads any nodes — the who/what/why of the diagram.

Spec:
- Add `meta.description?: string` — author-written paragraph describing the diagram scope
- Add `meta.team?: string` — owning team name
- Add `meta.docVersion?: string` — semantic version of the diagram document
- Include all fields at the top of `agentContext.summary`
- Expose via a "Diagram Properties" panel or settings command

---

### 17. Topology Hints for LLM (Entry Points, Critical Paths)
**Priority: Low**
Surface structural insights — entry points (nodes with no inbound edges), leaf nodes, and longest directed paths — directly in `agentContext` so the LLM knows where to focus in large diagrams.

Spec:
- Compute topology analysis in `generateAgentContext`:
  - `entryPoints`: node IDs with in-degree 0
  - `leafNodes`: node IDs with out-degree 0
  - `longestPath`: sequence of node IDs on the longest directed path
- Include as a `topology` block in `agentContext`
- No UI required — purely consumed by LLM tool callers

---

## Archived (Skipped / Won't Implement)

### Connection Validation (isValidConnection)
Prevent invalid edges before creation. Deferred — the open-ended model is intentional for fast prototyping.

### Box-Select (Selection on Drag)
Shift-drag multi-selection via ReactFlow `selectionOnDrag`. Deferred — conflicts with panning UX and existing Shift+click selection is sufficient.
