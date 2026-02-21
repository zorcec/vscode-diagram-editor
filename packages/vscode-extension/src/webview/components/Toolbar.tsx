import { Panel, useReactFlow } from '@xyflow/react';
import type { LayoutDirection } from '../../types/DiagramDocument';

type ToolbarProps = {
  onAddNode: () => void;
  onAddNote: () => void;
  onAddGroup: () => void;
  onAutoLayout: () => void;
  onAutoLayoutForce: () => void;
  onSortNodes: () => void;
  onExportSvg: () => void;
  onExportPng: () => void;
  onOpenSvg: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onToggleSearch: () => void;
  onToggleShortcuts: () => void;
  layoutDirection: LayoutDirection;
  onSetLayoutDirection: (dir: LayoutDirection) => void;
};

const DIRECTION_LABEL: Record<LayoutDirection, string> = {
  TB: '↕ TB',
  LR: '↔ LR',
  BT: '↕ BT',
  RL: '↔ RL',
};

const DIRECTION_CYCLE: Record<LayoutDirection, LayoutDirection> = {
  TB: 'LR',
  LR: 'BT',
  BT: 'RL',
  RL: 'TB',
};

export function Toolbar({
  onAddNode,
  onAddNote,
  onAddGroup,
  onAutoLayout,
  onAutoLayoutForce,
  onSortNodes,
  onExportSvg,
  onExportPng,
  onOpenSvg,
  onUndo,
  onRedo,
  onToggleSearch,
  onToggleShortcuts,
  layoutDirection,
  onSetLayoutDirection,
}: ToolbarProps) {
  const { fitView } = useReactFlow();

  const toggleDirection = () => onSetLayoutDirection(DIRECTION_CYCLE[layoutDirection]);

  return (
    <Panel position="top-center" className="toolbar" data-testid="toolbar">
      {/* Create */}
      <div className="toolbar-group">
        <button onClick={onAddNode} title="Add Node (N)" data-testid="btn-add-node" className="toolbar-btn">
          + Node
        </button>
        <button onClick={onAddNote} title="Add Sticky Note" data-testid="btn-add-note" className="toolbar-btn">
          📝 Note
        </button>
        <button onClick={onAddGroup} title="Add Group (G)" data-testid="btn-add-group" className="toolbar-btn">
          ⬡ Group
        </button>
      </div>

      <div className="toolbar-separator" />

      {/* History */}
      <div className="toolbar-group">
        <button onClick={onUndo} title="Undo (Ctrl+Z)" data-testid="btn-undo" className="toolbar-btn">
          ↩
        </button>
        <button onClick={onRedo} title="Redo (Ctrl+Shift+Z)" data-testid="btn-redo" className="toolbar-btn">
          ↪
        </button>
      </div>

      <div className="toolbar-separator" />

      {/* Arrange */}
      <div className="toolbar-group">
        <button
          onClick={toggleDirection}
          title={`Layout direction: ${layoutDirection} (click to cycle TB → LR → BT → RL)`}
          data-testid="btn-layout-direction"
          className="toolbar-btn toolbar-btn--direction"
        >
          {DIRECTION_LABEL[layoutDirection]}
        </button>
        <button onClick={onAutoLayout} title="Auto Layout — repositions unpinned nodes (L)" data-testid="btn-layout" className="toolbar-btn">
          ⬡ Layout
        </button>
        <button onClick={onAutoLayoutForce} title="Force Layout — repositions ALL nodes including pinned (Shift+L)" data-testid="btn-layout-force" className="toolbar-btn">
          ⬡! Force
        </button>
        <button onClick={onSortNodes} title="Sort nodes by position in reading order" data-testid="btn-sort-nodes" className="toolbar-btn">
          ⇅ Sort
        </button>
        <button onClick={() => fitView({ padding: 0.2 })} title="Fit View (F)" data-testid="btn-fit" className="toolbar-btn">
          ⊞ Fit
        </button>
      </div>

      <div className="toolbar-separator" />

      {/* Import / Export */}
      <div className="toolbar-group">
        <button onClick={onOpenSvg} title="Import SVG" data-testid="btn-open" className="toolbar-btn">
          ↑ SVG
        </button>
        <button onClick={onExportSvg} title="Save as SVG" data-testid="btn-save-svg" className="toolbar-btn">
          ↓ SVG
        </button>
        <button onClick={onExportPng} title="Save as PNG" data-testid="btn-save-png" className="toolbar-btn">
          ↓ PNG
        </button>
      </div>

      <div className="toolbar-separator" />

      {/* Utility */}
      <div className="toolbar-group">
        <button onClick={onToggleSearch} title="Search nodes (Ctrl+F)" data-testid="btn-search" className="toolbar-btn">
          🔍
        </button>
        <button onClick={onToggleShortcuts} title="Keyboard shortcuts (?)" data-testid="btn-shortcuts" className="toolbar-btn">
          ?
        </button>
      </div>
    </Panel>
  );
}

