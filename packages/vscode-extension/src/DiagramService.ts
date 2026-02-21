import * as vscode from 'vscode';
import type { DiagramDocument } from './types/DiagramDocument';
import type { SemanticOp } from './types/operations';
import { applyOps, createEmptyDocument } from './lib/operations';
import { computePartialLayout, computeFullLayout } from './lib/layoutEngine';
import { nanoid } from 'nanoid';

export class DiagramService {
  private activeDocument: vscode.TextDocument | null = null;

  setActiveDocument(doc: vscode.TextDocument | null): void {
    this.activeDocument = doc;
  }

  getActiveDocument(): vscode.TextDocument | null {
    return this.activeDocument;
  }

  parseDocument(doc?: vscode.TextDocument): DiagramDocument | null {
    const target = doc ?? this.activeDocument;
    if (!target) return null;
    try {
      return JSON.parse(target.getText()) as DiagramDocument;
    } catch {
      return null;
    }
  }

  async applySemanticOps(
    ops: SemanticOp[],
    doc?: vscode.TextDocument,
  ): Promise<{ success: boolean; error?: string }> {
    const target = doc ?? this.activeDocument;
    if (!target) return { success: false, error: 'No active diagram document' };

    const current = this.parseDocument(target);
    if (!current) return { success: false, error: 'Failed to parse diagram document' };

    const result = applyOps(current, ops, () => nanoid(8));
    if (!result.success || !result.document) {
      return { success: false, error: result.error };
    }

    let modified = result.document;
    modified = applyPartialLayout(modified);

    return writeDocumentToFile(target, modified);
  }

  async autoLayoutAll(doc?: vscode.TextDocument): Promise<void> {
    const target = doc ?? this.activeDocument;
    if (!target) return;

    const current = this.parseDocument(target);
    if (!current) return;

    const resetDoc = structuredClone(current);
    for (const node of resetDoc.nodes) {
      node.pinned = false;
      node.x = 0;
      node.y = 0;
    }

    const layoutResults = computeFullLayout(resetDoc);
    for (const lr of layoutResults) {
      const node = resetDoc.nodes.find((n) => n.id === lr.nodeId);
      if (node) {
        node.x = lr.x;
        node.y = lr.y;
      }
    }

    resetDoc.meta.modified = new Date().toISOString();
    await writeDocumentToFile(target, resetDoc);
  }

  emptyDocument(): DiagramDocument {
    return createEmptyDocument();
  }
}

function applyPartialLayout(doc: DiagramDocument): DiagramDocument {
  const layoutResults = computePartialLayout(doc);
  if (layoutResults.length === 0) return doc;

  const modified = structuredClone(doc);
  for (const lr of layoutResults) {
    const node = modified.nodes.find((n) => n.id === lr.nodeId);
    if (node) {
      node.x = lr.x;
      node.y = lr.y;
    }
  }
  return modified;
}

async function writeDocumentToFile(
  target: vscode.TextDocument,
  doc: DiagramDocument,
): Promise<{ success: boolean; error?: string }> {
  const newText = JSON.stringify(doc, null, 2);
  const edit = new vscode.WorkspaceEdit();
  edit.replace(
    target.uri,
    new vscode.Range(0, 0, target.lineCount, 0),
    newText,
  );
  const applied = await vscode.workspace.applyEdit(edit);
  return applied
    ? { success: true }
    : { success: false, error: 'Failed to apply workspace edit' };
}
