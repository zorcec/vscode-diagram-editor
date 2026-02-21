# Agent-Readable Diagram Metadata — Research & Design

## Overview

This document captures research on what metadata a diagram file should contain to allow an AI coding
agent (GitHub Copilot, Claude, GPT-4, etc.) to understand the architecture and flow of an application
— even when no VS Code extension is installed.

The goal is a `.diagram` JSON format that is:

- **Self-describing**: A cold-reading LLM understands what the file is and how to use its data
- **Semantically rich**: Nodes carry enough information that an agent can reason about responsibilities
- **Machine-traversable**: Structured graph that supports automated analysis (not just prose)
- **Auto-generated**: Our tooling maintains `agentContext` — the agent never has to construct it

---

## Research Summary — Existing Standards

### C4 Model (Simon Brown)

The C4 model (Context → Container → Component → Code) is the strongest reference for semantic
architecture metadata. Key lessons:

- **`description`** on a Container or Component is the primary semantic field; without it, a node
  is a named box with no meaning
- **`technology`** is the second most valuable field — it tells the agent what runtime constraints
  exist (language, framework, protocol version)
- **`properties` map** is an open key/value extension point in Structurizr DSL — machine-readable
  fields like `repo`, `team`, `openapi` belong here
- Abstraction levels (`context`, `container`, `component`) help agents scope their reasoning

