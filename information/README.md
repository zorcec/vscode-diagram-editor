# DiagramFlow — Information Directory

This directory contains specifications, research documents, and reference diagrams for the
DiagramFlow VS Code extension.

---

## Specifications

| File | Description |
|---|---|
| [DIAGRAM_EDITOR_SPEC.md](DIAGRAM_EDITOR_SPEC.md) | Complete implementation specification v2 — file format, architecture, message protocol, node/edge types, build system, and testing strategy |
| [REACT_FLOW_MIGRATION_SPEC.md](REACT_FLOW_MIGRATION_SPEC.md) | Specification v3 for the React Flow migration and UI/UX overhaul — webview rewrite from vanilla SVG to React Flow |

## Research

| File | Description |
|---|---|
| [AGENT_METADATA_RESEARCH.md](AGENT_METADATA_RESEARCH.md) | Research on agent-readable diagram metadata — what information an LLM/coding agent needs to understand architecture diagrams; includes ranked field priorities, comparison to C4/arc42/Structurizr standards, and the DiagramFlow `agentContext` design |
| [FEATURE_IDEAS.md](FEATURE_IDEAS.md) | Creative feature proposals for making DiagramFlow more useful for developers and AI agents — 15 features ranked by impact and effort |
| [LLM_HELPFUL_METADATA.md](LLM_HELPFUL_METADATA.md) | Practical guide and research findings on which metadata fields help LLMs understand systems — covers all implemented fields with usage examples, best practices for text/image annotations, C4 node types, ADR links, security classifications, and the `agentContext` auto-generated block |
| [COMPETITIVE-ANALYSIS-AND-FEATURE-OPPORTUNITIES.md](COMPETITIVE-ANALYSIS-AND-FEATURE-OPPORTUNITIES.md) | Competitive landscape analysis (draw.io, Excalidraw, Miro, Eraser.io, Whimsical, Lucidchart, Structurizr, GitDiagram) with UI pattern research, feature gap analysis, 8 new feature ideas, and a prioritised Tier 1/2/3 roadmap recommendation |

## Reference Diagrams

| File | Description |
|---|---|
| [high-level-flow.diagram](high-level-flow.diagram) | High-level system flow diagram showing the main components of the DiagramFlow extension (extension host, webview, file system) |

---

## Quick Reference

### Key Architecture Decisions

- Extension uses `CustomTextEditorProvider` — `.diagram` files are JSON text documents
- Webview uses React + `@xyflow/react` v12 for the canvas
- Auto-layout uses `@dagrejs/dagre` (Sugiyama-style hierarchical layout)
- All edits go through `applyOps` → `vscode.workspace.applyEdit` → file save → webview update
- `agentContext` is auto-generated on every save and embedded in the `.diagram` JSON
- Each node has **8 handles** (source + target at Top, Right, Bottom, Left), enabling edges from any side
- Edge routing uses `getSmoothStepPath` with `borderRadius: 8` for clean orthogonal lines
- Bidirectional edges render arrowheads at both ends via `markerStart`/`markerEnd` SVG markers
- `meta.llmNotes` stores agent-written notes; surfaced as `agentContext.llmNotes` across sessions

### File Format (`.diagram`)

```json
{
  "meta": { "llmNotes": "Agent-written architectural notes persisted across sessions" },
  "nodes": [{ "id": "...", "label": "...", "shape": "...", "color": "...", "notes": "..." }],
  "edges": [{ "id": "...", "source": "...", "target": "...", "label": "...", "style": "...", "bidirectional": true }],
  "agentContext": {
    "format": "diagramflow-v1",
    "llmNotes": "...",
    "summary": "...",
    "nodeIndex": [...],
    "edgeIndex": [...],
    "groupIndex": [...]
  }
}
```

### Available LM Tools (12)

| Tool | Purpose |
|---|---|
| `diagramflow_getDiagram` | Read full diagram JSON |
| `diagramflow_readDiagram` | Read human-readable diagram summary |
| `diagramflow_addNodes` | Add one or more nodes |
| `diagramflow_removeNodes` | Remove nodes by id |
| `diagramflow_updateNodes` | Update node properties |
| `diagramflow_addEdges` | Add edges (supports `bidirectional`) |
| `diagramflow_removeEdges` | Remove edges by id |
| `diagramflow_updateEdges` | Update edge properties (supports `bidirectional`) |
| `diagramflow_addGroups` | Add groups |
| `diagramflow_updateGroups` | Update group properties |
| `diagramflow_removeGroups` | Remove groups |
| `diagramflow_setLlmNotes` | Persist agent notes in `meta.llmNotes` |

See [DIAGRAM_EDITOR_SPEC.md](DIAGRAM_EDITOR_SPEC.md) for the complete format definition.
