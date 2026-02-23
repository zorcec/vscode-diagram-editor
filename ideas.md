
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

### 18. Node Search / Find Panel
**Priority: High**
In diagrams with 30+ nodes, finding a specific node by scrolling the canvas is slow and error-prone. A keyboard-triggered search bar that filters nodes by label, notes, type, or tag would dramatically reduce navigation friction for both humans and LLM agents exploring an unfamiliar diagram.

Spec:
- `Ctrl+F` / `Cmd+F` opens a floating search input in the webview (similar to browser find bar)
- Filter nodes live as the user types — non-matching nodes are dimmed, matching nodes are highlighted with an accent ring
- Pressing `Enter` / `↓` cycles through matches; `Esc` clears the filter
- The LLM tool `ReadDiagramTool` can optionally accept a `filter` parameter to return only matching nodes (reduces token usage on large diagrams)
- Store last-used search term across panel re-opens within a session

Similar: Excalidraw "Search for element" modal, Figma `Ctrl+F` layer search.

---

### 19. Copy / Paste / Duplicate Selected Nodes
**Priority: High**
Clipboard operations (`Ctrl+C`, `Ctrl+V`, `Ctrl+D`) are a muscle-memory expectation in every visual editor, yet DiagramFlow has no copy-paste support. Without it, recreating similar node patterns requires the LLM or the user to add nodes from scratch each time.

Spec:
- `Ctrl+C` serialises currently selected nodes + edges between them into an in-memory clipboard (not system clipboard — avoids security warnings in webviews)
- `Ctrl+V` inserts a copy of the clipboard nodes at a fixed offset (+40px x/y) with new generated IDs and de-duplicated labels where appropriate
- `Ctrl+D` combines copy + immediate paste in one keystroke (Figma / Excalidraw convention)
- Edges whose both endpoints are in the copy set are also duplicated; edges to outside nodes are dropped
- Expose as a `diagramflow_duplicateNodes` LLM tool for agents that want to clone a node as a variant

Similar: Excalidraw `Ctrl+D`, draw.io `Ctrl+D`.

---

### 20. Inline Edge Label Editing (Double-Click)
**Priority: Medium**
Editing an edge label currently requires selecting the edge and toggling a properties panel. Every major visual editor (draw.io, Excalidraw, Figma) lets you double-click directly on an edge or its label to edit it in-place. The friction of the panel adds three extra clicks for what should be a one-second task.

Spec:
- Detect `dblclick` on an edge or its label in `CanvasPanel`
- Show a small inline `<input>` centered on the edge midpoint, pre-filled with the current label
- `Enter` or `blur` commits the change via the existing `EDGE_UPDATED` message path
- `Esc` cancels without saving
- Works for all edge types (bezier, step, straight) by positioning the input at the computed midpoint

Similar: draw.io double-click edge label, Excalidraw text overlays on connectors.

---

### 21. Per-Edge Routing Style (Bezier / Step / Straight)
**Priority: Medium**
All edges currently share a single routing style. Architecture and infrastructure diagrams conventionally use orthogonal (right-angle / step) edges, while flow diagrams suit smooth bezier curves. Allowing users and LLM agents to choose routing per edge or set a diagram-wide default would make DiagramFlow output match professional diagramming conventions like C4, AWS, and network diagrams.

Spec:
- Add optional `edgeType?: 'default' | 'smoothstep' | 'step' | 'straight'` to the diagram edge schema (ReactFlow already supports all four natively)
- Diagram-level default stored in `meta.defaultEdgeType`; per-edge value overrides the default
- Edge context menu (right-click) shows "Routing: Bezier / Step / Straight" toggle buttons
- `diagramflow_updateEdges` LLM tool schema updated to accept `edgeType`
- VS Code command `DiagramFlow: Set Default Edge Routing` presents a Quick Pick

Similar: draw.io connection style picker, Mermaid `graph LR` vs `flowchart` orthogonal routing.

---

### 22. Raster Export: Export as PNG / Copy to Clipboard
**Priority: Medium**
SVG export already exists, but SVGs are not universally accepted — Confluence pages, GitHub PR comments, Notion, and Slack all render PNGs reliably. A one-click PNG export or "Copy as image" shortcut would close the friction gap between creating a diagram and sharing it.

Spec:
- Use `html-to-image` (already widely used in ReactFlow projects) to snapshot the ReactFlow canvas div at a configurable scale (1×, 2× retina)
- VS Code command `DiagramFlow: Export as PNG` triggers the webview snapshot, the webview sends the blob back as a base64 message, and the extension writes the file via `vscode.workspace.fs`
- "Copy to Clipboard" variant uses the Clipboard API inside the webview — no file dialog needed
- Honour the current viewport bbox or offer "Fit entire diagram" option before capture
- The diagram JSON `meta` can optionally store the path of the last exported PNG for reference

