/**
 * Module: instructionsLoader.ts
 *
 * Description:
 *   Loads and parses user-defined review instructions from `agent-watch-instructions.md`
 *   in the workspace root. These instructions are merged with the internal risk taxonomy
 *   to form the complete review prompt.
 *
 *   The file uses a simple markdown format where each rule is a list item with an
 *   optional severity tag: [high], [medium], or [low]. If no tag is specified,
 *   the default severity is "medium".
 *
 *   This creates a split between:
 *   - Internal instructions: hardcoded risk taxonomy in reviewEngine.ts (security,
 *     contracts, safety nets, dependencies, critical paths)
 *   - External instructions: user-defined rules in agent-watch-instructions.md
 *     that the user can customize per-project
 *
 * Usage:
 *   import { loadUserInstructions, getUserInstructionsText } from './instructionsLoader';
 *   const rules = await loadUserInstructions();
 *   const promptSection = getUserInstructionsText(rules);
 */

import * as vscode from 'vscode';
import type { RiskTier } from './types';

/** Default filename for user instructions */
const INSTRUCTIONS_FILENAME = 'agent-watch-instructions.md';

/**
 * A single user-defined validation rule parsed from the instructions file.
 */
export type UserRule = {
  /** Severity level for this rule */
  severity: RiskTier;
  /** The rule text describing what to validate */
  text: string;
};

/**
 * Result of loading user instructions.
 */
export type UserInstructions = {
  /** Whether the instructions file was found */
  found: boolean;
  /** Parsed validation rules */
  rules: UserRule[];
  /** Raw file content (for debugging) */
  rawContent: string;
};

/**
 * Loads user-defined instructions from `agent-watch-instructions.md` in the workspace root.
 * Returns empty rules if the file doesn't exist or is empty.
 *
 * @returns Parsed user instructions
 */
export async function loadUserInstructions(): Promise<UserInstructions> {
  const fileUri = resolveInstructionsUri();
  if (!fileUri) {
    return { found: false, rules: [], rawContent: '' };
  }

  try {
    const content = await readFileContent(fileUri);
    if (!content.trim()) {
      return { found: true, rules: [], rawContent: '' };
    }

    const rules = parseInstructions(content);
    return { found: true, rules, rawContent: content };
  } catch {
    return { found: false, rules: [], rawContent: '' };
  }
}

/**
 * Builds a prompt section from user-defined rules.
 * Returns an empty string if there are no rules.
 *
 * @param rules - Parsed user rules
 * @returns Prompt text to append to the system prompt
 */
export function getUserInstructionsText(rules: UserRule[]): string {
  if (rules.length === 0) return '';

  const lines = rules.map((rule) => {
    const tierLabel = rule.severity === 'high' ? 'HIGH' : rule.severity === 'medium' ? 'MEDIUM' : 'LOW';
    return `- [${tierLabel}] ${rule.text}`;
  });

  return `\nAdditional project-specific validation rules (from agent-watch-instructions.md):\n${lines.join('\n')}`;
}

/**
 * Parses the markdown content of the instructions file into UserRule objects.
 *
 * Supported formats:
 *   - `[high] Always flag changes to payment processing code`
 *   - `[medium] Watch for changes to database migration files`
 *   - `[low] Note any changes to README files`
 *   - `Flag removed error handlers` (defaults to medium)
 *
 * Lines starting with `#` are treated as section headers and ignored.
 * Empty lines and lines starting with `>` (blockquotes / comments) are ignored.
 *
 * @param content - Raw markdown content
 * @returns Array of parsed rules
 */
export function parseInstructions(content: string): UserRule[] {
  const rules: UserRule[] = [];
  const lines = content.split('\n');

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line || line.startsWith('#') || line.startsWith('>')) {
      continue;
    }

    // Strip leading list markers: -, *, or numbered (1.)
    const stripped = line.replace(/^[-*]\s+/, '').replace(/^\d+\.\s+/, '');
    if (!stripped) continue;

    const { severity, text } = extractSeverity(stripped);
    if (text) {
      rules.push({ severity, text });
    }
  }

  return rules;
}

/**
 * Extracts severity tag and rule text from a single line.
 * Supports tags like [high], [medium], [low] at the start of the line.
 * Defaults to 'medium' if no tag is found.
 */
function extractSeverity(line: string): { severity: RiskTier; text: string } {
  const tagMatch = line.match(/^\[(high|medium|low)\]\s*/i);
  if (tagMatch) {
    const severity = tagMatch[1].toLowerCase() as RiskTier;
    const text = line.slice(tagMatch[0].length).trim();
    return { severity, text };
  }
  return { severity: 'medium', text: line };
}

/**
 * Resolves the URI of the instructions file in the workspace root.
 */
function resolveInstructionsUri(): vscode.Uri | undefined {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) return undefined;
  return vscode.Uri.joinPath(folders[0].uri, INSTRUCTIONS_FILENAME);
}

/**
 * Reads the content of a file by URI.
 */
async function readFileContent(uri: vscode.Uri): Promise<string> {
  const bytes = await vscode.workspace.fs.readFile(uri);
  return Buffer.from(bytes).toString('utf-8');
}
