
## ReactFlow Free Feature Research & Ideas

> Research date: 2025
> Library: `@xyflow/react ^12.10.1`
> License: MIT — all library features are free; "Pro" is only for access to premium example code and support.

### Available Free Components Not Yet Used

| Component | What It Does | Value for DiagramFlow |
|---|---|---|
| `NodeResizer` | Drag handles on corners/edges to resize a node | High — group nodes could be manually resized |
| `MiniMap` | Bird's-eye view navigator in a corner | Medium — useful for large diagrams |
| `Controls` | Zoom in/out/fit/lock buttons panel | Medium — could replace or augment current zoom UX |
| `Panel` | Overlay UI panel anchored to a corner/side | Low — could move Toolbar into a floating Panel |

### Available Free Interactions / Props Not Yet Used

| Feature | What It Does | Value for DiagramFlow |
|---|---|---|
| `reconnectable` on edges | Drag an existing edge endpoint to reconnect it to a different node | High — makes edge management far more intuitive |
| `isValidConnection` | Callback before edge creation; return false to block it | Medium — enforce domain constraints (no self-loops, type checks) |
| `selectionOnDrag` / box-select | Shift-drag canvas to select multiple nodes by drawing a rectangle | High — already built-in, just needs prop enabled |
| `connectionMode: 'loose'` | Allow connecting to any handle, not just matching source→target | Medium — depends on diagram semantics |
| Multiple `Handle` per node | Add directional handles (top, bottom, left, right) | Medium — gives users control over which side edges connect |

### Available Free Hooks Not Yet Used

| Hook | What It Does | Value for DiagramFlow |
|---|---|---|
| `useKeyPress` | Declarative keyboard shortcut detection | Medium — clean up manual keydown listeners |
| `useUpdateNodeInternals` | Force a node to re-measure handles after content change | Low — needed if node sizes change dynamically |
| `useViewport` | Read current zoom/pan | Low — could show zoom % in status bar |

---

## Feature Ideas Derived From Research [IMPLEMNT]

### 1. Node Resizing (Groups & Regular Nodes)
**Priority: High**
NodeResizer from @xyflow/react provides resize handles at no extra cost. Groups especially benefit from manual resizing when the auto-computed bounding box is wrong or when the user wants to pre-size an empty group before adding nodes.

Spec:
- Enable NodeResizer inside DiagramGroupNode.tsx (group type only initially)
- On resize end (onResizeEnd), send UPDATE_GROUP_PROPS message with width and height
- Store width? and height? on DiagramGroup (override auto-computed bounds)
- Apply stored size in docToFlowGroupNodes when present
- LM tool diagramflow_updateGroups already exists; add width/height to its schema

---

### 2. Edge Reconnection [IMPLEMENT]
**Priority: High**
Setting reconnectable on edge components lets users drag endpoints to reconnect edges. This is a purely declarative feature.

Spec:
- Add reconnectable prop to the custom edge component
- Handle the onReconnect and onReconnectEnd callbacks in useGraphState
- On reconnect, send a new message type EDGE_RECONNECTED: { id, newSource, newTarget }
- In the extension, apply update_edge { id, changes: { from, to } } semantic op (already supported)

---

### 3. Undo / Redo [IMPLEMENT]
**Priority: High**
ReactFlow does not ship undo/redo built-in but provides the state primitives to build it. The extension already has a clean document model, making a history stack straightforward.

Spec:
- Maintain a circular history buffer of DiagramDocument snapshots (max 50 entries) in DiagramService
- On every write (updateDocumentContent), push the previous document to the stack
- Expose undo() / redo() methods on DiagramService
- Register VS Code commands diagramflow.undo / diagramflow.redo (Ctrl+Z / Ctrl+Shift+Z)
- Also handle Ctrl+Z / Ctrl+Y in the webview and send an UNDO / REDO message to the extension

---

### 4. Copy / Paste Nodes [IMPLEMENT]
**Priority: Medium**
Standard clipboard UX expected in any visual editor.

Spec:
- On Ctrl+C in webview: store selected node data in local clipboard state
- On Ctrl+V: create copies of nodes with offset (+20px, +20px) and new IDs; send ADD_NODES batch message
- Group membership preserved when copying inside a group context; stripped when pasting elsewhere
- LM agent does not need paste; this is pure UX

---

### 5. Connection Validation (isValidConnection) [SKIP]
**Priority: Medium**
Prevent invalid edges before they are created (e.g. self-loops, duplicate edges).

Spec:
- Pass isValidConnection callback to ReactFlow component
- Default rules: block self-loops (source === target), block duplicate edges
- Future: surface node type metadata and allow per-type connection constraints

---

### 6. Box-Select (Selection on Drag) [SKIP]
**Priority: Medium**
Enable built-in drag-to-select rectangle when user holds Shift and drags on empty canvas.

