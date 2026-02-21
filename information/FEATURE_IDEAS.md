# DiagramFlow — Feature Research & Roadmap Ideas

## Overview

This document captures research and creative feature proposals for the DiagramFlow VS Code extension.
The goal is to make the editor more productive for human developers and more useful for AI coding
agents. Features are categorised by theme and ranked by estimated impact.

Research draws on: Excalidraw, Miro, Lucidchart, draw.io, Structurizr, Mermaid Live, the VS Code
extension ecosystem, and GitHub Copilot agent workflows.

---

## Feature 1 — Minimap Navigation

**Theme:** Navigation | **Priority:** High

Large architecture diagrams (30+ nodes) are difficult to navigate. A minimap — a scaled-down
overview in a fixed corner of the canvas — lets developers see the whole picture while editing a
specific area.

**Implementation ideas:**

- Render a thumbnail of all nodes at ~10% scale in bottom-right corner
- Highlight the current viewport rectangle on the minimap
- Click/drag on minimap to pan the main canvas
- ReactFlow has built-in `<MiniMap>` component — low implementation cost

**Agent value:** Low (agents do not navigate visually), but high developer ergonomics.

**Reference:** [ReactFlow MiniMap](https://reactflow.dev/components/minimap)

---

## Feature 2 — Code-to-Diagram Auto-Generation

**Theme:** AI/Automation | **Priority:** High

Parse source files in the open workspace and automatically generate a starter diagram from code
structure. Examples:

- Scan `package.json` / `pom.xml` / `requirements.txt` for service dependencies
- Scan TypeScript/Python imports for module-level dependency graphs
- Parse OpenAPI / AsyncAPI specs and generate an API + consumer diagram
- Parse Kubernetes/Docker Compose manifests and generate a deployment diagram

The agent can be asked: *"Generate a diagram from the services in this workspace"* and the
extension would emit `diagramflow_addNodes` operations.

**Implementation ideas:**

- VS Code command: `DiagramFlow: Generate from workspace`
- Detect project type (Node, Python, Java) and run the appropriate parser
- Emit ops to the currently open `.diagram` file, or create a new one

**Agent value:** Very high — agents can ask for a diagram and get one without any manual drawing.

---

## Feature 3 — Diagram Linting / Health Diagnostics

**Theme:** Quality | **Priority:** High

Surfaces problems in the diagram as VS Code diagnostics (Problems panel warnings):

- Node has no `notes` / description (agent cannot reason about it)
- Node is an island — no edges connect to or from it
- Group exists but has only one member (probably incomplete)
- Duplicate node labels (ambiguous for agent edge lookup)
- Circular edge to self (probably accidental)
- Edge references a node that no longer exists (stale edge)

**Implementation ideas:**

- Run linting in `DiagramService` after every `applyOps`
- Emit `vscode.Diagnostic` entries on the `.diagram` file
- Show quick-fix suggestions in the lightbulb menu: "Add a description" → opens Properties Panel

**Agent value:** Very high — the linter ensures `agentContext` is always populated with useful data.

---

## Feature 4 — Smart Diagram Templates

**Theme:** Onboarding | **Priority:** Medium-High

A command palette item (`DiagramFlow: New from template`) that opens a quickpick of starter
diagram templates:

| Template | Description |
|---|---|
| Microservices | API Gateway, 3 services, shared DB, message queue |
| Event-Driven | Producer, Kafka topic, 2 consumers, dead-letter queue |
| CQRS + Event Sourcing | Command side, event store, read-model projector, query side |
| Monolith with Strangler | Legacy monolith + new strangled service + shared DB |
| Frontend + BFF + API | Browser, BFF, REST API, Auth, Database |
| Kubernetes Deployment | Ingress, 2 Deployments, Service, PersistentVolumeClaim |

**Agent value:** Medium — provides a structured starting point an agent can evolve.

---

## Feature 5 — Full-Text Search and Focus

**Theme:** Navigation | **Priority:** Medium-High

A search bar (keyboard shortcut `Ctrl+F` / `Cmd+F` on the canvas) that:

- Searches node labels and `notes` content
- Highlights matching nodes with a glow effect
- Dims non-matching nodes to 30% opacity
- Press `Enter` to cycle through matches and pan to each node
- Press `Esc` to clear search and restore normal view

**Implementation ideas:**

- Overlay search input floating above the canvas (not in webview toolbar)
- Filter `nodes` array to matching IDs; pass as a prop to `CustomNode` for highlight styling
- ReactFlow's `fitView` with node filter to pan to the first match

**Agent value:** Medium — agents will search using the `nodeIndex`; this helps human developers.

---

## Feature 6 — Copilot / Agent Chat Integration

**Theme:** AI/Automation | **Priority:** High

A GitHub Copilot Chat participant (`@diagramflow`) that users can talk to from the chat panel:

```
@diagramflow Add a Redis cache between Order Service and the database
@diagramflow Group the payment-related nodes into a "Payment Domain" group
@diagramflow What does the Payment Gateway do?
@diagramflow Generate a sequence diagram for the checkout flow
```

**Implementation ideas:**

- Register a `vscode.chat.createChatParticipant('diagramflow', ...)` contributor
- Parse chat intent → emit `diagramflow_*` MCP tool calls
- Return a diagram SVG preview rendered inside the chat response using `ChatResponseFileTree`
- For read queries, return the relevant nodes from `agentContext`

**References:**
- [VS Code Chat Participants API](https://code.visualstudio.com/api/extension-guides/chat)
- [MCP tool integration](https://modelcontextprotocol.io)

**Agent value:** Extremely high — this is the primary way developers interact with diagrams via AI.

---

## Feature 7 — Node Expand / Collapse (Drill-Down Views)

**Theme:** Navigation | **Priority:** Medium

Groups can be collapsed into a single representative node to give a high-level summary view, and
expanded to show the full component detail:

- Collapsed group: single rounded-rectangle with group label + member count badge
- Click to expand in-place; children animate into position
- Support nested groups (collapse level-by-level)
- Keyboard shortcut: `Space` on selected group node

**Implementation ideas:**

- Store `collapsed: boolean` per group in diagram document
- In `CanvasPanel`, if group is collapsed, replace member nodes with a synthetic "group node"
- `update_group` operation to toggle `collapsed`

**Agent value:** Medium — `agentContext.groupIndex` already provides the collapsed view summary.
Agents can reason about groups from the index without needing visual collapse.

---

## Feature 8 — Git Diff as Diagram Overlay

**Theme:** Dev Workflow | **Priority:** Medium

Show architectural changes between git commits or branches directly on the diagram:

- Green outline: nodes/edges added in this commit
- Red outline: nodes/edges removed
- Yellow outline: nodes/edges updated (label, notes, connections changed)
- Timeline scrubber at the bottom to step through commit history

**Implementation ideas:**

- VS Code `git` extension API provides commit history and file diff
- Parse the old and new JSON states, compute structural diff
- Pass diff result as a prop to `CustomNode`/`CustomEdge` for coloring
- Command: `DiagramFlow: Show diff from last commit`

**Agent value:** High — an agent reviewing a PR can overlay the diff to understand what changed.

---

## Feature 9 — Export to Alternative Diagram Formats

**Theme:** Interoperability | **Priority:** Medium

Export the `.diagram` to other widely-used formats to enable integration with other tools:

| Format | Use case |
|---|---|
| Mermaid Markdown | Embed in GitHub READMEs, Confluence, Notion |
| PlantUML | Enterprise tooling, Confluence plugins |
| Structurizr DSL | Full C4 toolchain integration |
| draw.io XML | Import into draw.io / diagrams.net |
| DOT (Graphviz) | CI pipeline visualisation |
| PNG/SVG | Sharing in documentation |

**Implementation ideas:**

- Add `DiagramFlow: Export as...` command with format quickpick
- Implement format-specific serialisers: `toMermaid()`, `toPlantUml()`, `toStructurizr()`
- Provide a two-way import for Mermaid: parse Mermaid source → create `.diagram` nodes/edges

**Agent value:** High — agents can ask for a Mermaid version to embed in documentation they are
writing, without leaving the chat.

---

## Feature 10 — Keyboard-First Power User Mode

**Theme:** Developer Ergonomics | **Priority:** Medium-High

A complete keyboard shortcut layer for all diagramming actions — eliminating the need to use the
mouse for common operations:

| Shortcut | Action |
|---|---|
| `A` | Add node at canvas centre |
| `E` | Add edge (select source, then target) |
| `Delete` / `Backspace` | Delete selected node or edge |
| `L` | Run auto-layout |
| `G` | Group selected nodes |
| `Ctrl+D` | Duplicate selected node |
| `Cmd+[` / `Cmd+]` | Send node to back / bring to front |
| `F2` | Rename selected node (inline edit) |
| `?` | Open keyboard shortcut cheat sheet overlay |

**Implementation ideas:**

- Add a `useKeyboardShortcuts` hook in the webview
- Map key events to existing operation dispatchers
- Show a keyboard indicator badge on the toolbar icon

**Agent value:** Low (agents do not use the keyboard), but dramatically increases developer speed.

---

## Feature 11 — Diagram Version History Timeline

**Theme:** Dev Workflow | **Priority:** Low-Medium

A visual timeline of diagram changes over time, independent of git:

- Diagram saves are timestamped in a local history store (`.diagram.history.json` sidecar)
- A timeline panel shows save points with previews
- Click a point to restore or branch from that state
- Limited to last 50 saves to cap storage

**Implementation ideas:**

- Extension saves a history entry in `ExtensionContext.globalStorageUri` on every user save
- History panel implemented as a `vscode.WebviewView` in the sidebar
- Restore sends the historical `DiagramDocument` as an `APPLY_OPS` batch

**Agent value:** Medium — agents could query: "what did this diagram look like before the refactor?"

---

## Feature 12 — Diagram as Documentation Site

**Theme:** Sharing | **Priority:** Low-Medium

One command generates a self-contained HTML microsite from a `.diagram` file:

- Static HTML with embedded SVG and interactive hover tooltips
- Node click expands a panel with `notes`, `properties`, `tags`
- Dark mode support; no external dependencies (fully offline)
- Output to `./docs/architecture/` or configurable path

**Implementation ideas:**

- Command: `DiagramFlow: Publish to HTML`
- Use `ReactDOM.renderToStaticMarkup` at build time to generate the base SVG
- Inject a minimal vanilla JS scroll/highlight handler
- Add a GitHub Actions workflow template that publishes to GitHub Pages on push

**Agent value:** High — an agent writing ADRs or documentation can reference the hosted diagram 
URL instead of including the raw JSON.

---

## Feature 13 — Sticky Notes and Free-Text Annotations

**Theme:** Expressiveness | **Priority:** Low-Medium

Floating text annotations that are not connected to any node — useful for adding warning banners,
migration notes, or sprint goals directly on the canvas:

- Sticky note node type: yellow/pastel rectangle with no border radius
- Supports markdown-style content (`**bold**`, bullet lists)
- Can be pinned to a specific node so it moves with it
- Excluded from `agentContext.nodeIndex` (pure annotation, not architecture)

**Implementation ideas:**

- New node shape: `sticky` — rendered as a `<foreignObject>` with a `<div>` inside ReactFlow
- `pinned_to: nodeId?` field in the node document
- Filter out `type: 'sticky'` nodes in `generateAgentContext`

**Agent value:** Low for machine reading, high for human context during diagram reviews.

---

## Feature 14 — Live Multiplayer Editing

**Theme:** Collaboration | **Priority:** Low (complex)

Multiple developers editing the same `.diagram` file simultaneously with cursor presence:

- Each user sees other users' cursors and node selections highlighted in their colour
- Operational transform or CRDT for conflict-free concurrent edits
- Uses VS Code's LiveShare API when available; falls back to a file-watch poll mode

**Implementation ideas:**

- VS Code LiveShare `ISharedService` for real-time cursor data
- Apply the same `applyOps` model as today, but broadcast over ZeroMQ or WebSocket to peers
- Show avatar icons near active selections

**Agent value:** Medium — an agent and a developer could co-edit the same diagram simultaneously.

**Reference:** [VS Code LiveShare Extension API](https://aka.ms/vsls-api)

---

## Feature 15 — Dependency Impact Analyser

**Theme:** AI/Automation | **Priority:** Medium

Given a change to one node (e.g. "Order Service is changing its API contract"), highlight all
directly and transitively affected nodes in the diagram:

- Performs a BFS/DFS from the changed node across all edges
- Colours affected nodes by hop distance (direct = red, 2 hops = orange, 3+ = yellow)
- Generates an agent-readable impact report: `"Changing Order Service affects: Payment Gateway (direct), Reporting Service (2 hops via Kafka), Analytics Dashboard (3 hops)"`

**Implementation ideas:**

- `DiagramService.computeImpact(nodeId, direction: 'downstream' | 'upstream' | 'both')`
- Command: `DiagramFlow: Show impact of selected node`
- Output the impact summary to `agentContext.impactAnalysis` (ephemeral, not persisted)

**Agent value:** Very high — agents evaluating refactoring risk can query the impact before making
changes.

---

## Summary Ranking

| # | Feature | Impact | Effort | Priority |
|---|---|---|---|---|
| 6 | Copilot Chat Integration | Very High | High | 1 |
| 2 | Code-to-Diagram Generation | Very High | High | 2 |
| 15 | Dependency Impact Analyser | Very High | Medium | 3 |
| 3 | Diagram Linting / Health | High | Low | 4 |
| 10 | Keyboard Power User Mode | High | Low | 5 |
| 9 | Export to Other Formats | High | Medium | 6 |
| 1 | Minimap Navigation | High | Very Low | 7 |
| 5 | Full-Text Search | Medium-High | Low | 8 |
| 4 | Smart Templates | Medium | Low | 9 |
| 8 | Git Diff Overlay | High | High | 10 |
| 7 | Node Expand/Collapse | Medium | Medium | 11 |
| 12 | Diagram as Documentation Site | High | Medium | 12 |
| 11 | Version History Timeline | Medium | Medium | 13 |
| 13 | Sticky Notes | Low-Medium | Low | 14 |
| 14 | Live Multiplayer Editing | Medium | Very High | 15 |

---

## References

- [Excalidraw](https://excalidraw.com) — collaborative whiteboard; inspiration for sticky notes,
  keyboard shortcuts, and minimap
- [Miro](https://miro.com) — enterprise diagramming; template library and presentation mode
- [Lucidchart](https://lucidchart.com) — linting and best-practice suggestions
- [draw.io / diagrams.net](https://draw.io) — format interoperability reference
- [Structurizr](https://structurizr.com) — C4 model tooling; version history and workspace
  management
- [VS Code Chat Participants API](https://code.visualstudio.com/api/extension-guides/chat)
- [ReactFlow](https://reactflow.dev) — MiniMap, Background, Controls built-ins
- [VS Code LiveShare Extension API](https://aka.ms/vsls-api)
