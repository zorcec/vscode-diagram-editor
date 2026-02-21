import { describe, it, expect, vi } from 'vitest';

vi.mock('vscode', () => import('./__mocks__/vscode'));

import { getWebviewContent } from './getWebviewContent';
import * as vscode from 'vscode';

function makeMockWebview(): vscode.Webview {
  return {
    asWebviewUri: (uri: any) => ({ toString: () => `webview-${uri.path}` }),
    cspSource: 'test-csp',
  } as unknown as vscode.Webview;
}

describe('getWebviewContent', () => {
  it('returns valid HTML with DOCTYPE', () => {
    const webview = makeMockWebview();
    const extensionUri = vscode.Uri.file('/ext');
    const html = getWebviewContent(webview, extensionUri);

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('</html>');
  });

  it('includes CSP meta tag', () => {
    const webview = makeMockWebview();
    const extensionUri = vscode.Uri.file('/ext');
    const html = getWebviewContent(webview, extensionUri);

    expect(html).toContain('Content-Security-Policy');
    expect(html).toContain('test-csp');
  });

  it('includes nonce in script tag', () => {
    const webview = makeMockWebview();
    const extensionUri = vscode.Uri.file('/ext');
    const html = getWebviewContent(webview, extensionUri);

    const nonceMatch = html.match(/nonce-([A-Za-z0-9]+)/);
    expect(nonceMatch).toBeTruthy();
    expect(nonceMatch![1].length).toBe(32);
  });

  it('includes script and style URIs', () => {
    const webview = makeMockWebview();
    const extensionUri = vscode.Uri.file('/ext');
    const html = getWebviewContent(webview, extensionUri);

    expect(html).toContain('index.js');
    expect(html).toContain('index.css');
  });

  it('includes root div for React mount', () => {
    const webview = makeMockWebview();
    const extensionUri = vscode.Uri.file('/ext');
    const html = getWebviewContent(webview, extensionUri);

    expect(html).toContain('<div id="root"></div>');
  });

  it('has title DiagramFlow', () => {
    const webview = makeMockWebview();
    const extensionUri = vscode.Uri.file('/ext');
    const html = getWebviewContent(webview, extensionUri);

    expect(html).toContain('<title>DiagramFlow</title>');
  });
});
