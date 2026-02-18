/**
 * Module: e2e/fixtures/vscode-suite-fixtures.ts
 *
 * Suite-level Playwright fixtures for VS Code Desktop E2E testing.
 * Provides a shared browser context and page for all tests in a suite.
 */

import { test as base, expect, Page, Browser, chromium } from '@playwright/test';
import { VSCodeDesktopServer } from '../vscode-desktop-server';
import * as helpers from '../helpers/vscode-page-helpers';
import { VSCodePage } from './vscode-desktop-fixtures';

/**
 * Worker-scoped fixtures (shared across tests in same worker)
 */
type VSCodeWorkerFixtures = {
	vscodeServer: VSCodeDesktopServer;
	vscodeBrowser: Browser;
	vscPage: VSCodePage;
};

/**
 * Test-scoped fixtures
 */
type VSCodeTestFixtures = {
	testStartTime: number;
};

/**
 * Extended test with suite-level VS Code fixtures
 */
export const test = base.extend<VSCodeTestFixtures, VSCodeWorkerFixtures>({
	testStartTime: async ({}, use) => {
		const startTime = Date.now();
		await use(startTime);
	},

	vscodeServer: [async ({}, use, workerInfo) => {
		const startTime = Date.now();
		const server = new VSCodeDesktopServer();
		await server.start();

		const setupTime = Date.now() - startTime;
		console.log(`[Worker ${workerInfo.workerIndex}] VS Code Desktop server setup completed in ${setupTime}ms`);

		await use(server);

		const metrics = server.getMetrics();
		if (metrics) {
			console.log(`[Worker ${workerInfo.workerIndex}] Server metrics: ${JSON.stringify(metrics)}`);
		}
		await server.stop();
	}, { scope: 'worker' }],

	vscodeBrowser: [async ({ vscodeServer }, use, workerInfo) => {
		const cdpUrl = vscodeServer.getCdpUrl();
		if (!cdpUrl) {
			throw new Error('VS Code Desktop CDP URL not available');
		}

		console.log(`[Worker ${workerInfo.workerIndex}] Connecting to VS Code Desktop via CDP: ${cdpUrl}`);
		const browser = await chromium.connectOverCDP(cdpUrl);

		await use(browser);

		await browser.close();
		console.log(`[Worker ${workerInfo.workerIndex}] Browser connection closed`);
	}, { scope: 'worker' }],

	vscPage: [async ({ vscodeBrowser }, use, workerInfo) => {
		const contexts = vscodeBrowser.contexts();
		if (contexts.length === 0) {
			throw new Error('No browser contexts available in VS Code Desktop');
		}
		const context = contexts[0];

		let page: Page;
		const pages = context.pages();
		if (pages.length > 0) {
			page = pages[0];
			console.log(`[Worker ${workerInfo.workerIndex}] Reusing existing page for suite`);
		} else {
			page = await context.newPage();
			console.log(`[Worker ${workerInfo.workerIndex}] Created new page for suite`);
		}

		await helpers.waitForWorkbench(page);

		console.log(`[Worker ${workerInfo.workerIndex}] Shared VS Code page created for suite`);

		const vscPage: VSCodePage = {
			page,
			openFile: (filename: string) => helpers.openFile(page, filename),
			getNotifications: () => helpers.getNotifications(page),
			waitForNotification: (text: string, timeout?: number) => helpers.waitForNotification(page, text, timeout),
			isFileOpen: (filename: string) => helpers.isFileOpen(page, filename),
			getEditorContent: () => helpers.getEditorContent(page),
			executeCommand: (command: string) => helpers.executeCommand(page, command),
		};

		await use(vscPage);

		console.log(`[Worker ${workerInfo.workerIndex}] Shared VS Code page still active for other tests`);
	}, { scope: 'worker' }],
});

export { expect };
export type { VSCodePage };
