# DiagramFlow — Competitive Analysis & Feature Opportunities

**Date:** 2026-03-05  
**Scope:** Competitive landscape analysis, UI pattern research, and synthesised feature recommendations
for the DiagramFlow VS Code extension.

---

## 1. Product Overview (DiagramFlow)

DiagramFlow is a **VS Code extension** providing a bidirectional visual diagram editor deeply
integrated with GitHub Copilot. Its unique position:

- Files stored as `.diagram.svg` (SVG + embedded JSON) — renderable anywhere in git/GitHub without
  the extension installed.
- GitHub Copilot agent mode can read and modify diagrams via registered LM Tools — no custom LLM
  panel, no API keys.
- ReactFlow-based webview with Dagre auto-layout.
- Companion `.tasks.md` editor for structured task management.

### Current Feature Surface

| Area | Implemented |
|---|---|
| Canvas | Nodes, edges, groups, auto-layout, sort, undo/redo |
| Node types | Rectangle, rounded, diamond, cylinder, sticky note, free text, image |
| Edge features | Styles (solid/dashed/dotted), arrows, bidirectional, animated |
| AI Tools | readDiagram, getDiagram, addNodes, addEdges, updateNodes, updateEdges, removeNodes, removeEdges, addGroups, updateGroups, removeGroups, setLlmNotes |
| Export | Mermaid, SVG |
| Agent metadata | llmNotes, agentContext (node/edge/group index, summary, topology) |

---

## 2. Competitor Analysis

### 2.1 Draw.io VS Code Extension (`hediet.vscode-drawio`)

**What it is:** The most widely-used diagram editor inside VS Code. Embeds the full draw.io/diagrams.net
editor in a webview.

**Key features:**
- Edits `.drawio.svg` and `.drawio.png` files (same dual-format concept as DiagramFlow)
- **Code Link feature** — node labelled `#MyClass` navigates to that symbol in the workspace
- VS Code LiveShare integration — collaborative editing with visible cursors and selections
- XML side-by-side editing — the diagram XML is a text document, enabling find/replace
- Multiple themes (atlas, Kennedy, minimal, dark)
- Completely offline — no cloud dependency

**What DiagramFlow does better:**
- Native GitHub Copilot LM Tool integration (draw.io has none)
- JSON format is cleaner and version-control-diffable vs XML
- AI-first design (agentContext, llmNotes)
- Tasks kanban sidecar

**What draw.io does better:**
- Massive shape library (stencils, AWS, Azure, GCP icons)
- Code navigation from node to symbol
- Live Share collaboration

**Gap to close:**
- Code navigation from node label → `vscode.workspace.findFiles` or `vscode.workspace.openTextDocument`
- LiveShare presence (cursors/selections)
- Shape library expansion

---

### 2.2 Excalidraw

**What it is:** Open-source collaborative whiteboard; hand-drawn aesthetic; widely used for
architecture sketching, brainstorming, and wireframes.

**Key UX patterns:**
- **`?` keyboard shortcut** — opens a full keyboard shortcut reference overlay instantly
- **`Ctrl+D`** — duplicate selected element; Excalidraw convention adopted by Figma users
- **`Ctrl+F`** — search elements panel with live filter + highlight
- **Alt+drag** — duplicate while dragging (muscle memory from Figma)
- **Context menu on right-click** — Edit, Copy, Paste, Duplicate, Delete, Change to shape
- **Custom Libraries** — save and reuse groups of shapes across files; share as `.excalidrawlib`
- **Freehand draw mode** — sketch rough shapes that get converted to clean SVG
- **Export image** panel — PNG (1×/2×/3× retina), SVG, clipboard copy; background transparency option
- **Element locking** — lock individual elements to prevent accidental moves
- **Frame tool** — rectangular frame that groups and labels a region of the canvas

**What DiagramFlow can adopt:**
- `?` shortcut for shortcut panel (lowest effort, big discoverability gain)
- `Alt+drag` to duplicate nodes
- Right-click context menu on nodes
- Custom node template libraries
- Frame/region tool (different from groups — frames are visual containers, not semantic)

---

### 2.3 Miro (2025)

**What it is:** Enterprise-grade collaborative whiteboard platform. Market leader for remote
brainstorming and visual collaboration.

