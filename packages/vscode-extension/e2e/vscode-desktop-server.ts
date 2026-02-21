/**
 * Module: e2e/vscode-desktop-server.ts
 *
 * Launches VS Code Desktop (Electron) for Playwright E2E tests.
 * Spawns VS Code Desktop with remote debugging enabled.
 * Supports multiple parallel instances with unique ports.
 */

import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as http from 'http';
import * as fs from 'fs';
import * as os from 'os';
import { downloadAndUnzipVSCode } from '@vscode/test-electron';

/**
 * Performance metrics for server startup
 */
export interface ServerMetrics {
	startTime: number;
	serverReadyTime?: number;
	totalStartupTime?: number;
	port: number;
}

/**
 * VS Code Desktop server instance for parallel test execution
 */
export class VSCodeDesktopServer {
	private serverProcess: ChildProcess | undefined;
	private debuggingPort: number | undefined;
	private cdpUrl: string | undefined;
	private metrics: ServerMetrics | undefined;
	private userDataDir: string | undefined;
	private vscodeExecutablePath: string | undefined;

	/**
	 * Starts VS Code Desktop with the extension and remote debugging enabled
	 */
	async start(): Promise<string> {
		const startTime = Date.now();

		// On Linux, VS Code Desktop (Electron) requires a display server.
		// If DISPLAY is not set we will likely crash during spawn.
		// Run via `npm run e2e:xvfb` to let xvfb-run provide a virtual display.
		if (process.platform === 'linux' && !process.env.DISPLAY) {
			console.warn(
				'WARNING: DISPLAY environment variable is not set on Linux. ' +
				'VS Code Desktop requires a display. ' +
				'Run `npm run e2e:xvfb` to use a virtual framebuffer, or set DISPLAY manually.'
			);
		}

		const extensionDevelopmentPath = path.resolve(__dirname, '..');
		const folderPath = path.resolve(__dirname, 'test-project');

		this.debuggingPort = await findRandomAvailablePort();

		this.userDataDir = path.join(os.tmpdir(), `vscode-test-${this.debuggingPort}`);
		fs.mkdirSync(this.userDataDir, { recursive: true });

		this.metrics = {
			startTime,
			port: this.debuggingPort
		};

		console.log(`Starting VS Code Desktop with debugging port ${this.debuggingPort}...`);
		console.log(`Extension path: ${extensionDevelopmentPath}`);
		console.log(`Workspace path: ${folderPath}`);
		console.log(`User data dir: ${this.userDataDir}`);

		this.vscodeExecutablePath = await downloadAndUnzipVSCode('stable');
		console.log(`VS Code executable: ${this.vscodeExecutablePath}`);

		this.serverProcess = spawn(
			this.vscodeExecutablePath,
			[
				`--remote-debugging-port=${this.debuggingPort}`,
				`--user-data-dir=${this.userDataDir}`,
				`--extensionDevelopmentPath=${extensionDevelopmentPath}`,
				'--no-sandbox',
				'--disable-gpu',
				'--disable-dev-shm-usage',
				'--disable-setuid-sandbox',
				'--disable-extensions',
				'--disable-workspace-trust',
				folderPath
			],
			{
				stdio: 'pipe',
				env: {
					...process.env,
					VSCODE_CLI: '1',
				}
			}
		);

		this.serverProcess.stdout?.on('data', (data) => {
			const output = data.toString().trim();
			if (output) {
				console.log(`[VS Code Desktop ${this.debuggingPort}] ${output}`);
			}
		});

		this.serverProcess.stderr?.on('data', (data) => {
			const output = data.toString().trim();
			if (output) {
				console.error(`[VS Code Desktop ${this.debuggingPort} Error] ${output}`);
			}
		});

		this.serverProcess.on('exit', (code, signal) => {
			console.log(`[VS Code Desktop ${this.debuggingPort}] Process exited with code ${code} and signal ${signal}`);
		});

		await waitForDebugServer(this.debuggingPort);

		this.metrics.serverReadyTime = Date.now();

		// Brief stabilisation wait for VS Code to finish initialising after the
		// CDP endpoint becomes available (extension host, workspace trust etc.).
		await new Promise(resolve => setTimeout(resolve, 1000));

		this.metrics.totalStartupTime = Date.now() - startTime;

		this.cdpUrl = `http://localhost:${this.debuggingPort}`;
		console.log(`VS Code Desktop ready with CDP at: ${this.cdpUrl}`);
		console.log(`Server startup metrics: ${JSON.stringify(this.metrics)}`);
		console.log(`Total startup time: ${this.metrics.totalStartupTime}ms`);

		return this.cdpUrl;
	}

	/**
	 * Stops VS Code Desktop server
	 */
	async stop(): Promise<void> {
		if (this.serverProcess) {
			const stopTime = Date.now();
			console.log(`Stopping VS Code Desktop server on port ${this.debuggingPort}...`);

			this.serverProcess.kill('SIGTERM');

			await new Promise<void>((resolve) => {
				this.serverProcess!.once('exit', () => {
					resolve();
				});
				setTimeout(() => {
					if (this.serverProcess && !this.serverProcess.killed) {
						this.serverProcess.kill('SIGKILL');
					}
					resolve();
				}, 5000);
			});

			if (this.userDataDir && fs.existsSync(this.userDataDir)) {
				try {
					fs.rmSync(this.userDataDir, { recursive: true, force: true });
					console.log(`Cleaned up user data dir: ${this.userDataDir}`);
				} catch (err) {
					console.error(`Failed to clean up user data dir: ${err}`);
				}
			}

			const shutdownTime = Date.now() - stopTime;
			console.log(`Server shutdown time: ${shutdownTime}ms`);

			this.serverProcess = undefined;
			this.debuggingPort = undefined;
			this.cdpUrl = undefined;
			this.metrics = undefined;
			this.userDataDir = undefined;
		}
	}

	getCdpUrl(): string | undefined {
		return this.cdpUrl;
	}

	getPort(): number | undefined {
		return this.debuggingPort;
	}

	getMetrics(): ServerMetrics | undefined {
		return this.metrics;
	}
}

/**
 * Waits for the debugging server to be ready
 */
async function waitForDebugServer(port: number, maxAttempts = 60): Promise<void> {
	for (let i = 0; i < maxAttempts; i++) {
		try {
			const response = await fetch(`http://localhost:${port}/json/version`);
			if (response.ok) {
				console.log(`Debugging server ready on port ${port}`);
				return;
			}
		} catch {
			// Server not ready yet
		}
		await new Promise(resolve => setTimeout(resolve, 1000));
	}
	throw new Error(`VS Code Desktop debugging server did not start on port ${port} after ${maxAttempts} attempts`);
}

/**
 * Finds a random available port in the range 10000-60000
 */
async function findRandomAvailablePort(maxAttempts = 50): Promise<number> {
	for (let i = 0; i < maxAttempts; i++) {
		const port = Math.floor(Math.random() * (60000 - 10000 + 1)) + 10000;
		if (await isPortAvailable(port)) {
			return port;
		}
	}
	throw new Error('Could not find an available port after ' + maxAttempts + ' attempts');
}

/**
 * Checks if a port is available
 */
async function isPortAvailable(port: number): Promise<boolean> {
	return new Promise((resolve) => {
		const testServer = http.createServer();
		testServer.once('error', () => resolve(false));
		testServer.once('listening', () => {
			testServer.close();
			resolve(true);
		});
		testServer.listen(port);
	});
}
