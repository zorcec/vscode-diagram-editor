import { memo, useState, useCallback } from 'react';
import { Handle, Position, NodeToolbar } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import type { DiagramNodeData } from '../lib/docToFlow';

type DiagramNodeProps = NodeProps & {
  data: DiagramNodeData & {
    onLabelChange?: (id: string, label: string) => void;
    onUnpin?: (id: string) => void;
    onRemoveFromGroup?: (id: string) => void;
  };
};

export const DiagramNode = memo(({ id, data, selected }: DiagramNodeProps) => {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(data.label);

  const commitEdit = useCallback(() => {
    setEditing(false);
    if (editValue.trim() && editValue.trim() !== data.label) {
      data.onLabelChange?.(id, editValue.trim());
    }
  }, [id, editValue, data]);

  const startEdit = useCallback(() => {
    setEditValue(data.label);
    setEditing(true);
  }, [data.label]);

  const isNote = data.shape === 'note';
  const shapeClass = `diagram-node shape-${data.shape} color-${data.color}`;

  return (
    <>
      {!isNote && (
        <>
          {/* All 4 sides get both source and target handles so edges can connect
              from any direction — users are not forced to drag bottom→top only. */}
          <Handle type="source" position={Position.Top} id="top-s" />
          <Handle type="target" position={Position.Top} id="top-t" />
          <Handle type="source" position={Position.Right} id="right-s" />
          <Handle type="target" position={Position.Right} id="right-t" />
          <Handle type="source" position={Position.Bottom} id="bottom-s" />
          <Handle type="target" position={Position.Bottom} id="bottom-t" />
          <Handle type="source" position={Position.Left} id="left-s" />
          <Handle type="target" position={Position.Left} id="left-t" />
        </>
      )}

      <div
        className={shapeClass}
        style={{ width: data.width, height: data.height }}
        onDoubleClick={startEdit}
        data-testid={`node-${id}`}
      >
        {data.pinned && <span className="pin-indicator">📌</span>}

        {editing ? (
          <input
            className="node-label-input"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitEdit();
              if (e.key === 'Escape') setEditing(false);
            }}
            autoFocus
            data-testid={`node-input-${id}`}
          />
        ) : (
          <span className="node-label">{data.label}</span>
        )}
      </div>

      <NodeToolbar isVisible={selected} position={Position.Top}>
        <div className="node-toolbar-actions">
          <button
            className="toolbar-action-btn"
            onClick={startEdit}
            title="Edit label"
          >
            ✏️
          </button>
          {data.pinned && (
            <button
              className="toolbar-action-btn"
              onClick={() => data.onUnpin?.(id)}
              title="Unpin node (allow auto-layout to reposition)"
            >
              📍
            </button>
          )}
          {data.onRemoveFromGroup && (
            <button
              className="toolbar-action-btn"
              onClick={() => data.onRemoveFromGroup?.(id)}
              title="Remove from group"
            >
              ⬡
            </button>
          )}
        </div>
      </NodeToolbar>
    </>
  );
});

DiagramNode.displayName = 'DiagramNode';
