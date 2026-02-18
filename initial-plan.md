# AgentWatch — Concept, Architecture & Implementation Plan

---

## The Problem

AI coding agents (Claude Code, Cursor, Copilot Edits, Aider) are becoming a core part of the developer workflow. But they introduce a new kind of risk: **you didn't write the code, so you don't have the mental context to review it quickly or confidently.** You stare at a diff cold, unsure what to focus on, and either over-review (slow) or under-review (risky).

At the same time, the 30–120 seconds the agent is running is wasted time — too short for deep work, too long to just wait.

---

## The Solution

**AgentWatch** is a VS Code extension that runs a continuous, risk-focused code review **in the background while the agent is still working** — powered by GitHub Copilot (no extra API keys, no extra subscriptions).

As the agent saves files one by one, AgentWatch reviews each one immediately. By the time the agent finishes, the review is already done. Risk flags appear **directly inside the code and inside the git diff view** — not in a separate panel, not in a tab you have to open. The information lives exactly where you're already looking.

---

## Core Value Proposition

- **No waiting** — review runs in parallel with the agent, not after it
- **Zero friction** — uses the GitHub Copilot subscription the developer already has
- **Lives in the code** — flags appear inline, in the diff view, right where you look
- **Signal over noise** — only surfaces what needs human attention, not a summary of every change
- **Feels native** — uses the same VS Code surfaces as TypeScript, ESLint, and GitLens

---

## How It Feels (User Experience)

```
t=0s    Developer arms AgentWatch (Cmd+Shift+B) and runs their agent
        Status bar: 👁 Watching…

t=8s    Agent saves auth.ts
        → Background LLM call fires immediately (non-blocking)

t=11s   🔴 gutter icon appears on line 47 of auth.ts
        CodeLens above the block: "🔴 AgentWatch: token used without validation"
        Status bar: ⚠ 1 issue

t=15s   Agent saves api.ts
        → Background LLM call fires

t=18s   🟡 gutter icon on line 83 of api.ts
        Status bar: ⚠ 2 issues

t=34s   Agent finishes
        → Final sweep fires to catch any remaining files
        Status bar: ⚠ 3 issues found  ← review was already 90% done

        Developer opens Source Control, clicks auth.ts diff:
        → Diff view shows 🔴 gutter icon right on the risky line
        → Hovers it → full explanation tooltip appears inline
        → Already knows exactly what to verify before reading a single line
```

The developer never opens a panel. The review comes to them.

---

## Inline Editor Surfaces

AgentWatch uses **four native VS Code APIs** simultaneously, all driven by the same underlying review data. Together they make the review feel like a built-in language feature.

### Diagnostics (`vscode.languages.createDiagnosticCollection`)
The same system used by TypeScript and ESLint. Produces squiggly underlines on flagged lines, automatic entries in the Problems panel, and a count in the status bar. One API call gives five surfaces for free. Works identically in both the normal editor and the diff view.

### CodeLens (`vscode.languages.registerCodeLensProvider`)
Clickable grey annotation lines that appear above flagged code blocks — the same style as "3 references" or "Run Test". Shows a one-line risk summary without cluttering the code itself. Clicking opens the full explanation.

```
  // 🔴 AgentWatch: auth token used without validation — click to see details
  const token = req.headers['x-api-key'];
```

### After-line Decoration (`vscode.window.createTextEditorDecorationType`)
A greyed-out note appended to the end of the flagged line itself, visible without any interaction:

```
  validateInput(userPayload)    ⚠ input shape changed — verify callers
```

### Hover Provider (`vscode.languages.registerHoverProvider`)
Hovering any flagged line shows a rich markdown tooltip with the full explanation, risk tier, and recent git context for that file — on demand, no clutter until needed:

```
  ┌─────────────────────────────────────────────┐
  │ 🟡 AgentWatch — Medium Risk                 │
  │                                             │
  │ validateInput signature changed. Was called │
  │ with (string) in 4 other places in the      │
  │ codebase. Verify callers won't break.        │
  │                                             │
  │ Last touched: 3 days ago (auth refactor)    │
  └─────────────────────────────────────────────┘
```