Similar: draw.io `File > Export as PNG`, Excalidraw `Export Image` panel.

---

### 23. Keyboard Shortcut Reference Panel
**Priority: Low**
DiagramFlow already supports a growing set of keyboard shortcuts (delete, Shift+click, Z for zoom-to-selection, etc.) but they are not discoverable. New users and LLM agents reading the README to drive the tool both lose time because there is no in-app reference. Excalidraw's `?` modal is a proven pattern ranked highly in user satisfaction surveys.

Spec:
- Press `?` in the canvas (when no input is focused) to toggle a floating shortcuts overlay
- The overlay lists shortcut categories: Navigation, Node actions, Edge actions, Diagram-wide, Export
- VS Code command `DiagramFlow: Show Keyboard Shortcuts` also opens it via Command Palette
- The overlay source is a static TypeScript constant so it stays in sync with actual implementations (no docs drift)
- Add a `?` icon button to the toolbar as a persistent access point

Similar: Excalidraw `?` help dialog, Figma `Ctrl+Shift+?` keyboard shortcut panel.

---

## LLM / Agent Context Enrichment Ideas

> Research question: *What additional information can be stored in the diagram so an LLM agent understands the project architecture more accurately and makes better decisions?*
>
> **Implemented and removed from this list:** Semantic Node Type (`type`), C4 Abstraction Level (`abstractionLevel`), Edge Protocol + DataTypes, Node Lifecycle Status via `properties.status`, Diagram description via `meta.description`, Node security classification and deployment environment, glossary, tags, insights.

### 10. Technology / Stack Metadata
**Priority: Medium**
Knowing that `AuthService` is `Go` and `Frontend` is `React/TypeScript` is critical context for agents writing code. Free-text `notes` is lossy; a structured `tech` field is precise.

Spec:
- Add optional `tech?: string` to `DiagramNode` (e.g. `"TypeScript"`, `"PostgreSQL"`, `"Redis"`)
- Render as a chip/tag below the node label or in the tooltip
- Include in `agentContext.nodeIndex[].tech`
- PropertiesPanel: show a text input with autocomplete from a built-in well-known list

---

### 11. Source Code Path Linking (VS Code Command)
**Priority: Medium**
NodeProperties already has `repo`, `openapi`, and `adr` for documentation linking. The missing piece is a VS Code command that opens the linked resource directly from the diagram.

Spec (remaining work):
- Add optional `sourcePath?: string` to `NodeProperties` (workspace-relative glob, e.g. `"src/auth/**"`)
- Register VS Code command `diagramflow.openNodeSource` that opens the linked path via `vscode.workspace.openTextDocument` or `vscode.env.openExternal`
- Show "Open Source" in the NodeToolbar when `sourcePath` is set
- Include source paths in `agentContext.nodeIndex` so LLM agents can cite them

---

### 12. Topology Hints for LLM (Entry Points, Critical Paths)
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

### 13. Diagram-Level Team and Version Metadata
**Priority: Low**
`meta.description` and `meta.abstractionLevel` are implemented. The remaining fields from the original idea are `meta.team` (owning team) and `meta.docVersion` (semantic version of the diagram). These give the LLM context before it reads any nodes.

Spec:
- Add `meta.team?: string` — owning team name (e.g. `"Platform Squad"`)
- Add `meta.docVersion?: string` — semantic version of the diagram document (e.g. `"2.1.0"`)
- Include at the top of `agentContext.summary`
- Expose via a "Diagram Properties" settings command or meta editor

---

### 14. Runtime Scenario Documentation
**Priority: Medium**
Static diagrams show structure but not behavior. Annotating key runtime scenarios (user login flow, payment processing, error recovery) directly in the diagram metadata lets the LLM understand how components collaborate without reading source code.

Research source: Arc42 section 6 (Runtime View) — documents behavior as use-case scenarios.

Spec:
- Add `meta.scenarios?: { name: string; description: string; participants: string[] }[]`
- Each scenario names the nodes involved and describes the interaction in plain text
- Include in `agentContext` as a `## Key Scenarios` section
- UI: a collapsible "scenarios" editor in the Diagram Properties panel

---

### 15. Change Volatility Tagging
**Priority: Low**
When an LLM agent proposes changes, it needs to know what's stable (shared infrastructure, public APIs) vs experimental (new features) to avoid breaking things. A `volatility` tag on nodes encodes this intent.

