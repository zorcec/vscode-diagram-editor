import { Panel, useReactFlow } from '@xyflow/react';
import { useState, useRef, useEffect, type ReactNode } from 'react';
import type { LayoutDirection } from '../../types/DiagramDocument';

export type ToolboxMode = 'hand' | 'node' | 'note' | 'group' | 'text' | 'image' | null;

interface ToolbarProps {
  toolboxMode: ToolboxMode;
  onSetToolboxMode: (mode: ToolboxMode) => void;
  onAddGroup: () => void;
  onSortNodes: (direction: LayoutDirection) => void;
  onUndo: () => void;
  onRedo: () => void;
  onToggleSearch: () => void;
  onToggleShortcuts: () => void;
  onViewMetadata: () => void;
  layoutDirection: LayoutDirection;
  onSetLayoutDirection: (dir: LayoutDirection) => void;
  selectedGroupId: string | null;
}

const DIRECTION_LABEL: Record<LayoutDirection, string> = {
  TB: '↕ TB',
  LR: '↔ LR',
  BT: '↕ BT',
  RL: '↔ RL',
};

const DIRECTION_SHORT: Record<LayoutDirection, string> = {
  TB: 'TB',
  LR: 'LR',
  BT: 'BT',
  RL: 'RL',
};

const ALL_DIRECTIONS: LayoutDirection[] = ['TB', 'LR', 'BT', 'RL'];

interface ToolSectionProps {
  label: string;
  children: ReactNode;
}

function ToolSection({ label, children }: ToolSectionProps) {
  return (
    <div className="toolbox-section" role="group" aria-label={label}>
      <span className="toolbox-section-label">{label}</span>
      <div className="toolbox-section-btns">{children}</div>
    </div>
  );
}

function useDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return { open, setOpen, ref };
}

