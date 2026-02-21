# E2E Tests

End-to-end tests for the DiagramFlow VS Code extension using Playwright.
Tests launch a real VS Code Desktop instance with the extension loaded and
interact with it over the Chrome DevTools Protocol (CDP).

## Prerequisites

- Node.js 20+ and `npm install` run from the monorepo root
- Playwright browsers: `npx playwright install chromium` (done once)
- **Linux / CI**: a display server is required (VS Code Desktop is an Electron app)
  - Install Xvfb: `sudo apt-get install -y xvfb`
  - Use `npm run e2e:xvfb` to start a virtual framebuffer automatically

## Running

```sh
# From the monorepo root:

# Linux/CI — virtual framebuffer (recommended for headless environments)
npm run e2e:xvfb

# macOS, Windows, or Linux with a real display
npm run e2e

# Headed mode — shows the browser (useful for debugging)
npm run e2e:headed
```

## How it works

1. `npm run build` compiles the extension into `packages/vscode-extension/dist/`.
2. `VSCodeDesktopServer` downloads and launches VS Code stable with `--extensionDevelopmentPath` and `--remote-debugging-port`.
3. Playwright connects over CDP and runs tests against the live workbench.
4. Each worker gets its own VS Code instance (isolated user-data dir) for parallel execution.

## Test structure

| File | What it tests |
|---|---|
| `smoke.e2e.test.ts` | Extension activates and webview loads |
| `toolbar.e2e.test.ts` | Toolbar buttons and commands |
| `editor-activation.e2e.test.ts` | Custom editor opens `.diagram` files |
| `visual-regression.e2e.test.ts` | Screenshot diffing of the canvas |
| `reposition.e2e.test.ts` | Node drag / group position updates |
| `export-import.e2e.test.ts` | SVG/PNG/Mermaid export, SVG import |

## Configuration

Playwright config: `playwright.config.ts` at the repo root.
Key settings: `headless: true`, retries: 1, 10 parallel workers.