References: [C4 Model](https://c4model.com), [Structurizr](https://structurizr.com)

### arc42 (Software Architecture Template)

arc42 is a documentation template with 12 sections. The most LLM-valuable sections:

- **Section 6 — Runtime View**: Call chains and interaction sequences — highest value for flow
  understanding. Maps directly to diagrams with labeled edges.
- **Section 9 — Architecture Decisions** (ADRs): Why decisions were made. An agent that knows
  *why* a decision was made will not accidentally reverse it.
- **Section 12 — Glossary**: Shared vocabulary prevents the agent from misinterpreting domain terms.

Key insight: linking a node's `properties.adr` to ADR documents prevents an LLM from undoing
intentional design choices.

References: [arc42](https://arc42.org)

### Structurizr DSL

Structurizr's `properties` block is the most pragmatic extension mechanism:

```
container orderService "Order Service" "Java 21, Spring Boot 3" {
    properties {
        "repo" "github.com/org/order-service"
        "team" "Fulfilment Squad"
        "entrypoint" "src/main/java/com/org/OrderApplication.java"
        "openapi" "https://internal.example.com/order-service/openapi.json"
    }
    tags "internal" "stateful" "pii-adjacent"
}
```

`tags` serve as a classification layer for agents: `"security-boundary"`, `"external"`,
`"deprecated"`, `"being-migrated"` are high-signal tags.

### Mermaid / PlantUML

Both are text-based and LLM-readable as source (the LLM can parse the syntax), but carry very
little semantic metadata — they are layout languages, not architecture languages. They do not solve
the problem of machine-consumable component descriptions.

---

## The "Description Gap" Problem

Every format surveyed suffers the same failure in practice:

> Nodes have names but no descriptions.

A node named `"svc-alpha-gateway"` tells an agent almost nothing. The **single highest ROI**
intervention is adding a one-sentence `description` to every node.

### Graph vs. Text Duality

LLMs process architecture diagrams best when they have *both*:

- **Graph structure** (nodes/edges with typed relationships) — for exact structural reasoning
- **Prose descriptions** (per-node, per-edge, per-group) — for semantic reasoning

A JSON with only graph structure (no prose) is like a dependency tree — parseable but not
understandable. A JSON with only prose cannot be programmatically traversed.

---

## Ranked Metadata Fields for LLM Agents

### Tier 1 — Without These, the Agent Cannot Reason

| Field | Location | Example |
|---|---|---|
| `type` | node | `"Container"`, `"Service"`, `"Database"`, `"Person"` |
| `name` / `label` | node | `"Order Service"` |
| `description` | node | `"Handles order placement, cancellation, and fulfilment lifecycle."` |
| `technology` | node | `"Java 21, Spring Boot 3, Kafka consumer"` |
| `target` | edge | `"Inventory Service"` |
| `description` | edge | `"Publishes order.created event"` |
| `protocol` | edge | `"Kafka (async)"` |

### Tier 2 — Contextual Reasoning

| Field | Example |
|---|---|
| `tags` | `["security-boundary", "external-facing", "deprecated"]` |
| `properties.repo` | `"github.com/org/order-service"` |
| `properties.team` | `"Fulfilment Squad"` |
| `properties.entrypoint` | `"src/main/java/com/org/OrderApplication.java"` |
| `properties.openapi` | `"https://internal.example.com/order-service/openapi.json"` |
| `group` | `"payment-domain"`, `"eu-west-1-vpc"` |
| `deploymentEnvironment` | `"production"`, `"staging"` |

### Tier 3 — Deep Architectural Understanding

| Field | Example |
|---|---|
| `properties.adr` | `"docs/adr/0003-use-kafka.md"` |
| `properties.qualityGoals` | `["high-availability", "eventual-consistency"]` |
| `properties.technicalDebt` | `"Synchronous DB calls in hot path, tracked in JIRA-1234"` |
| `securityClassification` | `"pii-data-store"`, `"public"`, `"internal"` |
| `dataFlows[].dataTypes` | `["OrderDTO", "CustomerPII"]` |
| `glossary` | `{ "fulfilment": "Process of preparing and shipping a placed order" }` |

---

## What Existing Standards Do NOT Address

None of C4, arc42, Structurizr, Mermaid, or PlantUML natively support:

- **Source code linkage** per node (`repo` + `entrypoint`) — must be added via custom properties
- **Event/message schema references** — partially addressed by AsyncAPI, not architecture tools
- **Data flow semantics** — what *type* of data flows on an edge, not just protocol
- **LLM context hints** — e.g., `"agentNote": "Being rewritten in Rust; ignore Java references"`
- **Deprecation/migration state** — e.g., `"status": "being-replaced-by:order-service-v2"`

---

## The DiagramFlow `agentContext` Design

### Design Goals

1. An agent can understand the diagram without any extension installed
2. The block is visually obvious (clearly labelled as agent-readable metadata)
3. It is auto-generated by the tool on every save — agents do not write to it
4. It uses labels (not internal IDs) so it is human and agent readable

### Current Schema

The `agentContext` block is embedded in the `.diagram` JSON at the top level:

```json
{
  "nodes": [...],
  "edges": [...],
  "agentContext": {
    "format": "diagramflow-v1",
    "generatedAt": "2026-01-15T10:30:00.000Z",
    "summary": "This diagram contains 4 nodes and 3 edges. Key components: Order Service, Inventory Service, Payment Gateway, PostgreSQL. Key connections: Order Service → Inventory Service (reserve stock), Order Service → Payment Gateway (charge customer).",
    "nodeIndex": [
      { "id": "abc123", "label": "Order Service", "notes": "Handles order lifecycle", "group": "order-domain" }
    ],
    "edgeIndex": [
      { "from": "Order Service", "to": "Inventory Service", "label": "reserve stock" }
    ],
    "groupIndex": [
      { "group": "order-domain", "members": ["Order Service", "Inventory Service"] }
    ],
    "usage": "This diagram was created with the DiagramFlow VS Code extension. If the extension is installed, use the diagramflow_addNodes, diagramflow_addEdges, diagramflow_updateNodes, diagramflow_updateEdges tools to modify it programmatically."
  }
}
```

### Why Labels Instead of IDs in `edgeIndex`

Internal node IDs (nanoid-generated) are opaque to agents. Using `from`/`to` labels makes the
edge list directly readable: `"Order Service → Inventory Service"` is immediately meaningful.

### Why Auto-Generate (Not Agent-Written)

The `agentContext` block is guaranteed to be accurate because:

- It is regenerated on every semantic operation (`applyOps`)
- It is regenerated on every auto-layout (`autoLayoutAll`)
- Agents read it but never write to it — they use the `diagramflow_*` MCP tools instead

This avoids the classic "stale documentation" problem.

---

## Recommended Future Enhancements

### Short Term (Node-level `notes` as semantic carrier)

The current `notes` field on nodes is the primary prose carrier. Users should be encouraged to
write descriptions in `notes`. Future UI can prompt: *"Add a description for this component."*

### Medium Term (Typed node `type` property)

Add a `type` field to nodes mirroring C4 model levels:

```json
{ "type": "Container" | "Service" | "Database" | "Person" | "ExternalSystem" | "MessageQueue" }
```

The `agentContext.nodeIndex` would include `type` in Tier 1.

### Long Term (Per-edge `protocol` and `dataTypes`)

Add structured edge metadata for data flow semantics:

```json
{
  "label": "order.created",
  "protocol": "Kafka (async)",
  "dataTypes": ["OrderDTO"]
}
```

These fields would appear in `agentContext.edgeIndex` and make the diagram a proper data-flow
document.

### Diagram-Level `meta` Block

Add a top-level `meta` object following C4/arc42 conventions:

```json
{
  "meta": {
    "title": "E-Commerce Platform — Container Diagram",
    "description": "Shows all runtime containers for the order domain.",
    "abstractionLevel": "container",
    "lastUpdated": "2026-02-21",
    "owners": ["platform-team"],
    "glossary": {
      "fulfilment": "The process of picking, packing, and shipping a placed order."
    }
  }
}
```

The `agentContext.summary` would be derived from this `meta` block when available.

---

## References

- [C4 Model](https://c4model.com) — Simon Brown's container/component model
- [Structurizr DSL](https://docs.structurizr.com/dsl) — machine-readable architecture DSL
- [arc42](https://arc42.org) — software architecture documentation template
- [AsyncAPI](https://www.asyncapi.com) — event-driven API specification
- [Mermaid](https://mermaid.js.org) — text-based diagramming
- [PlantUML C4](https://github.com/plantuml-stdlib/C4-PlantUML) — C4 model in PlantUML