**Latest features (from changelog):**
- **AI Diagramming** — generate diagrams from natural language; supports custom styles and colors
  via prompt ("make the database nodes blue")
- **AI Slides** — transform board content into presentation slides automatically
- **AI Prototypes** — generate interactive UI screens from sticky notes, flows, or text prompts
- **MCP Server** (miro.com/ai/mcp/) — expose board read/write capabilities to AI agents via
  Model Context Protocol; first diagramming tool in the space to do this publicly
- **Circuit/Electrical Engineering shapes** — specialised shape packs for domain-specific diagrams
- **AI mind map generation** from free-text description
- **Ghost handles on hover** — connection handles only appear when hovering over a node; reduces
  visual noise dramatically

**Miro UX conventions DiagramFlow should match (already partially in MIRO_PARITY_SPEC.md):**
- Single-click to edit label after node is selected (not double-click)
- Ghost handles: show connection points only on hover, not always
- Color picker for sticky notes (yellow, orange, blue, green, red, purple)
- Return to Select mode automatically after placing any element
- Right-click context menu: Edit, Copy, Duplicate, Delete, Change shape
- Alt+drag to duplicate
- Double-click edge label to edit inline

**Miro MCP integration insight:**
Miro now exposes its boards via MCP. This means AI agents (Claude Desktop, Copilot, etc.) can
manipulate Miro boards without being inside VS Code. DiagramFlow's LM Tools are VS Code-only
(Copilot agent mode). Offering an optional MCP adapter server that wraps DiagramFlow's operations
would allow any MCP-compatible AI client to interact with `.diagram.svg` files.

---

### 2.4 Eraser.io / DiagramGPT

**What it is:** AI-first technical documentation and diagramming tool. DiagramGPT generates
professional diagrams from plain English.

**Key features:**
- 5 diagram types from free text: flowcharts, ERDs, cloud architecture, sequence diagrams, BPMN
- Iterative refinement — after generation, the user follows up with natural language to refine
- REST API for programmatic diagram generation
- Code snippets as input — paste a function and DiagramGPT generates a sequence diagram
- Layout customization via prompt ("arrange left to right")

**Insight for DiagramFlow:**
The `DiagramFlow: Generate Diagram from Description` command (already in ideas.md as item 24) is
the right response to Eraser.io. The key differentiator is that DiagramFlow generates into an
editable `.diagram.svg` file in the user's workspace — not a cloud-hosted board. This is a
significant advantage for teams that must keep architecture docs in their repository.

---

### 2.5 Whimsical AI

**What it is:** Lightweight visual collaboration tool with strong AI-powered generation for
flowcharts, mind maps, and sequence diagrams.

**Key features:**
- AI Flowcharts from text prompt — one input, one click, immediate result
- AI Mind Maps — hierarchical structures generated from a topic
- AI Sequence Diagrams — from use-case descriptions
- Swimlane diagram support (BPMN-adjacent)
- Very fast generation (< 5 seconds)

**Insight for DiagramFlow:**
Whimsical's strength is **speed of generation** for standard diagram types. DiagramFlow currently
supports one layout algorithm (Dagre hierarchical). Adding **sequence diagram mode** (participants
on top, time flows down, activation boxes) would directly compete with Whimsical AI for the "generate
a sequence diagram" use case.

---

### 2.6 Lucidchart

**What it is:** Enterprise-grade collaborative diagram tool with AI suggestions.

**Key features:**
- AI-powered shape and connection recommendations
- Intelligent layout suggestions based on diagram type
- Team-wide diagram templates
- Data linking — bind diagram shapes to external data sources (spreadsheets, databases)
- Conditional formatting — change node color/style based on linked data field values
- Presentation mode — walk through a diagram step-by-step, highlighting sections

**Insight for DiagramFlow:**
- **Data linking** could manifest as `meta.scenarios` (already in ideas.md) or external data
  bound to node properties
- **Presentation mode** is a high-value feature for architecture reviews — walk a stakeholder
  through the diagram incrementally
- **Conditional formatting** is powerful for CI/CD status, deployment environment colour-coding

---

### 2.7 Structurizr

**What it is:** Architecture-as-code tool for C4 model diagrams. DSL-first, renders multiple
views from one model.

