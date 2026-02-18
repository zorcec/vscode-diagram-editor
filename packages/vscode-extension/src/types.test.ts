/**
 * AgentWatch Types - Unit Tests
 *
 * Tests for type definitions and type guards.
 * Since types.ts only contains type definitions, these tests verify
 * that the types are correctly importable and usable.
 */

import { describe, it, expect } from 'vitest';
import type { ReviewIssue, RiskTier, AgentState, AgentPattern } from './types';

describe('types', () => {
  it('should allow creating a valid ReviewIssue', () => {
    const issue: ReviewIssue = {
      tier: 'high',
      file: 'src/auth.ts',
      line: 47,
      title: 'Token used without validation',
      explanation: 'Auth token from request headers used without checking.',
    };

    expect(issue.tier).toBe('high');
    expect(issue.file).toBe('src/auth.ts');
    expect(issue.line).toBe(47);
  });

  it('should support all risk tiers', () => {
    const tiers: RiskTier[] = ['high', 'medium', 'low'];
    expect(tiers).toHaveLength(3);
  });

  it('should support all agent states', () => {
    const states: AgentState[] = ['idle', 'watching', 'reviewing', 'issues', 'clean'];
    expect(states).toHaveLength(5);
  });

  it('should allow creating an AgentPattern', () => {
    const pattern: AgentPattern = {
      name: 'Test Agent',
      startPattern: /test-start/i,
      endPattern: /test-end/i,
    };
    expect(pattern.name).toBe('Test Agent');
    expect(pattern.startPattern.test('test-start')).toBe(true);
  });
});
