import * as esbuild from 'esbuild';

const watch = process.argv.includes('--watch');

const extensionOptions = {
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'dist/extension.js',
  external: ['vscode'],
  format: 'cjs',
  platform: 'node',
  sourcemap: true,
  logLevel: 'info',
};

const webviewOptions = {
  entryPoints: ['src/webview/index.tsx'],
  bundle: true,
  outdir: 'dist/webview',
  format: 'iife',
  platform: 'browser',
  sourcemap: true,
  logLevel: 'info',
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' },
  loader: { '.css': 'css' },
};

const tasksWebviewOptions = {
  entryPoints: ['src/webview/tasks/index.tsx'],
  bundle: true,
  outdir: 'dist/webview/tasks',
  format: 'iife',
  platform: 'browser',
  sourcemap: true,
  logLevel: 'info',
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' },
  loader: { '.css': 'css' },
};

// Build: Extension Host + Webview + Tasks Webview
await Promise.all([
  esbuild.build(extensionOptions),
  esbuild.build(webviewOptions),
  esbuild.build(tasksWebviewOptions),
]);

if (watch) {
  const [extCtx, webCtx, tasksCtx] = await Promise.all([
    esbuild.context(extensionOptions),
    esbuild.context(webviewOptions),
    esbuild.context(tasksWebviewOptions),
  ]);
  await Promise.all([extCtx.watch(), webCtx.watch(), tasksCtx.watch()]);
  console.log('Watching for changes...');
}