**Key features:**
- Architecture expressed as code (DSL) — version-controllable
- Multiple views from a single model: System Context, Container, Component, Code
- MCP server at `mcp.structurizr.com` — agents can parse, validate, and export DSL
- Export to Mermaid, PlantUML, C4-PlantUML
- Workspace inspection for violations and inconsistencies

**Insight for DiagramFlow:**
Structurizr proves there is strong demand for **AI-navigable architecture models with MCP access**.
DiagramFlow already has LM Tools; exposing them as an MCP server (a thin HTTP wrapper) would put
DiagramFlow in the same category as Structurizr's MCP server but with a visual editor, not just
a DSL.

---

### 2.8 GitDiagram

**What it is:** Web tool that turns any public GitHub repository into an interactive architecture
diagram using AI (replaces `github.com` with `gitdiagram.com` in any URL).

**Key features:**
- Automatic codebase parsing to extract components and relationships
- Interactive diagram with clickable nodes that navigate to source code
- No manual drawing required

**Insight for DiagramFlow:**
GitDiagram's code-first approach directly translates to DiagramFlow's **Code-to-Diagram Generation**
idea (ideas.md item 2 / FEATURE_IDEAS.md Feature 2). The key advantage DiagramFlow has is that
it can access the *local* workspace (not just public GitHub), including private repos, unreleased
code, Docker Compose files, and OpenAPI specs.

---

### 2.9 ReactFlow Pro Examples (Capability Inventory)

ReactFlow (the underlying library) already provides implementations for several features
DiagramFlow hasn't yet enabled:

| ReactFlow Pro Example | DiagramFlow Status | Value |
|---|---|---|
| Helper Lines (alignment snap guides) | Not implemented | Medium — Miro/Figma standard |
| Auto Layout (dagre, elkjs, d3-force) | Dagre only | Medium — force layout for non-hierarchical |
| Collaborative (yjs CRDT) | Not implemented | Low (complex, needs backend) |
| Copy and Paste | Not implemented | **High — expected baseline** |
| Dynamic Layouting (placeholder nodes) | Not implemented | Medium — smoother onboarding |
| Editable Edge (drag bezier control points) | Not implemented | Medium — diagram polish |
| Expand and Collapse | Not implemented | Medium — large diagram navigation |
| Force Layout | Not implemented | Low-Medium |
| Freehand Draw | Not implemented | Low (changes aesthetic direction) |
| Parent-Child Relation (drag into group) | Not implemented | **High — key UX gap** |
| Selection Grouping (box select) | Archived (skipped) | Low |
| Server-Side Image Creation | Not implemented | Medium (PNG export) |
| Shapes (circle, hexagon, etc.) | 4 shapes only | Low-Medium |
| Undo and Redo | Implemented via VS Code | ✅ Done |

---

## 3. Feature Gap Analysis

### 3.1 Critical UX Gaps (blocking normal usage)

These are features users expect from any visual editor. Their absence creates friction every session.

| Gap | Description | Competitor Reference |
|---|---|---|
| Copy / Paste / Duplicate | No `Ctrl+C`, `Ctrl+V`, `Ctrl+D` support | Excalidraw, draw.io, Figma, every editor |
| Right-click context menu | No contextual actions on nodes/edges | Miro, Excalidraw, draw.io, Mermaid Live |
| Single-click label edit | Requires double-click; Miro uses single-click on already-selected node | Miro, Figma |
| Ghost connection handles | Handles always visible; should appear only on hover | Miro, Figma, Lucidchart |
| Inline edge label editing | Must use properties panel; double-click on edge is standard | draw.io, Excalidraw |

### 3.2 HIGH Value Features (significant productivity gain)

| Feature | Why It Matters | Effort |
|---|---|---|
| Minimap | Standard in ReactFlow; single import; essential for 30+ node diagrams | Very Low |
| Node search (`Ctrl+F`) | Large diagrams are unnavigable without it | Low |
| Keyboard shortcuts panel (`?`) | Discoverability; no code changes to actual shortcuts | Low |
| Parent-Child drag to group | Miro UX: drag a node onto a group to add it | Medium |
| PNG raster export | SVG not accepted in Confluence, GitHub PR comments, Slack | Low |
| Alignment snap guides | Figma/Miro helper lines; ReactFlow Pro example exists | Medium |

