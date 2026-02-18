/**
 * Module: types.ts
 *
 * Description:
 *   Shared type definitions for the AgentWatch extension.
 *   Contains interfaces and types used across multiple modules including
 *   ReviewIssue, RiskTier, and AgentState.
 *
 * Usage:
 *   import { ReviewIssue, RiskTier, AgentState } from './types';
 */

/**
 * Risk tier for a review issue.
 * - high: Must verify manually (auth, security, removed error handlers)
 * - medium: Worth a close look (changed signatures, new deps, data-write paths)
 * - low: FYI, likely fine (renames, comments, formatting near logic)
 */
export type RiskTier = 'high' | 'medium' | 'low';

/**
 * A single issue found during code review.
 */
export type ReviewIssue = {
  /** Risk tier classification */
  tier: RiskTier;
  /** Relative file path */
  file: string;
  /** 1-based line number where the issue was found */
  line: number;
  /** Short title summarizing the issue */
  title: string;
  /** Detailed explanation of the risk */
  explanation: string;
};

/**
 * State of the AgentWatch extension.
 * - idle: Not watching, no active session
 * - watching: Armed and monitoring file saves
 * - reviewing: Background LLM review in progress
 * - issues: Review complete, issues found
 * - clean: Review complete, no issues found
 */
export type AgentState = 'idle' | 'watching' | 'reviewing' | 'issues' | 'clean';

/**
 * Terminal agent detection pattern.
 */
export type AgentPattern = {
  /** Name of the agent (e.g. "Claude Code", "Cursor") */
  name: string;
  /** Regex pattern to detect agent start */
  startPattern: RegExp;
  /** Regex pattern to detect agent completion */
  endPattern: RegExp;
};
