import { useCallback, useRef, useState } from 'react';
import { NodeResizer } from '@xyflow/react';

export interface TextElementData {
  content: string;
  fontSize?: number;
  color?: string;
  bold?: boolean;
  italic?: boolean;
  href?: string;
  onContentChange?: (id: string, content: string) => void;
  onResize?: (id: string, dims: { width: number; height: number }) => void;
}

interface TextElementNodeProps {
  id: string;
  data: TextElementData;
  selected?: boolean;
}

export function TextElementNode({ id, data, selected }: TextElementNodeProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(data.content);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const fontSize = data.fontSize ?? 14;
  const color = data.color ?? 'var(--vscode-editor-foreground, #ccc)';
  const fontWeight = data.bold ? 'bold' : 'normal';
  const fontStyle = data.italic ? 'italic' : 'normal';

  const startEdit = useCallback(() => {
    setDraft(data.content);
    setEditing(true);
    setTimeout(() => textareaRef.current?.select(), 0);
  }, [data.content]);

  const commitEdit = useCallback(() => {
    setEditing(false);
    if (draft !== data.content) {
      data.onContentChange?.(id, draft);
    }
  }, [draft, data, id]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        setEditing(false);
        setDraft(data.content);
      } else if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        commitEdit();
      }
    },
    [commitEdit, data.content],
  );

  const textStyle: React.CSSProperties = {
    fontSize,
    color,
    fontWeight,
    fontStyle,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    cursor: 'text',
    userSelect: 'none',
    padding: '4px',
    width: '100%',
    height: '100%',
    boxSizing: 'border-box',
  };

  return (
    <>
      <NodeResizer
        isVisible={selected}
        minWidth={60}
        minHeight={20}
        lineStyle={{ stroke: 'var(--vscode-focusBorder, #007acc)', strokeWidth: 1 }}
        handleStyle={{ background: 'var(--vscode-focusBorder, #007acc)' }}
      />
      <div className="text-element-node" data-testid={`text-element-${id}`} style={{ width: '100%', height: '100%', position: 'relative' }}>
        {editing ? (
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={handleKeyDown}
            style={{
              ...textStyle,
              background: 'transparent',
              border: `1px solid var(--vscode-focusBorder, #007acc)`,
              resize: 'none',
              outline: 'none',
              fontFamily: 'inherit',
            }}
            autoFocus
          />
        ) : (
          <div
            onDoubleClick={startEdit}
            style={textStyle}
          >
            {data.href ? (
              <a href={data.href} style={{ color: 'inherit', textDecoration: 'underline' }} target="_blank" rel="noreferrer">
                {data.content || <em style={{ opacity: 0.5 }}>Double-click to edit</em>}
              </a>
            ) : (
              data.content || <em style={{ opacity: 0.5 }}>Double-click to edit</em>
            )}
          </div>
        )}
      </div>
    </>
  );
}