Spec:
- Add optional `volatility?: 'stable' | 'experimental' | 'legacy'` to `DiagramNode`
- Render as a subtle visual modifier (dimmed border for legacy, pulse animation for experimental)
- Include in `agentContext.nodeIndex[].volatility`
- LM tool schemas updated: `diagramflow_addNodes`, `diagramflow_updateNodes`

---

### 16. Diagram Staleness Tracking
**Priority: Low**
Architecture diagrams go stale quickly after code changes. Storing a `meta.lastValidated` date and surfacing staleness warnings helps the LLM know whether to trust the context.

Spec:
- Add `meta.lastValidated?: string` (ISO 8601 date) to `DiagramMeta`
- Register VS Code command `DiagramFlow: Mark as Validated` to set this date
- Show a warning banner in the webview if `lastValidated` is older than 30 days
- Include `lastValidated` in `agentContext.summary` preamble

---

### 17. Cross-Diagram References (Linked Sub-Diagrams)
**Priority: Low**
For large systems, a single `.diagram` file becomes unmanageable. Linking a node to a more-detailed `.diagram` file (drill-down) allows LLM agents to traverse the architecture hierarchically without loading all diagrams simultaneously.

Spec:
- Add optional `linkedDiagram?: string` to `DiagramNode` (workspace-relative path)
- Show a "drill-down" icon on nodes with a linked diagram
- VS Code command `diagramflow.openLinkedDiagram` to navigate to the linked file
- Include in `agentContext.nodeIndex[].linkedDiagram` so LLM tools can load sub-diagrams

---

### 24. LLM Diagram Bootstrap from Free-Text Description
**Priority: High**
Creating a diagram from scratch is the highest-friction entry point for both new users and agent-driven workflows. Tools like Eraser.io's DiagramGPT demonstrate that generating an initial layout from a plain-text description dramatically reduces time-to-first-useful-diagram. DiagramFlow has all the necessary LLM tools to populate a blank canvas — what's missing is the bootstrap orchestration layer.

Spec:
- Register VS Code command `DiagramFlow: Generate Diagram from Description` (Command Palette or toolbar `✨` button)
- Opens an input box (or a multi-line quick-input widget) where the user describes the system in plain text (e.g. _"A React frontend → Node.js API → PostgreSQL database, with a Redis cache sidecar and an S3 bucket for file uploads"_)
- The extension invokes a Copilot language model (`vscode.lm.selectChatModels`) with a structured system prompt that instructs the model to emit a sequence of `diagramflow_addNodes`, `diagramflow_addGroups`, and `diagramflow_addEdges` tool calls
- The tool calls are executed sequentially against the currently open (or a new empty) `.diagram` file
- After generation, the layout auto-runs (Dagre) so the result is immediately readable
- Optional: a follow-up prompt input to iteratively refine the generated diagram ("add a load balancer in front of the API")

Similar: Eraser.io DiagramGPT, Mermaid Live Editor AI mode, Whimsical AI diagramming.

---

### 25. LLM Tool: Find / Query Nodes by Predicate
**Priority: Medium**
The existing `ReadDiagramTool` returns the full diagram JSON, which for a 100-node diagram can consume 4–8k tokens per invocation. LLM agents that need to locate a specific node (e.g. "find all nodes tagged `status: deprecated`" or "find the node labelled 'AuthService'") pay a full-diagram cost every time. A targeted query tool with predicate filtering reduces token overhead by 90%+ on large diagrams and enables precise, surgical agent operations.

Spec:
- Register a new LLM tool `diagramflow_findNodes` with parameters: `labelContains?: string`, `type?: string`, `status?: string`, `tags?: string[]`, `group?: string`
- The tool runs the predicate filter server-side (extension process) against the in-memory parsed diagram and returns only matching nodes (IDs, labels, and key properties)
- Returns a lightweight JSON array — no edge or group data — keeping the response ≤ 500 tokens for most queries
- Also supports `diagramflow_findEdges` with `sourceId?`, `targetId?`, `labelContains?` parameters
- Include usage examples in the tool description schema so the LLM knows when to prefer this over `ReadDiagramTool`

Similar: GitHub Copilot workspace `#file` scoping (targeted retrieval over full-repo dump), LangChain retrieval tools with filter predicates.

---

## Archived (Skipped / Won't Implement)

### Connection Validation (isValidConnection)
Prevent invalid edges before creation. Deferred — the open-ended model is intentional for fast prototyping.

### Box-Select (Selection on Drag)
Shift-drag multi-selection via ReactFlow `selectionOnDrag`. Deferred — conflicts with panning UX and existing Shift+click selection is sufficient.
