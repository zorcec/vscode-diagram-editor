import type { DiagramDocument, NodeShape, EdgeStyle, ArrowType, TextElement, ImageElement } from '../types/DiagramDocument';

const DIAGRAM_NS = 'https://diagramflow.vscode/schema';

const NODE_FILL_COLORS: Record<string, { fill: string; stroke: string; text: string }> = {
  default: { fill: '#2d2d2d', stroke: '#555', text: '#ccc' },
  blue: { fill: '#1e3a5f', stroke: '#4a90d9', text: '#90c4f9' },
  green: { fill: '#1a3a1a', stroke: '#4a9a4a', text: '#90d490' },
  red: { fill: '#3a1a1a', stroke: '#c84040', text: '#f09090' },
  yellow: { fill: '#3a3a1a', stroke: '#c8a840', text: '#f0d490' },
  purple: { fill: '#2a1a3a', stroke: '#8040c8', text: '#c090f0' },
  gray: { fill: '#333', stroke: '#666', text: '#aaa' },
};

export function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ---------------------------------------------------------------------------
// Mermaid export
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Legacy SVG export (light-theme, no embedded JSON)
// ---------------------------------------------------------------------------

export function exportToSVG(doc: DiagramDocument): string {
  const padding = 40;
  const allElements = [...doc.nodes, ...(doc.textElements ?? []), ...(doc.imageElements ?? [])];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  for (const el of allElements) {
    minX = Math.min(minX, el.x);
    minY = Math.min(minY, el.y);
    maxX = Math.max(maxX, el.x + el.width);
    maxY = Math.max(maxY, el.y + el.height);
  }

  if (allElements.length === 0) { minX = 0; minY = 0; maxX = 200; maxY = 100; }

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
      source.x + offsetX + source.width / 2, source.y + offsetY + source.height / 2,
      target.x + offsetX + target.width / 2, target.y + offsetY + target.height / 2,
      edge.label, edge.style,
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

function renderSVGNode(x: number, y: number, w: number, h: number, label: string, shape: NodeShape): string {
  const rx = shape === 'rounded' ? 8 : 0;
  return [
    `  <g transform="translate(${x},${y})">`,
    `    <rect width="${w}" height="${h}" rx="${rx}" fill="#f8f9fa" stroke="#333" stroke-width="1.5"/>`,
    `    <text x="${w / 2}" y="${h / 2}" text-anchor="middle" dominant-baseline="central" font-size="12" fill="#333">${escapeXml(label)}</text>`,
    '  </g>',
  ].join('\n');
}

function renderSVGEdge(x1: number, y1: number, x2: number, y2: number, label: string | undefined, style: EdgeStyle): string {
  const dasharray = style === 'dashed' ? ' stroke-dasharray="8,4"' : style === 'dotted' ? ' stroke-dasharray="3,3"' : '';
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  const parts = [`  <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#333" stroke-width="1.5"${dasharray} marker-end="url(#arrowhead)"/>`];
  if (label) {
    parts.push(`  <text x="${midX}" y="${midY - 8}" text-anchor="middle" font-size="10" fill="#666">${escapeXml(label)}</text>`);
  }
  return parts.join('\n');
}

// ---------------------------------------------------------------------------
// buildDocumentSvg — dark-theme SVG with embedded JSON (used for .diagram.svg)
// ---------------------------------------------------------------------------

/**
 * Builds a standalone SVG document for a diagram that:
 *  1. Renders the diagram visually with a dark VS Code–like theme.
 *  2. Embeds the full DiagramDocument JSON in a `<metadata>` element so
 *     DiagramFlow can re-open the SVG without any data loss.
 *
 * This is the primary format for `.diagram.svg` files.
 */
export function buildDocumentSvg(doc: DiagramDocument): string {
  const pad = 40;
  const allPositioned = [
    ...doc.nodes,
    ...(doc.textElements ?? []),
    ...(doc.imageElements ?? []),
  ];

  let minX = Infinity, minY = Infinity, maxRight = -Infinity, maxBottom = -Infinity;
  for (const el of allPositioned) {
    minX = Math.min(minX, el.x);
    minY = Math.min(minY, el.y);
    maxRight = Math.max(maxRight, el.x + el.width);
    maxBottom = Math.max(maxBottom, el.y + el.height);
  }
  if (allPositioned.length === 0) { minX = 0; minY = 0; maxRight = 400; maxBottom = 200; }

  const vbX = minX - pad;
  const vbY = minY - pad;
  const vbW = maxRight - minX + pad * 2;
  const vbH = maxBottom - minY + pad * 2;

  const nodeMap = new Map(doc.nodes.map((n) => [n.id, n]));

  const edgeSvg = buildEdgesSvgDark(doc.edges, nodeMap);
  const nodeSvg = buildNodesSvgDark(doc.nodes);
  const textSvg = buildTextElementsSvg(doc.textElements ?? []);
  const imageSvg = buildImageElementsSvg(doc.imageElements ?? []);

  const jsonData = escapeXml(JSON.stringify(doc));
  const metadataXml = `<metadata><diagramflow:source xmlns:diagramflow="${DIAGRAM_NS}">${jsonData}</diagramflow:source></metadata>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vbX} ${vbY} ${vbW} ${vbH}" width="${vbW}" height="${vbH}">
${metadataXml}
<rect x="${vbX}" y="${vbY}" width="${vbW}" height="${vbH}" fill="#1e1e1e"/>
<defs>
  <marker id="arrow-normal" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="#888"/></marker>
  <marker id="arrow-open" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polyline points="0 0, 10 3.5, 0 7" fill="none" stroke="#888" stroke-width="1.5"/></marker>
</defs>
<g id="edge-layer">${edgeSvg}</g>
<g id="node-layer">${nodeSvg}</g>
<g id="text-layer">${textSvg}</g>
<g id="image-layer">${imageSvg}</g>
</svg>`;
}

function buildEdgesSvgDark(
  edges: DiagramDocument['edges'],
  nodeMap: Map<string, DiagramDocument['nodes'][number]>,
): string {
  return edges.map((edge) => {
    const src = nodeMap.get(edge.source);
    const tgt = nodeMap.get(edge.target);
    if (!src || !tgt) return '';

    const x1 = src.x + src.width / 2;
    const y1 = src.y + src.height / 2;
    const x2 = tgt.x + tgt.width / 2;
    const y2 = tgt.y + tgt.height / 2;
    const dash = edge.style === 'dashed' ? ' stroke-dasharray="8,4"' : edge.style === 'dotted' ? ' stroke-dasharray="2,4"' : '';
    const marker = (edge.arrow === 'normal' || edge.arrow === 'arrow')
      ? ' marker-end="url(#arrow-normal)"'
      : edge.arrow === 'open' ? ' marker-end="url(#arrow-open)"' : '';

    let svg = `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#888" stroke-width="2"${dash}${marker}/>`;
    if (edge.label) {
      svg += `<text x="${(x1 + x2) / 2}" y="${(y1 + y2) / 2 - 6}" text-anchor="middle" fill="#aaa" font-size="11">${escapeXml(edge.label)}</text>`;
    }
    return svg;
  }).join('\n');
}

function buildNodesSvgDark(nodes: DiagramDocument['nodes']): string {
  return nodes.map((node) => {
    const colors = NODE_FILL_COLORS[node.color] ?? NODE_FILL_COLORS.default;
    const shape = renderDarkNodeShape(node, colors);
    const label = `<text x="${node.width / 2}" y="${node.height / 2 + 1}" text-anchor="middle" dominant-baseline="middle" fill="${colors.text}" font-size="13">${escapeXml(node.label)}</text>`;
    return `<g transform="translate(${node.x},${node.y})">${shape}${label}</g>`;
  }).join('\n');
}

function renderDarkNodeShape(
  node: DiagramDocument['nodes'][number],
  colors: { fill: string; stroke: string },
): string {
  const { width: w, height: h } = node;
  switch (node.shape) {
    case 'diamond': {
      const cx = w / 2, cy = h / 2;
      return `<polygon points="${cx},0 ${w},${cy} ${cx},${h} 0,${cy}" fill="${colors.fill}" stroke="${colors.stroke}" stroke-width="2"/>`;
    }
    case 'rounded':
      return `<rect width="${w}" height="${h}" rx="12" ry="12" fill="${colors.fill}" stroke="${colors.stroke}" stroke-width="2"/>`;
    case 'cylinder':
      return `<rect width="${w}" height="${h}" rx="10" ry="10" fill="${colors.fill}" stroke="${colors.stroke}" stroke-width="2"/>`;
    case 'note':
      return `<rect width="${w}" height="${h}" rx="4" ry="4" fill="#3a3a1a" stroke="#c8a840" stroke-width="2" stroke-dasharray="4,3"/>`;
    default:
      return `<rect width="${w}" height="${h}" rx="4" ry="4" fill="${colors.fill}" stroke="${colors.stroke}" stroke-width="2"/>`;
  }
}

function buildTextElementsSvg(textElements: TextElement[]): string {
  return textElements.map((el) => {
    const fontSize = el.fontSize ?? 14;
    const color = el.color ?? '#ccc';
    const weight = el.bold ? 'font-weight="bold"' : '';
    const style = el.italic ? 'font-style="italic"' : '';
    const text = `<text x="${el.x}" y="${el.y + fontSize}" font-size="${fontSize}" fill="${color}" ${weight} ${style}>${escapeXml(el.content)}</text>`;
    if (el.href) {
      return `<a href="${escapeXml(el.href)}">${text}</a>`;
    }
    return text;
  }).join('\n');
}

function buildImageElementsSvg(imageElements: ImageElement[]): string {
  return imageElements.map((el) => {
    const imageTag = `<image x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" href="${escapeXml(el.src)}"${el.description ? ` aria-label="${escapeXml(el.description)}"` : ''}/>`;
    if (el.href) {
      return `<a href="${escapeXml(el.href)}">${imageTag}</a>`;
    }
    return imageTag;
  }).join('\n');
}
