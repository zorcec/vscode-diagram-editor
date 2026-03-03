import * as vscode from 'vscode';
import type { DiagramService } from '../DiagramService';
import { openDiagramDocument, fileNameFromPath, revealDiagramInEditor } from './toolHelpers';

interface SetLlmNotesInput {
  /** Absolute path to the .diagram file to update. */
  filePath: string;
  /**
   * Agent-written notes to persist in meta.llmNotes.
   * Use this to record architectural observations, constraints, decisions, or patterns
   * discovered while working with the diagram. These notes are surfaced in the
   * agentContext block on every future read — they are your long-term memory for this diagram.
   *
   * Examples:
   *  - "Auth service is stateless; session state lives in Redis only."
   *  - "OrderService calls PaymentService synchronously via REST — avoid async alternatives."
   *  - "All PII data flows through DataVault; never bypass it to reach the raw DB."
   *
   * Pass an empty string or null to clear existing notes.
   */
  notes: string;
}

/**
 * Language Model Tool that lets agents write and persist their own observations about a diagram.
 *
 * Unlike node `notes` (which describe individual components for humans), llmNotes is a
 * free-form field for the agent itself — cross-cutting constraints, architectural decisions,
 * migration plans, or anything else the agent wants to remember between sessions.
 *
 * The notes are stored in meta.llmNotes and automatically surfaced in the agentContext
 * block that every other diagram tool reads first.
 */
export class SetLlmNotesTool implements vscode.LanguageModelTool<SetLlmNotesInput> {
  constructor(private readonly diagramService: DiagramService) {}

  async prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<SetLlmNotesInput>,
    _token: vscode.CancellationToken,
  ) {
    const file = fileNameFromPath(options.input.filePath);
    const action = options.input.notes?.trim() ? 'Updating' : 'Clearing';
    return {
      invocationMessage: `${action} agent notes in ${file}...`,
      confirmationMessages: {
        title: 'Update agent notes',
        message: new vscode.MarkdownString(
          options.input.notes?.trim()
            ? `Store agent notes in **${file}**:\n\n> ${options.input.notes.substring(0, 200)}`
            : `Clear agent notes from **${file}**.`,
        ),
      },
    };
  }

  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<SetLlmNotesInput>,
    _token: vscode.CancellationToken,
  ): Promise<vscode.LanguageModelToolResult> {
    const opened = await openDiagramDocument(options.input.filePath);
    if ('error' in opened) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(opened.error),
      ]);
    }

    const result = await this.diagramService.setLlmNotes(
      options.input.notes ?? null,
      opened.doc,
    );

    if (result.success) void revealDiagramInEditor(options.input.filePath);
    return new vscode.LanguageModelToolResult([
      new vscode.LanguageModelTextPart(
        result.success
          ? options.input.notes?.trim()
            ? 'Agent notes saved to meta.llmNotes.'
            : 'Agent notes cleared.'
          : `Failed to update notes: ${result.error}`,
      ),
    ]);
  }
}
