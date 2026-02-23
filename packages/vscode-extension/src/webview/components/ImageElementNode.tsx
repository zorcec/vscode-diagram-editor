import { useCallback, useState } from 'react';
import { NodeResizer } from '@xyflow/react';

export interface ImageElementData {
  src: string;
  description?: string;
  href?: string;
  onDescriptionChange?: (id: string, description: string) => void;
}

interface ImageElementNodeProps {
  id: string;
  data: ImageElementData;
  selected?: boolean;
}

export function ImageElementNode({ id, data, selected }: ImageElementNodeProps) {
  const [imgError, setImgError] = useState(false);

  const handleError = useCallback(() => {
    setImgError(true);
  }, []);

  const imgStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    display: 'block',
    borderRadius: '2px',
  };

  const containerStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    position: 'relative',
    background: 'transparent',
    border: selected ? '1px dashed var(--vscode-focusBorder, #007acc)' : '1px solid transparent',
    borderRadius: '4px',
    overflow: 'hidden',
    boxSizing: 'border-box',
  };

  const imageContent = imgError ? (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#2d2d2d', color: '#888', fontSize: 12 }}>
      <span>⚠ Image not available</span>
    </div>
  ) : (
    <img
      src={data.src}
      alt={data.description ?? ''}
      title={data.description}
      onError={handleError}
      style={imgStyle}
      data-testid={`image-element-${id}`}
    />
  );

  return (
    <>
      <NodeResizer
        isVisible={selected}
        minWidth={40}
        minHeight={30}
        lineStyle={{ stroke: 'var(--vscode-focusBorder, #007acc)', strokeWidth: 1 }}
        handleStyle={{ background: 'var(--vscode-focusBorder, #007acc)' }}
      />
      <div style={containerStyle}>
        {data.href ? (
          <a href={data.href} target="_blank" rel="noreferrer" style={{ display: 'block', width: '100%', height: '100%' }}>
            {imageContent}
          </a>
        ) : (
          imageContent
        )}
        {data.description && (
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              background: 'rgba(0,0,0,0.6)',
              color: '#ccc',
              fontSize: 10,
              padding: '2px 4px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
            title={data.description}
          >
            {data.description}
          </div>
        )}
      </div>
    </>
  );
}
