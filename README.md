# AgentWatch

A VS Code extension that runs continuous, risk-focused code review **in the background while AI coding agents are working** — powered by GitHub Copilot.

## Project Structure

```
agent-watch/
├── packages/
│   └── vscode-extension/     # VS Code extension
│       ├── src/               # Extension source code
│       ├── e2e/               # Playwright E2E tests
│       │   ├── fixtures/      # Test fixtures
│       │   ├── helpers/       # Page helpers
│       │   └── test-project/  # Test workspace
│       └── dist/              # Build output
├── playwright.config.ts       # Playwright configuration
├── tsconfig.base.json         # Shared TypeScript config
└── package.json               # Monorepo root
```

## Getting Started

```sh
# Install dependencies
npm install

# Build the extension
npm run build

# Run unit tests
npm test

# Run E2E tests (requires xvfb on Linux)
npm run e2e

# Run E2E tests with browser visible
npm run e2e:headed
```

## Development

### Debug the Extension

Use the **Run AgentWatch Extension** launch configuration in VS Code (F5).
This will build the extension and open a new Extension Host window.

### Unit Tests

Unit tests use **Vitest** and live alongside source files (`*.test.ts`).

```sh
npm test              # Run once
npm run test:watch    # Watch mode
```

### E2E Tests

E2E tests use **Playwright** and launch real VS Code Desktop instances via CDP.

```sh
npm run e2e           # Headless
npm run e2e:headed    # With visible browser
```