export function Toolbar({
  toolboxMode,
  onSetToolboxMode,
  onAddGroup,
  onSortNodes,
  onUndo,
  onRedo,
  onToggleSearch,
  onToggleShortcuts,
  onViewMetadata,
  layoutDirection,
  onSetLayoutDirection,
  selectedGroupId,
}: ToolbarProps) {
  const { fitView } = useReactFlow();
  const sortDropdown = useDropdown();

  const toggleMode = (mode: ToolboxMode) => {
    onSetToolboxMode(toolboxMode === mode ? null : mode);
  };

  const sortLabel = selectedGroupId ? 'Sort In' : 'Sort';
  const sortTitle = selectedGroupId
    ? 'Sort nodes inside the selected group by reading order'
    : 'Sort top-level nodes and groups by reading order';

  return (
    <Panel position="top-left" className="toolbox" data-testid="toolbar">
      {/* Tools */}
      <ToolSection label="Tools">
        <button
          onClick={() => toggleMode('hand')}
          title="Hand Tool (Esc)"
          data-testid="btn-hand"
          className={`toolbox-btn${toolboxMode === 'hand' || toolboxMode === null ? ' toolbox-btn--active' : ''}`}
        >
          <span className="toolbox-btn-icon">✋</span>
          <span className="toolbox-btn-label">Hand</span>
        </button>
        <button
          onClick={() => toggleMode('node')}
          title="Place Node (N)"
          data-testid="btn-add-node"
          className={`toolbox-btn${toolboxMode === 'node' ? ' toolbox-btn--active' : ''}`}
        >
          <span className="toolbox-btn-icon">＋</span>
          <span className="toolbox-btn-label">Node</span>
        </button>
        <button
          onClick={() => toggleMode('note')}
          title="Place Sticky Note"
          data-testid="btn-add-note"
          className={`toolbox-btn${toolboxMode === 'note' ? ' toolbox-btn--active' : ''}`}
        >
          <span className="toolbox-btn-icon">📝</span>
          <span className="toolbox-btn-label">Note</span>
        </button>
        <button onClick={onAddGroup} title="Add Group (G)" data-testid="btn-add-group" className="toolbox-btn">
          <span className="toolbox-btn-icon">⬡</span>
          <span className="toolbox-btn-label">Group</span>
        </button>
        <button
          onClick={() => toggleMode('text')}
          title="Place Text Annotation"
          data-testid="btn-add-text"
          className={`toolbox-btn${toolboxMode === 'text' ? ' toolbox-btn--active' : ''}`}
        >
          <span className="toolbox-btn-icon">T</span>
          <span className="toolbox-btn-label">Text</span>
        </button>
        <button
          onClick={() => toggleMode('image')}
          title="Place Image"
          data-testid="btn-add-image"
          className={`toolbox-btn${toolboxMode === 'image' ? ' toolbox-btn--active' : ''}`}
        >
          <span className="toolbox-btn-icon">🖼</span>
          <span className="toolbox-btn-label">Image</span>
        </button>
      </ToolSection>

      <div className="toolbox-divider" />

      {/* History */}
      <ToolSection label="History">
        <button onClick={onUndo} title="Undo (Ctrl+Z)" data-testid="btn-undo" className="toolbox-btn">
          <span className="toolbox-btn-icon">↩</span>
          <span className="toolbox-btn-label">Undo</span>
        </button>
        <button onClick={onRedo} title="Redo (Ctrl+Shift+Z)" data-testid="btn-redo" className="toolbox-btn">
          <span className="toolbox-btn-icon">↪</span>
          <span className="toolbox-btn-label">Redo</span>
        </button>
      </ToolSection>

      <div className="toolbox-divider" />

      {/* Arrange */}
      <ToolSection label="Arrange">
        {/* Sort split-button: main sort + direction dropdown (only way to change direction) */}
        <div className="toolbox-split-btn" ref={sortDropdown.ref}>
          <button
            onClick={() => onSortNodes(layoutDirection)}
            title={sortTitle}
            data-testid="btn-sort-nodes"
            className="toolbox-btn toolbox-split-btn-main"
          >
            <span className="toolbox-btn-icon">⇅</span>
            <span className="toolbox-btn-label">{sortLabel}</span>
          </button>
          <button
            onClick={() => sortDropdown.setOpen(!sortDropdown.open)}
            title="Sort direction"
            data-testid="btn-sort-direction"
            className="toolbox-split-btn-toggle"
          >
            <span className="toolbox-split-btn-dir">{DIRECTION_SHORT[layoutDirection]}</span>
            <span className="toolbox-split-btn-arrow">▾</span>
          </button>
          {sortDropdown.open && (
            <div className="toolbox-dropdown" data-testid="sort-direction-dropdown">
              {ALL_DIRECTIONS.map((dir) => (
                <button
                  key={dir}
                  className={`toolbox-dropdown-item ${dir === layoutDirection ? 'toolbox-dropdown-item--active' : ''}`}
                  onClick={() => {
                    onSetLayoutDirection(dir);
                    onSortNodes(dir);
                    sortDropdown.setOpen(false);
                  }}
                >
                  {DIRECTION_LABEL[dir]}
                </button>
              ))}
            </div>
          )}
        </div>

        <button onClick={() => fitView({ padding: 0.2 })} title="Fit View (F)" data-testid="btn-fit" className="toolbox-btn">
          <span className="toolbox-btn-icon">⊞</span>
          <span className="toolbox-btn-label">Fit</span>
        </button>
      </ToolSection>

      <div className="toolbox-divider" />

      {/* View */}
      <ToolSection label="View">
        <button onClick={onToggleSearch} title="Search nodes (Ctrl+F)" data-testid="btn-search" className="toolbox-btn">
          <span className="toolbox-btn-icon">🔍</span>
          <span className="toolbox-btn-label">Search</span>
        </button>
        <button onClick={onToggleShortcuts} title="Keyboard shortcuts (?)" data-testid="btn-shortcuts" className="toolbox-btn">
          <span className="toolbox-btn-icon">?</span>
          <span className="toolbox-btn-label">Keys</span>
        </button>
        <button onClick={onViewMetadata} title="View diagram metadata passed to AI agents" data-testid="btn-view-metadata" className="toolbox-btn">
          <span className="toolbox-btn-icon">{'{}'}</span>
          <span className="toolbox-btn-label">Metadata</span>
        </button>
      </ToolSection>
    </Panel>
  );
}