### 3.3 AI & Copilot Differentiators (DiagramFlow's unique angle)

These features are only possible because DiagramFlow lives inside VS Code with Copilot access.
No other diagramming tool can offer them.

| Feature | Unique to DiagramFlow | Effort |
|---|---|---|
| `@diagramflow` Copilot Chat Participant | First diagram tool with Copilot chat integration | High |
| Code-to-Diagram generation from workspace | Local files, private repos, OpenAPI, k8s manifests | High |
| Dependency Impact Analyser | BFS from node → highlights affected nodes; AI reads impact report | Medium |
| Diagram Linting → VS Code Diagnostics | Orphan nodes, missing notes, stale edges in Problems panel | Low |
| `diagramflow_findNodes` LLM tool | Predicate filter; reduce token usage 90% on large diagrams | Low |
| LLM Bootstrap from description | Generate diagram from free-text via Command Palette | Medium |
| `tech` metadata field on nodes | Structured stack info for AI context (Go, PostgreSQL, Redis) | Low |
| Source code path linking | Navigate from diagram node to `src/auth/**` code | Low |
| MCP adapter server (optional) | Expose DiagramFlow operations to any MCP client (not VS Code-only) | High |

### 3.4 Medium-Value Features (quality of life)

| Feature | Notes |
|---|---|
| Node Templates / Quick-Add | Pre-defined shapes for DB, API gateway, queue; `T` shortcut |
| Per-edge routing style | Bezier / step / straight per edge; orthogonal edges for C4 style |
| Alt+drag to duplicate | Muscle memory from Figma; Excalidraw pattern |
| Sequence Diagram Mode | Participants on top, activation boxes, time flows down |
| Git Diff Overlay | Green/yellow/red highlights for added/changed/removed since git HEAD |
| Diagram as HTML doc | Static site with hover tooltips for ADR/README integration |
| Swimlane layout | Horizontal lanes for BPMN / process documentation |
| Presentation mode | Step-by-step walkthrough highlighting nodes for architecture reviews |
| Element locking | Lock a node to prevent accidental moves; `L` shortcut |
| Frame/region tool | Visual grouping without semantic meaning (whiteboard aesthetic) |

---

## 4. New Feature Ideas (not yet in existing docs)

The following ideas were identified during research and are **not yet captured** in `FEATURE_IDEAS.md`
or `ideas.md`.

### 4.1 MCP Adapter Server

**Rationale:** Miro and Structurizr both now expose their content via MCP. DiagramFlow's LM Tools
are VS Code-only. An optional lightweight HTTP server (running as a VS Code task or standalone
Node.js process) that translates MCP tool calls into DiagramFlow operations would allow Claude
Desktop, n8n agents, and other MCP clients to read and write `.diagram.svg` files without VS Code.

**Implementation sketch:**
- A standalone `@diagramflow/mcp-server` npm package
- Exposes the same tools as the VS Code LM registration, but over HTTP/SSE
- Reads/writes `.diagram.svg` files directly from the filesystem
- VS Code command: `DiagramFlow: Start MCP Server` (port configurable)

---

### 4.2 Diagram → Presentation Mode

**Rationale:** Lucidchart and Miro both support a "presentation" or "slide-through" mode where
the diagram is walked through in sequence, highlighting one region or group at a time. This is
extremely valuable for architecture review meetings.

**Implementation sketch:**
- Command: `DiagramFlow: Start Presentation`
- Groups become "slides" in order; each activation zooms the viewport to fit that group
- Arrow keys advance/retreat slides
- Optional: speaker notes from `group.description` shown in a status bar tooltipgap

---

### 4.3 Sequence Diagram Mode

**Rationale:** Whimsical AI and Eraser.io DiagramGPT both offer sequence diagram generation.
Sequence diagrams require a different layout (participants across top, time downward, activation
boxes). Currently DiagramFlow treats all diagrams as node-link graphs.

**Implementation sketch:**
- New diagram `meta.type: 'sequence'` triggers a different layout engine
- Participants are horizontal nodes; messages are vertical edges with labels
- LM tool `diagramflow_addMessage` semantics (from, to, label, async: bool)
- The dagre layout is replaced with a custom temporal layout

---

### 4.4 Diagram Health Score in Status Bar

