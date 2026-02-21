import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import type { DiagramGroupNodeData } from '../lib/docToFlow';

type DiagramGroupNodeProps = NodeProps & {
  data: DiagramGroupNodeData;
};

export const DiagramGroupNode = memo(({ data, selected }: DiagramGroupNodeProps) => {
  const colorClass = data.color && data.color !== 'default' ? `group-color--${data.color}` : '';

  return (
    <div
      className={`diagram-group ${colorClass}${selected ? ' diagram-group--selected' : ''}`}
      data-testid="diagram-group-node"
    >
      <span className="diagram-group-label">{data.label}</span>
    </div>
  );
});

DiagramGroupNode.displayName = 'DiagramGroupNode';
