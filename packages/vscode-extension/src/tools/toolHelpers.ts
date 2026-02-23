import * as vscode from 'vscode';

const DIAGRAM_EDITOR_VIEW_TYPE = 'diagramflow.editor';

/**
 * Returns true when a file path is a supported diagram file
 * (either `.diagram` JSON or `.diagram.svg` SVG-with-embedded-JSON).
 */
export function isDiagramPath(filePath: string): boolean {
  return filePath.endsWith('.diagram.svg') || (filePath.endsWith('.diagram') && !filePath.endsWith('.diagram.svg'));
}

/**
 * Opens a diagram file by its absolute filesystem path and returns the
 * TextDocument. Returns an error string if the file cannot be opened.
 *
 * Supports both `.diagram` (JSON) and `.diagram.svg` (SVG with embedded JSON).
 * Use this in every mutating tool `invoke` method so the agent always
 * specifies which file to operate on — no active editor required.
 */
export async function openDiagramDocument(
  filePath: string,
): Promise<{ doc: vscode.TextDocument } | { error: string }> {
  if (!isDiagramPath(filePath)) {
    return {
      error: `Unsupported file type: ${filePath}. Must be a .diagram or .diagram.svg file.`,
    };
  }

  const uri = vscode.Uri.file(filePath);
  try {
    const doc = await vscode.workspace.openTextDocument(uri);
    return { doc };
  } catch {
    return {
      error: `Cannot open file: ${filePath}. Make sure the path exists and is a .diagram or .diagram.svg file.`,
    };
  }
}

/**
 * Reveals the diagram file in the DiagramFlow custom editor so the user
 * can see changes in real time. Falls back silently if this is not possible
 * (e.g. headless environment or editor not available).
 */
export async function revealDiagramInEditor(filePath: string): Promise<void> {
  try {
    const uri = vscode.Uri.file(filePath);
    await vscode.commands.executeCommand('vscode.openWith', uri, DIAGRAM_EDITOR_VIEW_TYPE);
  } catch {
    // Non-critical — the file has already been written; the reveal is best-effort.
  }
}

/** Extracts the filename from a full path for use in invocation messages. */
export function fileNameFromPath(filePath: string): string {
  return filePath.split('/').pop() ?? filePath;
}
