/**
 * .vscode-test.mjs
 *
 * Configuration for VS Code E2E tests using @vscode/test-cli
 */

import { defineConfig } from '@vscode/test-cli';

export default defineConfig({
	files: 'packages/vscode-extension/e2e/**/*.vscode.test.{js,ts}',
	workspaceFolder: './packages/vscode-extension/e2e/test-project',
	mocha: {
		ui: 'bdd',
		timeout: 20000,
		color: true
	}
});
