import type { DiagramDocument, NodeShape, EdgeStyle, ArrowType } from '../types/DiagramDocument';

export function exportToMermaid(doc: DiagramDocument): string {
  const lines: string[] = [];
  lines.push('graph LR');

  for (const node of doc.nodes) {
    const shape = mermaidNodeShape(node.id, node.label, node.shape);
    lines.push(`  ${shape}`);
  }

  for (const edge of doc.edges) {
    const arrow = mermaidArrow(edge.style, edge.arrow);
    const label = edge.label ? `|${escapeLabel(edge.label)}|` : '';
    lines.push(`  ${edge.source} ${arrow}${label} ${edge.target}`);
  }

  return lines.join('\n');
}

function mermaidNodeShape(id: string, label: string, shape: NodeShape): string {
  const escaped = escapeLabel(label);
  switch (shape) {
    case 'rounded':
      return `${id}(${escaped})`;
    case 'diamond':
      return `${id}{${escaped}}`;
    case 'cylinder':
      return `${id}[(${escaped})]`;
    case 'rectangle':
    default:
      return `${id}[${escaped}]`;
  }
}

function mermaidArrow(style: EdgeStyle, arrow: ArrowType): string {
  const lineMap: Record<EdgeStyle, string> = {
    solid: '--',
    dashed: '-.-',
    dotted: '-.-',
  };
  const headMap: Record<ArrowType, string> = {
    normal: '>',
    arrow: '>',
    open: '>',
    none: '',
  };
  return `${lineMap[style]}${headMap[arrow]}`;
}

function escapeLabel(label: string): string {
  return label.replace(/"/g, '#quot;').replace(/\n/g, '<br/>');
}

export function exportToSVG(doc: DiagramDocument): string {
  const padding = 40;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const node of doc.nodes) {
    minX = Math.min(minX, node.x);
    minY = Math.min(minY, node.y);
    maxX = Math.max(maxX, node.x + node.width);
    maxY = Math.max(maxY, node.y + node.height);
  }

  if (doc.nodes.length === 0) {
    minX = 0;
    minY = 0;
    maxX = 200;
    maxY = 100;
  }

  const width = maxX - minX + padding * 2;
  const height = maxY - minY + padding * 2;
  const offsetX = -minX + padding;
  const offsetY = -minY + padding;

  const nodeSvgs = doc.nodes.map((node) =>
    renderSVGNode(node.x + offsetX, node.y + offsetY, node.width, node.height, node.label, node.shape),
  );

  const edgeSvgs = doc.edges.map((edge) => {
    const source = doc.nodes.find((n) => n.id === edge.source);
    const target = doc.nodes.find((n) => n.id === edge.target);
    if (!source || !target) return '';
    return renderSVGEdge(
      source.x + offsetX + source.width / 2,
      source.y + offsetY + source.height / 2,
      target.x + offsetX + target.width / 2,
      target.y + offsetY + target.height / 2,
      edge.label,
      edge.style,
    );
  });

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    '  <defs>',
    '    <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">',
    '      <polygon points="0 0, 10 3.5, 0 7" fill="#333"/>',
    '    </marker>',
    '  </defs>',
    ...edgeSvgs.filter(Boolean),
    ...nodeSvgs,
    '</svg>',
  ].join('\n');
}

function renderSVGNode(
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  shape: NodeShape,
): string {
  const rx = shape === 'rounded' ? 8 : 0;
  const escapedLabel = label.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  return [
    `  <g transform="translate(${x},${y})">`,
    `    <rect width="${w}" height="${h}" rx="${rx}" fill="#f8f9fa" stroke="#333" stroke-width="1.5"/>`,
    `    <text x="${w / 2}" y="${h / 2}" text-anchor="middle" dominant-baseline="central" font-size="12" fill="#333">${escapedLabel}</text>`,
    '  </g>',
  ].join('\n');
}

function renderSVGEdge(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  label: string | undefined,
  style: EdgeStyle,
): string {
  const dasharray = style === 'dashed' ? ' stroke-dasharray="8,4"' : style === 'dotted' ? ' stroke-dasharray="3,3"' : '';
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;

  const parts = [
    `  <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#333" stroke-width="1.5"${dasharray} marker-end="url(#arrowhead)"/>`,
  ];

  if (label) {
    const escaped = label.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    parts.push(
      `  <text x="${midX}" y="${midY - 8}" text-anchor="middle" font-size="10" fill="#666">${escaped}</text>`,
    );
  }

  return parts.join('\n');
}
