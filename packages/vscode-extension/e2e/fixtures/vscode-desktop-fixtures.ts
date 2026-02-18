/**
 * Module: e2e/fixtures/vscode-desktop-fixtures.ts
 *
 * Modular Playwright fixtures for VS Code Desktop E2E testing.
 * Provides reusable setup/teardown for VS Code Desktop, CDP connection, and page.
 * Enables parallel test execution with isolated VS Code Desktop instances.
 */

import { test as base, expect, Page, Browser, chromium } from '@playwright/test';
import { VSCodeDesktopServer } from '../vscode-desktop-server';
import * as helpers from '../helpers/vscode-page-helpers';

/**
 * Extended VS Code page with helper methods
 */
export interface VSCodePage {
	page: Page;
	openFile: (filename: string) => Promise<void>;
	getNotifications: () => Promise<string[]>;
	waitForNotification: (text: string, timeout?: number) => Promise<boolean>;
	isFileOpen: (filename: string) => Promise<boolean>;
	getEditorContent: () => Promise<string>;
	executeCommand: (command: string) => Promise<void>;
}

/**
 * Worker-scoped fixtures (shared across tests in same worker)
 */
type VSCodeWorkerFixtures = {
	vscodeServer: VSCodeDesktopServer;
	vscodeBrowser: Browser;
};

/**
 * Test-scoped fixtures (unique per test)
 */
type VSCodeTestFixtures = {
	vscPage: VSCodePage;
	testStartTime: number;
};

/**
 * Extended test with VS Code fixtures
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

		console.log(`[Worker ${workerInfo.workerIndex}] Connecting Playwright to VS Code Desktop via CDP: ${cdpUrl}`);
		const browser = await chromium.connectOverCDP(cdpUrl);
		console.log(`[Worker ${workerInfo.workerIndex}] Connected to VS Code Desktop`);

		await use(browser);

		console.log(`[Worker ${workerInfo.workerIndex}] Closing browser connection`);
		await browser.close();
	}, { scope: 'worker' }],

	vscPage: async ({ vscodeBrowser, testStartTime }, use, testInfo) => {
		const contexts = vscodeBrowser.contexts();
		if (contexts.length === 0) {
			throw new Error('No browser contexts available in VS Code Desktop');
		}
		const context = contexts[0];

		let page: Page;
		const pages = context.pages();
		if (pages.length > 0) {
			page = pages[0];
			console.log(`[${testInfo.title}] Reusing existing page`);
		} else {
			page = await context.newPage();
			console.log(`[${testInfo.title}] Created new page`);
		}

		await helpers.waitForWorkbench(page);

		const setupTime = Date.now() - testStartTime;
		console.log(`[${testInfo.title}] Test setup completed in ${setupTime}ms`);

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

		const testDuration = Date.now() - testStartTime;
		console.log(`[${testInfo.title}] Test total duration: ${testDuration}ms`);
	},
});

export { expect };
