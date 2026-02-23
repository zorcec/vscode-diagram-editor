# LLM-Helpful Metadata in DiagramFlow

## Overview

This document captures research into what information helps AI agents (GitHub Copilot,
Claude, GPT-4, etc.) reason about software architecture diagrams. It also documents which
fields are already implemented in DiagramFlow and provides practical guidance on how to use
them effectively.

### Why This Matters

Large language models face two core limitations when working with diagrams:

1. **Finite context window** — they cannot hold the entire codebase in memory, so they
   depend on dense, well-structured summaries to reconstruct a mental model quickly.
2. **Missing intent** — diagram nodes show *what* exists, but agents also need *why* it
   was built that way and *what constraints* govern changes.

When diagrams carry rich semantic metadata, an agent can answer questions like "Can I add a
direct call from the API Gateway to the DB?" without needing to read every source file.


---

## Research Findings

### Key Sources

| Source | Key Insight |
|---|---|
| [Lilian Weng — LLM Powered Autonomous Agents](https://lilianweng.github.io/posts/2023-06-23-agent/) | Agents benefit from long-term external memory (vector stores) and structured subgoal decomposition. Dense, searchable summaries mitigate the finite context constraint. |
| [Martin Fowler — Scaling Architecture Conversationally](https://martinfowler.com/articles/scaling-architecture-conversationally.html) | ADRs (Architectural Decision Records), architectural principles, and technology radars give AI the "why" behind decisions — not just the "what". |

### What Helps LLMs the Most

1. **Natural-language labels** — use descriptive labels, not abbreviations (`Payment Gateway`
   not `pg`).
2. **Component roles (C4 model)** — classifying nodes as `Person`, `ExternalSystem`,
   `Container`, `Service`, etc. lets agents apply correct reasoning about trust boundaries
   and data flows.
3. **ADR links** — when a component's design is governed by an Architectural Decision
   Record, pointing agents to that document prevents them from making changes that violate
   deliberate decisions.
4. **Deprecation / replacement status** — prevents agents from extending deprecated
   components or wiring new dependencies into components under migration.
5. **Security classifications** — agents must apply extra caution when modifying
   data-access patterns for PII stores and security boundaries.
6. **Protocol and data-type annotations on edges** — agents need to know *how* two services
   talk (REST vs. Kafka) and *what data* flows between them to generate correct integration
   code.
7. **Glossary** — domain-specific abbreviations in node labels become unambiguous when a
   per-diagram glossary is present.
8. **Architectural callouts (text annotations)** — free-floating text acting as legends,
   warnings, or design intent notes is surfaced directly in `agentContext.textAnnotations`.
9. **Image descriptions** — when a diagram contains embedded screenshots or architecture
   images, their `description` field is the primary LLM-readable signal.
10. **Abstraction level** — declaring `context | container | component` tells agents at
    what level of detail the diagram operates and prevents them from mixing levels.

---

## Implemented Fields Reference

All fields below are auto-included in the `agentContext` block that is regenerated on every
save. AI agents reading a raw `.diagram` or `.diagram.svg` file should read `agentContext`
first.

### `meta` — Diagram-Level Metadata

| Field | Type | Purpose |
|---|---|---|
| `title` | `string` | Human-readable name surfaced in `agentContext.summary` |
| `description` | `string` | Freeform diagram description; appended to summary |
| `abstractionLevel` | `'context' \| 'container' \| 'component'` | C4 level; surfaces in summary |
| `owners` | `string[]` | Team or person accountable for the diagram |
| `glossary` | `Record<string, string>` | Domain term → definition; included in `agentContext.glossary` |

**Example:**
```json
"meta": {
  "title": "Payment Platform — Container Diagram",
  "description": "Shows all services involved in processing a customer payment.",
  "abstractionLevel": "container",
  "owners": ["platform-team"],
  "glossary": {
    "PSP": "Payment Service Provider — external gateway handling card processing",
    "BFF": "Backend-for-Frontend — thin aggregation layer per client type"
  }
}
```

---

### `nodes[].type` — C4-Inspired Component Role

| Value | Meaning |
|---|---|
| `Person` | Human actor interacting with the system |
| `ExternalSystem` | Third-party service outside your trust boundary |
| `Container` | Deployable unit (app, API, mobile app, DB) |
| `Service` | Internal microservice |
| `Database` | Persistent data store |
| `MessageQueue` | Async message broker (Kafka, RabbitMQ, SQS) |
| `Cache` | In-memory cache layer (Redis, Memcached) |
| `Function` | Serverless function |

Agents use `type` to determine:
- Whether a node is under your team's control (`ExternalSystem` → no).
- What kind of change is safe (e.g., modifying internal schema of `Database`).
- Trust boundary reasoning (calls crossing into `ExternalSystem` need auth/rate-limiting).

---

### `nodes[].notes` — One-Line Component Description

A single sentence describing what the component does and its primary responsibility.
Surfaces in `agentContext.nodeIndex[].notes`.

```json
"notes": "Validates JWT tokens and enforces RBAC for all API calls"
```

---

### `nodes[].properties` — Structured Linkage and Context

| Property | Type | Agent Use |
|---|---|---|
| `repo` | `string` | Source code location; lets agents navigate to implementation |
| `team` | `string` | Owning team; helps route questions and PRs |
| `entrypoint` | `string` | Main file or service URL |
| `openapi` | `string` | OpenAPI spec URL; lets agents read the contract |
| `adr` | `string` | Path or URL to the governing ADR |
| `qualityGoals` | `string` | SLA, p99 latency target, reliability tier |
| `technicalDebt` | `string` | Description of known debt; surfaced as an insight warning |
| `status` | `string` | `deprecated`, `being-replaced-by:<name>`, or any free text |

**Example:**
```json
"properties": {
  "repo": "github.com/org/payment-api",
  "team": "payments",
  "openapi": "https://api.internal/openapi.json",
  "adr": "docs/adr/0012-use-event-sourcing.md",
  "technicalDebt": "Synchronous DB calls in the hot path — JIRA-4231",
  "status": "being-replaced-by: Payments v2"
}
```

When `status` is `deprecated` or `being-replaced-by:X`, the agent context surfaces an
**insight warning** so agents avoid extending deprecated components.

---

### `nodes[].securityClassification`

| Value | Meaning |
|---|---|
| `public` | No sensitive data, freely callable |
| `internal` | Internal network only |
| `pii-data-store` | Contains personally identifiable information |
| `security-boundary` | Entry point that must enforce auth/audit |

Agents generate an insight warning for `pii-data-store` and `security-boundary` nodes,
reminding them to apply extra caution when changing data-access patterns.

---

### `nodes[].tags`

Free-form string array. Common values that agents recognise:
- `"deprecated"` — triggers a deprecation insight
- `"external-facing"` — public API requiring versioning discipline
- `"stateful"` — has local state; affects scaling advice

---

### `nodes[].deploymentEnvironment`

`production | staging | development | all`

Agents use this to avoid recommending production-only changes in a dev diagram and to
understand which nodes are environment-specific.

---

### `edges[].label`, `edges[].protocol`, `edges[].dataTypes`

| Field | Example | Agent Benefit |
|---|---|---|
| `label` | `"reads user profile"` | Clarifies the semantic meaning of the call |
| `protocol` | `"Kafka (async)"`, `"REST"`, `"gRPC"` | Agents generate correct client code |
| `dataTypes` | `["OrderCreatedEvent", "PaymentResult"]` | Agents use correct schema names in generated code |

**Example:**
```json
{
  "source": "order-service",
  "target": "payment-service",
  "label": "initiate payment",
  "protocol": "Kafka (async)",
  "dataTypes": ["OrderCreatedEvent"]
}
```

---

### Free-Floating Elements as Architectural Annotations

#### Text Elements (`textElements[]`)

Use text annotations as **canvas callouts** to communicate design intent that doesn't fit in
node or edge properties:

- **Legends**: `"Blue border = external-facing (requires CORS + rate limit)"`
- **Decision context**: `"ADR-0007: we deliberate chose REST over gRPC here for tooling compat"`
- **Warning banners**: `"⚠️ This region is in active migration — do not add new dependencies"`
- **Scope boundaries**: `"── PCI-DSS boundary ──"`

Text element `content` is included in `agentContext.textAnnotations[].content`, so it is
readable by any agent that inspects the raw JSON file.

Attach an `href` to link a callout to an external document (ADR, runbook, Confluence page).

#### Image Elements (`imageElements[]`)

Embed architecture screenshots, mockups, or reference diagrams directly on the canvas.
The **`description` field is the primary LLM-readable signal** — agents cannot see the image
binary, only the description text.

Best practices:
- Always fill in `description` with a concise summary of what the image shows.
- Link to the original source via `href` when the image is a screenshot of a third-party doc.

**Example:**
```json
{
  "src": "https://wiki.internal/arch/k8s-topology.png",
  "description": "Kubernetes cluster topology showing 3 node pools: ingress, compute, and data. All pods communicate through an internal mesh.",
  "href": "https://wiki.internal/arch/k8s-overview"
}
```

---

## Auto-Generated `agentContext` Block

DiagramFlow regenerates the `agentContext` block on every save. Agents should **read this
block first** — it is a compact, natural-language representation of the entire diagram with
all semantic metadata flattened into a searchable structure.

### Structure

```json
"agentContext": {
  "format": "diagramflow-v1",
  "generatedAt": "2025-07-15T10:00:00.000Z",
  "summary": "\"Payment Platform\" contains 5 nodes ...",
  "nodeIndex": [ ... ],
  "edgeIndex": [ ... ],
  "groupIndex": [ ... ],
  "glossary": { "PSP": "Payment Service Provider ..." },
  "insights": [
    "\"Order DB\" is classified as \"pii-data-store\" — apply extra caution ...",
    "\"Legacy Processor\" is deprecated — avoid adding new dependencies to it."
  ],
  "textAnnotations": [
    { "content": "Blue = external-facing" }
  ],
  "imageAnnotations": [
    { "src": "arch.png", "description": "Deployment topology for prod cluster" }
  ],
  "usage": "When the DiagramFlow VS Code extension is installed, use the diagramflow_* tools ..."
}
```

### When the Extension Is Installed

Use the LM tools — `diagramflow_getDiagram`, `diagramflow_addNodes`, etc. — rather than
reading raw JSON. The tools return live data that cannot be stale.

### When Reading Raw JSON

Read `agentContext` first to get a structured summary. Fall back to the main document
sections (`nodes`, `edges`, `groups`, `meta`) only if you need position data or full
property sets not included in `agentContext`.

---

## Recommended Workflow for Annotating a Diagram

1. Set `meta.title` and `meta.description` to establish context.
2. Set `meta.abstractionLevel` (C4 level).
3. Set `meta.owners` so agents know who to contact.
4. For each node: set `type`, write a one-sentence `notes`, add relevant `properties`
   (especially `repo`, `team`, and `adr` when applicable).
5. For each significant edge: set `label`, `protocol`, and `dataTypes`.
6. Add `meta.glossary` entries for all domain-specific abbreviations.
7. Place text annotations on the canvas for warnings, legends, and scope boundaries.
8. For embedded images: always write a descriptive `description`.

A well-annotated diagram enables agents to understand the system and generate correct,
context-aware code without reading any external source files.
