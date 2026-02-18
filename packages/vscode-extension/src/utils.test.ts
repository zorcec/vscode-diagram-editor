/**
 * AgentWatch Utils - Unit Tests
 *
 * Tests for pure utility functions.
 */

import { describe, it, expect } from 'vitest';
import { formatRiskLevel, shouldReviewFile, truncateText } from './utils';

describe('formatRiskLevel', () => {
  it('should format high risk with red circle', () => {
    expect(formatRiskLevel('high')).toBe('🔴 High Risk');
  });

  it('should format medium risk with yellow circle', () => {
    expect(formatRiskLevel('medium')).toBe('🟡 Medium Risk');
  });

  it('should format low risk with green circle', () => {
    expect(formatRiskLevel('low')).toBe('🟢 Low Risk');
  });
});

describe('shouldReviewFile', () => {
  it('should review regular source files', () => {
    expect(shouldReviewFile('src/index.ts')).toBe(true);
    expect(shouldReviewFile('lib/utils.js')).toBe(true);
    expect(shouldReviewFile('README.md')).toBe(true);
  });

  it('should skip node_modules', () => {
    expect(shouldReviewFile('node_modules/lodash/index.js')).toBe(false);
  });

  it('should skip .git directory', () => {
    expect(shouldReviewFile('.git/config')).toBe(false);
  });

  it('should skip dist directory', () => {
    expect(shouldReviewFile('dist/extension.js')).toBe(false);
  });

  it('should skip build directory', () => {
    expect(shouldReviewFile('build/output.js')).toBe(false);
  });

  it('should skip lock files', () => {
    expect(shouldReviewFile('package-lock.json')).toBe(false);
    expect(shouldReviewFile('yarn.lock')).toBe(false);
  });
});

describe('truncateText', () => {
  it('should return text as-is if within limit', () => {
    expect(truncateText('short', 10)).toBe('short');
  });

  it('should truncate long text with ellipsis', () => {
    expect(truncateText('this is a long text', 10)).toBe('this is a…');
  });

  it('should handle exact length', () => {
    expect(truncateText('exact', 5)).toBe('exact');
  });

  it('should handle empty string', () => {
    expect(truncateText('', 5)).toBe('');
  });
});
