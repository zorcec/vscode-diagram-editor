
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

## Feature Ideas Derived From Research

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

### 2. Edge Reconnection
**Priority: High**
Setting reconnectable on edge components lets users drag endpoints to reconnect edges. This is a purely declarative feature.

Spec:
- Add reconnectable prop to the custom edge component
- Handle the onReconnect and onReconnectEnd callbacks in useGraphState
- On reconnect, send a new message type EDGE_RECONNECTED: { id, newSource, newTarget }
- In the extension, apply update_edge { id, changes: { from, to } } semantic op (already supported)

---

### 3. Undo / Redo
**Priority: High**
ReactFlow does not ship undo/redo built-in but provides the state primitives to build it. The extension already has a clean document model, making a history stack straightforward.

Spec:
- Maintain a circular history buffer of DiagramDocument snapshots (max 50 entries) in DiagramService
- On every write (updateDocumentContent), push the previous document to the stack
- Expose undo() / redo() methods on DiagramService
- Register VS Code commands diagramflow.undo / diagramflow.redo (Ctrl+Z / Ctrl+Shift+Z)
- Also handle Ctrl+Z / Ctrl+Y in the webview and send an UNDO / REDO message to the extension

---

### 4. Copy / Paste Nodes
**Priority: Medium**
Standard clipboard UX expected in any visual editor.

Spec:
- On Ctrl+C in webview: store selected node data in local clipboard state
- On Ctrl+V: create copies of nodes with offset (+20px, +20px) and new IDs; send ADD_NODES batch message
- Group membership preserved when copying inside a group context; stripped when pasting elsewhere
- LM agent does not need paste; this is pure UX

---

### 5. Connection Validation (isValidConnection)
**Priority: Medium**
Prevent invalid edges before they are created (e.g. self-loops, duplicate edges).

Spec:
- Pass isValidConnection callback to ReactFlow component
- Default rules: block self-loops (source === target), block duplicate edges
- Future: surface node type metadata and allow per-type connection constraints

---

### 6. Box-Select (Selection on Drag)
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

### 8. Directional Handles on Nodes
**Priority: Low**
Adding four directional handles (top/right/bottom/left) gives users control over which side edges originate/terminate.

Spec:
- Add four Handle components to DiagramNode.tsx (top, right, bottom, left)
- Mark as both source and target
- Show handles only on hover via CSS
- No data model change required for edges