Spec:
- Add selectionOnDrag prop to ReactFlow
- Add selectionKeyCode="Shift" for modifier-drag selection (vs pan)
- Combine with multiSelectionKeyCode="Control" for additive selection

---

### 7. MiniMap
**Priority: Low**
Add a bird's-eye navigator for large diagrams. Toggle visibility from Toolbar.

Spec:
- Add MiniMap component from @xyflow/react inside CanvasPanel.tsx
- Style minimap nodes to match diagram node colors
- Add Toolbar toggle button (M shortcut) to show/hide

---

### 8. Directional Handles on Nodes [IMPLEMENT]
**Priority: Low**
Adding four directional handles (top/right/bottom/left) gives users control over which side edges originate/terminate.

Spec:
- Add four Handle components to DiagramNode.tsx (top, right, bottom, left)
- Mark as both source and target
- Show handles only on hover via CSS
- No data model change required for edges

---

## Ideas from Implementation Experience

### 9. Panning Help Tooltip / Hint [IMPLEMENT]
**Priority: Low**
With `selectionOnDrag` enabled, left-click drag now creates a selection rectangle and right-click drag pans. New users may not know about right-click-to-pan. A first-run overlay or status bar hint ("Drag to select • Right-drag or scroll to pan") would help discoverability.

Spec:
- Show a dismissible toast/overlay on first open sourced from VS Code `globalState`
- Or surface a permanent subtle hint in the toolbar

---

### 10. Keyboard Shortcuts Panel [IMPLEMENT]
**Priority: Low**
The extension already has several keyboard shortcuts (N = add node, G = add group, L = layout, Delete = remove). A discoverable shortcuts panel would help new users.

Spec:
- Add a `?` toolbar button that opens a VS Code quick-pick or webview panel listing all shortcuts
- Include mouse shortcuts: right-drag to pan, drag to box-select, Shift+click/drag for additive selection

---

### 11. Auto-Layout Direction Toggle [IMPLEMENT]
**Priority: Medium**
The auto-layout currently uses top-to-bottom (TB) direction matching the sarah-ai architecture style. Some diagrams (left-to-right pipelines, swimlane diagrams) naturally flow LR. A toolbar button or `LayoutConfig` option to select direction before triggering layout would give users more control.

Spec:
- Add `LayoutDirection` to toolbar (TB/LR toggle, or a dropdown with TB/LR/BT/RL)
- Pass selected direction to `REQUEST_LAYOUT` message and on to `computeFullLayout`
- Persist last-used direction in diagram `meta` (already has extension point in DiagramDocument)
- Integrate in nicely into the layout button UI (e.g. a split button with direction options)

---

### 12. Fit View After Auto-Layout [IMPLEMENT]
**Priority: Medium**
After triggering auto-layout (`L`), the nodes may shift far from the current viewport. Automatically calling `fitView()` after layout completes ensures users always see the result.

Spec:
- In webview, after receiving a `DOCUMENT_UPDATED` message that follows a layout request, call `rf.fitView()` using `useReactFlow()` hook
- Needs coordination: track that a layout was requested (e.g., a `layoutPending` flag in `useGraphState`) and reset it when the document arrives

---

### 13. Node Search / Filter [IMPLEMENT]
**Priority: Medium**
In large diagrams finding a specific node by label requires scrolling. A search bar that highlights matching nodes and pans/zooms to them would significantly improve usability for complex diagrams.

Spec:
- Add a search input to the Toolbar (Ctrl+F shortcut)
- Filter/highlight nodes whose label matches the query
- On Enter, fit-view to the first matching node
- Clear search on Escape

---

### 14. Sticky Notes / Annotations [IMPLEMENT]
**Priority: Low**
Free-form text annotations (sticky note style) help users add explanatory text near diagram sections without connecting it to a node.

Spec:
- New node type: `diagramNote` rendered as a yellow/pastel sticky note
- No connection handles (annotation only)
- Add via toolbar button or keyboard shortcut
- LM tool `diagramflow_addNodes` can include `shape: 'note'` as variant

---

### 15. Collapse / Expand Groups [IMPLEMENT]
**Priority: Medium**
Groups with many children can clutter the canvas. Collapsing a group into a single representative node (showing only its label) would keep large diagrams readable.

Spec:
- Toggle collapse state on group double-click
- When collapsed, hide child nodes and render group as a compact rectangle
- Edges to/from children are rerouted to the group boundary
- Store `collapsed?: boolean` on `DiagramGroup`

---

## New Ideas from Codebase Review (2025)

### 16. Export to Mermaid [IMPLEMENT]
**Priority: High**
Mermaid is widely supported (GitHub, Notion, Confluence). Exporting a diagram to Mermaid markdown would make diagrams shareable without special tooling.

Spec:
- Add `EXPORT_MERMAID` flow: webview computes Mermaid text from doc and sends to extension
- Or implement in extension (`DiagramService.mermaidFromDoc`) — extension already knows the document
- Support `flowchart TB/LR` for directed graphs
- Map groups to `subgraph` blocks
- Register `diagramflow.exportMermaid` command
- Add `↓ MMD` button to Toolbar export group