**Rationale:** A single aggregate score ("Diagram Health: 87/100") in the VS Code status bar
gives instant feedback without opening the Problems panel. Encourages teams to maintain quality.

**Implementation sketch:**
- Computed from linting rules (orphan nodes, missing notes, duplicate labels, stale edges)
- Score = 100 minus penalties per rule violation
- Click the badge → opens Problems panel filtered to DiagramFlow diagnostics
- Persisted in `meta.healthScore` for agent consumption

---

### 4.5 Node Visibility Filters (Canvas Filtering)

**Rationale:** In diagrams with 50+ nodes, seeing all nodes at once is overwhelming. Lucidchart's
data linking uses conditional formatting; DiagramFlow's tag/tech/status fields enable filtering.

**Implementation sketch:**
- Toolbar filter dropdown: filter by `group`, `tech`, `color`, `volatility`, `status`
- Non-matching nodes are dimmed to 20% opacity (not removed)
- LM tool `diagramflow_filterView` applies a temporary filter for agent walkthroughs
- Filtering is ephemeral — not persisted in the file

---

### 4.6 AI-Suggested Next Steps (Proactive Agent)

**Rationale:** After an agent reads the diagram, it could proactively surface observations:
"You have 3 orphan nodes", "No disaster-recovery path for the database", "AuthService has 7
inbound edges — consider splitting it".

**Implementation sketch:**
- New LM tool: `diagramflow_reviewDiagram` — returns a structured list of suggestions
- Each suggestion is a string + optional `affectedNodeIds`
- Results shown as VS Code information messages, or as a dedicated sidebar panel
- Human or agent can dismiss or act on each suggestion

---

### 4.7 Embedded Changelog / ADR Reference on Nodes

**Rationale:** draw.io's Code Link navigates from a node to code. DiagramFlow's `sourcePath`
idea (ideas.md) does similar. An extension of this: embedding a link to an Architecture Decision
Record (ADR Markdown file) directly on a node, viewable on hover in a popover.

**Implementation sketch:**
- `node.adrPath?: string` — workspace-relative path to an ADR markdown file
- On hover, render the ADR frontmatter (title, status, date) in a tooltip
- VS Code command: `DiagramFlow: Open ADR for Node`
- `agentContext.nodeIndex` includes `adrPath` for agent citation

---

### 4.8 Collaborative Diagram Reviews (Comment Threads)

**Rationale:** GitHub PR reviews allow inline comments; architecture diagrams need the same.
Miro has sticky-note-based commenting; Lucidchart has threaded comments on shapes.

**Implementation sketch:**
- `node.comments?: { author, text, timestamp, resolved }[]` stored in the diagram JSON
- Render as a small comment indicator badge on the node
- VS Code command or webview button to add/resolve comments
- Copilot can post observations as comments via a new LM tool `diagramflow_addComment`

---

## 5. Prioritised Roadmap Recommendation

### Tier 1: Do Now (low effort, high impact)

These can be shipped in 1–3 days each and close critical UX gaps.

| # | Feature | Why |
|---|---|---|
| T1-1 | Minimap (`<MiniMap>` ReactFlow component) | One import; massive navigation win |
| T1-2 | Keyboard shortcuts panel (`?` key) | Fixes discoverability; static data |
| T1-3 | Copy / Paste / Duplicate (`Ctrl+C/V/D`) | Baseline expectation; ideas.md item 19 |
| T1-4 | Single-click label edit after selection | Miro parity; one-line React event change |
| T1-5 | Right-click context menu on nodes | Standard UX; MIRO_PARITY_SPEC.md gap |
| T1-6 | PNG raster export | `html-to-image` integration; ideas.md item 22 |
| T1-7 | `diagramflow_findNodes` LLM tool | 90% token reduction; Low implementation effort |
| T1-8 | Diagram Linting → VS Code Diagnostics | Feature Ideas #3; pure extension code |

### Tier 2: Next Sprint (medium effort, high strategic value)