### In the Git Diff View
All four surfaces work inside VS Code's built-in diff editor. When the developer opens a changed file from the Source Control panel, AgentWatch's gutter icons, CodeLens annotations, and hover tooltips are already there — overlaid on the standard green/red diff lines. No extra step required.

---

## Risk Tiers

Every flagged issue is assigned one of three tiers:

| Tier | Meaning | Examples |
|---|---|---|
| 🔴 High | Must verify manually | Auth/security changes, removed error handlers, API contract breaks, secrets |
| 🟡 Medium | Worth a close look | Changed function signatures, new dependencies, logic in data-write paths |
| 🟢 Low | FYI, likely fine | Renamed variables, added comments, formatting changes with minor logic nearby |

The model is explicitly instructed: *"Only flag things a human must verify. Do not flag style, formatting, or changes you are confident are correct."*

---

## Continuous Background Review Architecture

The key architectural decision is **per-file, incremental review** rather than one big review at the end. Each file is reviewed independently as soon as the agent saves it.

```
┌──────────────────────────────────────────────────────────────┐
│                      VS Code Extension                       │
│                                                              │
│  ┌──────────────────┐     ┌──────────────────────────────┐   │
│  │  File Watcher    │     │       Review Engine          │   │
│  │                  │     │                              │   │
│  │ onDidSave fires  │────▶│ 1. Is file modified since    │   │
│  │ for every save   │     │    baseline? (git check)     │   │
│  │ in workspace     │     │ 2. Debounce 800ms            │   │
│  └──────────────────┘     │ 3. Get per-file diff         │   │
│                           │ 4. Get file's git history    │   │
│  ┌──────────────────┐     │ 5. Build focused prompt      │   │
│  │ Terminal Watcher │     │ 6. Call Copilot (background) │   │
│  │                  │     │ 7. Parse risk-tiered JSON    │   │
│  │ Detects agent    │────▶│ 8. Emit to all UI surfaces   │   │
│  │ start + finish   │     └──────────────┬───────────────┘   │
│  │ patterns         │                    │                   │
│  └──────────────────┘                    ▼                   │
│                           ┌──────────────────────────────┐   │
│  ┌──────────────────┐     │     vscode.lm API (Copilot)  │   │
│  │   Git Service    │     │     gpt-4o / o1-mini         │   │
│  │                  │     │     Streaming response       │   │
│  │ snapshotBaseline │     └──────────────────────────────┘   │
│  │ getFileDiff      │                                        │
│  │ getRecentHistory │     ┌──────────────────────────────┐   │
│  │ getChangedFiles  │     │      UI Surface Manager      │   │
│  └──────────────────┘     │                              │   │
│                           │  DiagnosticCollection        │   │
│                           │  CodeLensProvider            │   │
│                           │  TextEditorDecorationType    │   │
│                           │  HoverProvider               │   │
│                           │  StatusBarItem               │   │
│                           └──────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

### Why Per-File Is Better Than End-of-Run

A single end-of-run review call sends a large diff, waits for the full response, and renders everything at once. Per-file review means results start appearing within seconds of the first file being saved, each LLM call is small and fast, and if the agent is still running when you look at the first file, the review is already there. A long agent run no longer means a long wait for feedback.

---

## Key Components

### 1. File Watcher
Subscribes to `vscode.workspace.onDidSaveTextDocument`. On every save, checks if the file has been modified since the baseline snapshot (via `git diff --name-only`). If yes, debounces 800ms to avoid firing on rapid sequential saves of the same file, then kicks off a background review call for that file only.

### 2. Terminal Watcher
Subscribes to `vscode.window.onDidWriteTerminalData` to monitor all integrated terminals. Matches configurable regex patterns to detect both agent start (to auto-snapshot baseline) and agent completion (to trigger a final sweep). Ships with patterns for Claude Code, Cursor, Aider, and Copilot Edits out of the box.

### 3. Git Service
Thin wrapper around `git` CLI calls (spawned as child processes):
- `snapshotBaseline()` — records the current HEAD + working tree state
- `getFileDiff(file)` — returns `git diff HEAD -- <file>` for a single file
- `getChangedFiles()` — full list of files modified since baseline
- `getRecentHistory(file)` — `git log --oneline -5 -- <file>` for LLM context

### 4. Review Engine
Receives a single file's diff and git history. Builds a structured, risk-focused prompt and calls the Copilot model via `vscode.lm.selectChatModels()`. Streams the response and parses it into a typed array of `ReviewIssue` objects containing tier, file, line, issue title, and explanation.

### 5. UI Surface Manager
Receives parsed `ReviewIssue` objects and updates all surfaces atomically — diagnostics, CodeLens, after-line decorations, hover data, and status bar count. Handles clearing and re-rendering when files are updated. Persists decorations as the developer switches between files.

---

## Agent Detection Strategy

Three modes, configurable:

**Manual (safest, v1 default):** Developer presses `Cmd+Shift+B` before running their agent to snapshot baseline. File watcher runs continuously. `Cmd+Shift+R` triggers a final sweep when done.

**Terminal Pattern (recommended):** Terminal watcher auto-snapshots when it sees agent invocation patterns and auto-triggers final sweep on completion patterns. Zero manual steps.

**Heuristic (most magical):** If 3+ different files are saved within a 10-second window, assume an agent is running and arm automatically. Works even for agents that don't print recognizable output.

---

## The Review Prompt Strategy

The prompt is the most important design decision in the whole project. Key principles:

- **Ask for risk, not summary** — "what needs human attention" not "explain what changed"
- **Structured output** — JSON array with `tier`, `file`, `line`, `title`, `explanation`
- **Rich context** — diff + recent git history for the file + file's role in the codebase
- **Explicit risk taxonomy** defined in the system prompt:
  - Security surface (auth, input handling, secrets, permissions)
  - Contract changes (public APIs, exported types, DB schema, env vars)
  - Removed safety nets (deleted error handlers, dropped validations, removed tests)
  - New dependencies (added packages, version bumps in package.json / requirements.txt)
  - Logic in critical paths (payments, data writes, state mutations, side effects)

The model is told explicitly: *"Return only issues a human must verify. Do not flag style, formatting, comments, or changes you are confident are safe. If you see no issues, return an empty array."*

---

## UX States

| State | Status Bar | Editor |
|---|---|---|
| Idle, not armed | `👁 AgentWatch` (dim) | Nothing |
| Armed, watching for saves | `👁 Watching…` (dim blue) | Nothing |
| Background review in progress | `$(sync~spin) Reviewing…` | Decorations appear per-file as calls complete |
| Issues found | `⚠ 3 issues` (amber, persistent) | All surfaces populated |
| No issues found | `$(check) Clean` (green, fades after 5s) | Nothing |
| Review cleared | `👁 AgentWatch` (dim) | All decorations removed |

---

## File Structure

```
agentwatch/
├── src/
│   ├── extension.ts          # Activation, command registration, wiring
│   ├── reviewEngine.ts       # Prompt building, LLM call, response parsing
│   ├── gitService.ts         # Git operations (diff, history, baseline)
│   ├── fileWatcher.ts        # onDidSave handler + debounce logic
│   ├── terminalWatcher.ts    # Terminal output pattern monitoring
│   ├── surfaceManager.ts     # DiagnosticCollection, CodeLens, Decorations, Hover
│   ├── statusBar.ts          # Status bar item + state machine
│   └── types.ts              # ReviewIssue, RiskTier, AgentState interfaces
├── media/
│   └── icon.svg              # Status bar icon
├── package.json              # Extension manifest + contributes
├── tsconfig.json
└── README.md
```

---

## Implementation Plan

### Phase 1 — Foundation (Days 1–2)
**Goal: Extension loads, gets a diff for a saved file, calls Copilot, logs output**

- [ ] Scaffold extension (TypeScript, `yo code` or manual)
- [ ] Register commands: `snapshotBaseline`, `triggerFinalSweep`, `clearReview`
- [ ] Implement `GitService` — baseline snapshot + per-file diff + recent history
- [ ] Wire up `vscode.lm` API — verify Copilot model selection and streaming works
- [ ] Implement `FileWatcher` — onDidSave → git check → debounce → log to output channel
- [ ] Keybindings: `Cmd+Shift+B` (baseline), `Cmd+Shift+R` (final sweep)

**Validation:** Save a file after making changes, see a structured diff logged to the output channel.

---

### Phase 2 — Review Engine (Days 3–4)
**Goal: Real risk-tiered output from Copilot, parsed into structured data**

- [ ] Design review prompt with risk taxonomy and structured JSON output spec
- [ ] Implement streaming call to Copilot via `vscode.lm` — parse JSON as it streams
- [ ] Define `ReviewIssue` type: `{ tier, file, line, title, explanation }`
- [ ] Inject `getRecentHistory()` output into prompt context
- [ ] Iterate on prompt quality against representative real-world diffs

**Validation:** Console logs a clean `ReviewIssue[]` array for a changed file with accurate risk tiers.

---

### Phase 3 — Inline UI Surfaces (Days 5–6)
**Goal: Flags appear live in the editor and git diff view as the agent works**

- [ ] Implement `SurfaceManager` — single entry point that takes `ReviewIssue[]` and updates all surfaces
- [ ] `DiagnosticCollection` — squiggles, Problems panel entries, status bar count
- [ ] `CodeLensProvider` — one-line risk summary above each flagged block
- [ ] `TextEditorDecorationType` — after-line greyed text and gutter icons (🔴🟡🟢)
- [ ] `HoverProvider` — full markdown explanation tooltip on hover
- [ ] Verify all surfaces work inside the git diff editor view
- [ ] Decoration persistence when switching between open files

**Validation:** Open a changed file and its diff — flags visible in both, hover works, Problems panel populated.

---

### Phase 4 — Auto-Detection + Status Bar (Day 7)
**Goal: Zero manual steps, clear ambient state throughout**

- [ ] Implement `TerminalWatcher` — pattern matching for Claude Code, Cursor, Aider, Copilot Edits
- [ ] Auto-snapshot baseline on agent start detection
- [ ] Auto-trigger final sweep on agent completion detection
- [ ] Implement `StatusBar` state machine — idle / watching / reviewing / issues / clean
- [ ] Heuristic arming: 3+ files saved within 10s → auto-arm

**Validation:** Run Claude Code end-to-end with no manual commands — flags appear live, status bar tracks state correctly throughout.

---

### Phase 5 — Polish + Ship (Days 8–9)
**Goal: Production-quality extension ready for real daily use**

- [ ] `clearReview` command — removes all decorations and resets status bar
- [ ] Settings: model choice, max diff lines, custom terminal patterns, auto-detect on/off
- [ ] Error states: no Copilot, not a git repo, diff too large, model timeout
- [ ] Graceful degradation if Copilot is unavailable — clear message, no silent failure
- [ ] README with install guide, usage walkthrough, configuration reference
- [ ] Package as `.vsix` for local install (`vsce package`)

---

### Phase 6 — Future (Post-MVP)

- [ ] Dependency graph context — one-hop import analysis fed into the prompt for richer risk assessment
- [ ] "Export as PR comment" — formats the full review as a ready-to-paste GitHub markdown comment
- [ ] Review history — persists past reviews indexed by commit SHA, browsable later
- [ ] Custom risk rules — user-defined patterns the LLM should always flag (e.g. "always flag changes to /payments")
- [ ] GitHub Models REST API fallback — for use outside VS Code or without Copilot

---

## Technical Decisions & Rationale

| Decision | Choice | Reason |
|---|---|---|
| LLM access | `vscode.lm` API | Zero auth overhead, uses existing Copilot subscription |
| Review timing | Per-file on save, not end-of-run | Results appear during the agent run, not after |
| Primary UI surface | Diagnostics + CodeLens + Hover | Native feel, works in diff view, no custom UI needed |
| No webview panel | Intentional omission | Panels feel heavy; inline surfaces are where the developer already looks |
| Language | TypeScript | Native VS Code extension language, full API typings |
| Diff scope | Per-file `git diff HEAD -- <file>` | Small, fast, cheap LLM calls vs one large slow call |
| Agent detection | Terminal watcher + save heuristic | Covers all major agents without per-agent integration |

---

## Requirements

- VS Code 1.90+
- GitHub Copilot extension installed and active (any paid or free tier)
- Git available in PATH
- Workspace must be a git repository

---

## Out of Scope (v1)

- Support for non-git version control
- Multi-root workspace support
- Cloud sync of review history
- AI agent auto-invocation (AgentWatch watches agents, it does not run them)
- Review of binary files or files exceeding the configured diff size limit
