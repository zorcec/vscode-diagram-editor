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

### File Format (`.diagram`)

```json
{
  "nodes": [{ "id": "...", "label": "...", "shape": "...", "color": "...", "notes": "..." }],
  "edges": [{ "id": "...", "source": "...", "target": "...", "label": "...", "style": "..." }],
  "agentContext": {
    "format": "diagramflow-v1",
    "summary": "...",
    "nodeIndex": [...],
    "edgeIndex": [...],
    "groupIndex": [...]
  }
}
```

See [DIAGRAM_EDITOR_SPEC.md](DIAGRAM_EDITOR_SPEC.md) for the complete format definition.