| # | Feature | Why |
|---|---|---|
| T2-1 | `@diagramflow` Copilot Chat Participant | Largest Copilot differentiator |
| T2-2 | Inline edge label editing (double-click) | UX gap; ideas.md item 20 |
| T2-3 | Ghost connection handles on hover | Miro standard; improves edge creation |
| T2-4 | Alignment snap guides (helper lines) | ReactFlow Pro example exists |
| T2-5 | Diagram Health Score status bar | Surfaces linting visually; ideas.md complement |
| T2-6 | Per-edge routing (bezier/step/straight) | ideas.md item 21; meta.defaultEdgeType |
| T2-7 | `tech` metadata field + chip rendering | AI context; ideas.md item 10 |
| T2-8 | Source code path linking + command | ideas.md item 11; draw.io Code Link parity |

### Tier 3: Roadmap (high value, requires planning)

| # | Feature | Why |
|---|---|---|
| T3-1 | Code-to-Diagram generation from workspace | Biggest "wow" feature; GitDiagram locally |
| T3-2 | LLM Bootstrap from description | Eraser.io/Whimsical parity; ideas.md item 24 |
| T3-3 | Dependency Impact Analyser | Agent refactoring risk assessment |
| T3-4 | Presentation / Walkthrough Mode | Lucidchart parity; architecture reviews |
| T3-5 | Node Visibility Filters | Large diagram usability |
| T3-6 | Git Diff Overlay | PR review use case; ideas.md item 5 |
| T3-7 | MCP Adapter Server | Non-VS-Code AI clients |
| T3-8 | Node Templates / Quick-Add Panel | ideas.md item 1 |

---

## 6. Key Insights Summary

1. **DiagramFlow's irreplaceable advantage is Copilot LM Tool integration.** No other VS Code
   diagram editor has this. The `@diagramflow` chat participant and code-to-diagram generation
   are the features that will make this extension category-defining.

2. **The biggest UX debt is copy/paste and right-click menus.** Users assume these exist. Their
   absence makes the editor feel prototype-quality regardless of other capabilities.

3. **Miro's MCP launch is a signal.** The industry is converging on MCP as the AI agent protocol
   for tool integration. DiagramFlow should offer an MCP adapter so the LM tools work outside
   VS Code (e.g., Claude Desktop, n8n).

4. **The `.diagram.svg` format is a genuine competitive advantage.** Draw.io also uses
   `.drawio.svg` with similar intent, but DiagramFlow's JSON-embedded format is cleaner for
   diffs and AI reading. The format should be highlighted more prominently in the README.

5. **Sequence diagrams and swimlanes are the missing diagram types.** Excalidraw, Eraser.io,
   and Whimsical all support sequence diagrams natively. Adding a `meta.type` field with a
   dedicated layout engine for sequence diagrams would address the largest gap in diagram type
   coverage.

6. **The ghost handles pattern dramatically reduces connection friction.** In testing at Miro
   and Figma, showing connection handles only on hover (not always) reduces visual noise and
   teaches users where handles are through natural discovery. This should be a high-priority
   Miro parity item.

7. **Proactive agent suggestions are a differentiated opportunity.** Rather than only responding
   to commands, DiagramFlow could surface architecture observations after diagram changes —
   detecting orphan nodes, high-coupling nodes, missing disaster-recovery paths. No competitor
   does this inside VS Code.

---

## 7. References

| Product | URL | Research Focus |
|---|---|---|
| Draw.io VS Code | https://marketplace.visualstudio.com/items?itemName=hediet.vscode-drawio | VS Code integration patterns, Code Link, LiveShare |
| Excalidraw | https://excalidraw.com | UX conventions, keyboard shortcuts, library system |
| Miro Changelog | https://miro.com/changelog/ | Latest AI features, MCP launch, AI diagramming |
| Eraser.io DiagramGPT | https://www.eraser.io/diagramgpt | AI diagram generation UX |
| Whimsical AI | https://whimsical.com/ai | AI flowchart/sequence generation |
| Lucidchart Tour | https://www.lucidchart.com/pages/tour | AI suggestions, data linking patterns |
| Structurizr MCP | https://docs.structurizr.com/ai/mcp | MCP server architecture for diagrams |
| GitDiagram | https://gitdiagram.com | Code-to-diagram from GitHub repos |
| ReactFlow Pro Examples | https://reactflow.dev/pro/examples | Available ReactFlow capabilities |
| VS Code Chat Participant API | https://code.visualstudio.com/api/extension-guides/ai/chat | @participant implementation guide |
