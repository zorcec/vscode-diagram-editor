import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import type { DiagramGroupNodeData } from '../lib/docToFlow';

type DiagramGroupNodeProps = NodeProps & {
  data: DiagramGroupNodeData & {
    onToggleCollapse?: (id: string) => void;
  };
};

export const DiagramGroupNode = memo(({ id, data, selected }: DiagramGroupNodeProps) => {
  const colorClass = data.color && data.color !== 'default' ? `group-color--${data.color}` : '';
  const collapsedClass = data.collapsed ? ' diagram-group--collapsed' : '';

  return (
    <div
      className={`diagram-group ${colorClass}${selected ? ' diagram-group--selected' : ''}${collapsedClass}`}
      data-testid="diagram-group-node"
    >
      <span
        className="diagram-group-label"
        onClick={(e) => { e.stopPropagation(); data.onToggleCollapse?.(id); }}
        title={data.collapsed ? 'Click to expand group' : 'Click to collapse group'}
      >
        {data.collapsed ? '▶ ' : '▼ '}
        {data.label}
      </span>
    </div>
  );
});

DiagramGroupNode.displayName = 'DiagramGroupNode';