---

### 17. Node Templates / Quick-Add Panel [IMPLEMENT]
**Priority: High**
Re-typing common node labels and choosing shapes/colors is repetitive. A node template library (database, API gateway, frontend app, queue, service, etc.) would speed up diagram creation significantly.

Spec:
- Define a `NodeTemplate[]` array in config (label pattern, shape, color, notes template)
- Toolbar button or `T` keyboard shortcut opens a quick-pick popup
- Selecting a template inserts a new node with those defaults
- Allow user-defined templates stored in VS Code workspace settings (`diagramflow.nodeTemplates`)

---

### 18. Alignment Guides (Smart Snap) [IMPLEMENT]
**Priority: Medium**
When dragging a node, show temporary alignment guide lines when the node's edges align with nearby nodes (similar to Figma/Excalidraw). This makes manual layout much cleaner.

Spec:
- During `onNodeDrag` (not just stop), compute horizontal and vertical alignment candidates from all other nodes
- Draw SVG guide lines (dashed lines) at matching positions
- Snap node position to the nearest guide within a threshold (e.g. 8px) before sending `NODE_DRAGGED`
- Implemented entirely in the webview — no extension changes needed

---

### 19. Edge Bundling (Parallel Edge Deduplication) [IMPLEMENT]
**Priority: Low**
When multiple edges connect the same pair of nodes, they overlap and become invisible. Bundling them with slight offsets (or displaying a count badge on a single edge) cleans up the visual.

Spec:
- Detect parallel edges in `docToFlowEdges` (same source+target or reverse)
- Assign each parallel edge a small perpendicular offset (bezier control point adjustment)
- Alternatively, show a label like `×3` when ≥3 parallel edges exist

---

### 20. Diagram Auto-Documentation [IMPLEMENT]
**Priority: Medium**
Use the Copilot LLM to generate structured documentation from a diagram — architecture decision records, system overview docs, or README sections.

Spec:
- Register VS Code command `diagramflow.generateDocs`
- Use `diagramflow_readDiagram` to get context, then ask LLM to generate one of: README section, ADR, C4 model description, or threat model
- Output to a new VS Code editor tab as Markdown
- Optionally persist the generated doc path in `diagram.meta`

---

### 21. Diagram Diff / Change Tracking [IMPLEMENT]
**Priority: Medium**
When a `.diagram` file is modified by an LLM agent or collaborator, it's hard to see what changed. A visual diff mode (highlight added/removed/changed nodes & edges) would help review.

Spec:
- Compare current document against git HEAD version using `git show HEAD:<file>`
- Highlight added nodes/edges in green, removed in red, changed in yellow
- Activated via `diagramflow.showDiff` command or a toolbar toggle
- Reset highlight when leaving diff mode

---

### 22. Zoom to Selection [IMPLEMENT]
**Priority: Low**
After selecting one or more nodes, pressing a key (e.g. `Z`) should zoom and pan so the selected nodes fill the viewport. Useful for navigating large diagrams.

Spec:
- Listen for `z` key in `CanvasPanel` keyboard handler
- If `selectedNodeId` or multiple selected nodes, call `rf.fitView({ nodes: selected, padding: 0.3 })`
- Add to shortcuts panel list

---

### 23. Multi-Diagram Navigation Panel [IMPLEMENT]
**Priority: Low**
When a workspace has multiple `.diagram` files, switching between them requires the file explorer. A dedicated panel listing all `.diagram` files in the workspace would improve discoverability.

Spec:
- Register a `TreeDataProvider` for a DiagramFlow sidebar view
- List all `*.diagram` files in the workspace
- Clicking opens the file in the custom editor
- Show node/edge/group counts as descriptions
- Refresh on file create/delete

---

### 24. Performance: Virtual Rendering for Large Diagrams [INVESTIGATE]
**Priority: Low**
ReactFlow already virtualises node rendering to some degree, but very large diagrams (500+ nodes) may still lag. Investigate the ReactFlow `<NodeRenderer>` lazy-rendering options and measure performance benchmarks.

Spec:
- Profile current rendering with 200, 500, 1000 nodes
- Evaluate `<ReactFlow onlyRenderVisibleElements>` prop
- Consider splitting very large diagrams into linked sub-diagrams
- Document findings in `information/` and implement if gain > 30%

---

### 25. Collaborative/Shared Cursors (Future / Research) [RESEARCH]
**Priority: Very Low**
If a team opens the same `.diagram` file via a shared workspace (VS Code Live Share), show collaborator cursors and selection on the canvas.

Spec:
- Requires VS Code Live Share API integration
- Broadcast cursor positions over the Live Share channel
- Render ghost cursors (colored rings) on the canvas for each collaborator
- Highly experimental — document feasibility in `information/`
