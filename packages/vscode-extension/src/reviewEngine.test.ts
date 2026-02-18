/**
 * AgentWatch ReviewEngine - Unit Tests
 *
 * Tests for prompt building, response parsing, and issue validation.
 * Focuses on the pure parseResponse function which needs no vscode mock.
 */

import { describe, it, expect, vi } from 'vitest';

vi.mock('vscode', () => ({
  lm: { selectChatModels: vi.fn(async () => []) },
  CancellationTokenSource: vi.fn(() => ({ token: {}, cancel: vi.fn(), dispose: vi.fn() })),
  LanguageModelChatMessage: { User: vi.fn((t: string) => ({ role: 'user', content: t })) },
}));

import { parseResponse } from './reviewEngine';

describe('parseResponse', () => {
  it('should parse a valid JSON array of issues', () => {
    const response = JSON.stringify([
      {
        tier: 'high',
        file: 'src/auth.ts',
        line: 47,
        title: 'Token used without validation',
        explanation: 'The auth token from the request header is used directly without validation.',
      },
    ]);

    const issues = parseResponse(response);
    expect(issues).toHaveLength(1);
    expect(issues[0].tier).toBe('high');
    expect(issues[0].file).toBe('src/auth.ts');
    expect(issues[0].line).toBe(47);
    expect(issues[0].title).toBe('Token used without validation');
  });

  it('should return empty array for empty JSON array', () => {
    const issues = parseResponse('[]');
    expect(issues).toHaveLength(0);
  });

  it('should handle markdown code fences around JSON', () => {
    const response = '```json\n[{"tier":"medium","file":"api.ts","line":10,"title":"Sig changed","explanation":"Function signature changed."}]\n```';
    const issues = parseResponse(response);
    expect(issues).toHaveLength(1);
    expect(issues[0].tier).toBe('medium');
  });

  it('should handle code fences without language tag', () => {
    const response = '```\n[{"tier":"low","file":"utils.ts","line":5,"title":"Renamed var","explanation":"Variable renamed."}]\n```';
    const issues = parseResponse(response);
    expect(issues).toHaveLength(1);
  });

  it('should extract JSON array from surrounding text', () => {
    const response = 'Here are the issues:\n[{"tier":"high","file":"a.ts","line":1,"title":"Bug","explanation":"Desc"}]\nEnd.';
    const issues = parseResponse(response);
    expect(issues).toHaveLength(1);
  });

  it('should return empty array for non-JSON response', () => {
    const issues = parseResponse('No issues found in this file.');
    expect(issues).toHaveLength(0);
  });

  it('should return empty array for invalid JSON', () => {
    const issues = parseResponse('[{invalid json}]');
    expect(issues).toHaveLength(0);
  });

  it('should filter out items with invalid tier', () => {
    const response = JSON.stringify([
      { tier: 'critical', file: 'a.ts', line: 1, title: 'Bad', explanation: 'Desc' },
      { tier: 'high', file: 'b.ts', line: 2, title: 'Good', explanation: 'Desc' },
    ]);
    const issues = parseResponse(response);
    expect(issues).toHaveLength(1);
    expect(issues[0].tier).toBe('high');
  });

  it('should filter out items missing required fields', () => {
    const response = JSON.stringify([
      { tier: 'high', file: 'a.ts', line: 1 }, // missing title and explanation
      { tier: 'high', file: 'b.ts', line: 2, title: 'Valid', explanation: 'Desc' },
    ]);
    const issues = parseResponse(response);
    expect(issues).toHaveLength(1);
  });

  it('should normalize line numbers to at least 1', () => {
    const response = JSON.stringify([
      { tier: 'low', file: 'a.ts', line: 0, title: 'Zero line', explanation: 'Desc' },
      { tier: 'low', file: 'b.ts', line: -5, title: 'Negative line', explanation: 'Desc' },
    ]);
    const issues = parseResponse(response);
    expect(issues).toHaveLength(2);
    expect(issues[0].line).toBe(1);
    expect(issues[1].line).toBe(1);
  });

  it('should truncate long titles to 80 characters', () => {
    const longTitle = 'A'.repeat(120);
    const response = JSON.stringify([
      { tier: 'medium', file: 'a.ts', line: 1, title: longTitle, explanation: 'Desc' },
    ]);
    const issues = parseResponse(response);
    expect(issues[0].title.length).toBeLessThanOrEqual(80);
  });

  it('should handle multiple issues', () => {
    const response = JSON.stringify([
      { tier: 'high', file: 'a.ts', line: 10, title: 'Issue 1', explanation: 'Desc 1' },
      { tier: 'medium', file: 'b.ts', line: 20, title: 'Issue 2', explanation: 'Desc 2' },
      { tier: 'low', file: 'c.ts', line: 30, title: 'Issue 3', explanation: 'Desc 3' },
    ]);
    const issues = parseResponse(response);
    expect(issues).toHaveLength(3);
  });

  it('should handle empty string input', () => {
    const issues = parseResponse('');
    expect(issues).toHaveLength(0);
  });

  it('should handle whitespace-only input', () => {
    const issues = parseResponse('   \n\n  ');
    expect(issues).toHaveLength(0);
  });
});
