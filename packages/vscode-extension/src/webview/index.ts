import './index.css';
import type {
  DiagramDocument,
  DiagramNode,
  DiagramEdge,
  EdgeStyle,
  NodeColor,
  NodeShape,
} from '../types/DiagramDocument';

declare function acquireVsCodeApi(): {
  postMessage(msg: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
};

const vscode = acquireVsCodeApi();

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DIAGRAM_NS = 'https://diagramflow.vscode/schema';

const NODE_COLORS: Record<NodeColor, { fill: string; stroke: string; text: string }> = {
  default: { fill: '#2d2d2d', stroke: '#555', text: '#ccc' },
  blue: { fill: '#1e3a5f', stroke: '#4a90d9', text: '#90c4f9' },
  green: { fill: '#1a3a1a', stroke: '#4a9a4a', text: '#90d490' },
  red: { fill: '#3a1a1a', stroke: '#c84040', text: '#f09090' },
  yellow: { fill: '#3a3a1a', stroke: '#c8a840', text: '#f0d490' },
  purple: { fill: '#2a1a3a', stroke: '#8040c8', text: '#c090f0' },
  gray: { fill: '#333', stroke: '#666', text: '#aaa' },
};

const DASH_MAP: Record<EdgeStyle, string> = {
  solid: 'none',
  dashed: '8,4',
  dotted: '2,4',
};

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let currentDoc: DiagramDocument | null = null;
let dragState: {
  nodeId: string;
  startX: number;
  startY: number;
  mouseX: number;
  mouseY: number;
} | null = null;

// ---------------------------------------------------------------------------
// SVG helpers
// ---------------------------------------------------------------------------

function svgEl(tag: string): SVGElement {
  return document.createElementNS('http://www.w3.org/2000/svg', tag);
}

function buildArrowMarkers(): SVGDefsElement {
  const defs = svgEl('defs') as SVGDefsElement;
  defs.innerHTML = `
    <marker id="arrow-normal" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
      <polygon points="0 0, 10 3.5, 0 7" fill="#888" />
    </marker>
    <marker id="arrow-open" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
      <polyline points="0 0, 10 3.5, 0 7" fill="none" stroke="#888" stroke-width="1.5" />
    </marker>
  `;
  return defs;
}

function buildNodeShape(
  node: DiagramNode,
  colors: { fill: string; stroke: string },
): SVGElement {
  const shapeMap: Record<NodeShape, () => SVGElement> = {
    diamond: () => {
      const cx = node.width / 2;
      const cy = node.height / 2;
      const el = svgEl('polygon') as SVGPolygonElement;
      el.setAttribute('points', `${cx},0 ${node.width},${cy} ${cx},${node.height} 0,${cy}`);
      return el;
    },
    cylinder: () => {
      const el = svgEl('rect') as SVGRectElement;
      el.setAttribute('width', String(node.width));
      el.setAttribute('height', String(node.height));
      el.setAttribute('rx', '10');
      el.setAttribute('ry', '10');
      return el;
    },
    rounded: () => {
      const el = svgEl('rect') as SVGRectElement;
      el.setAttribute('width', String(node.width));
      el.setAttribute('height', String(node.height));
      el.setAttribute('rx', '12');
      el.setAttribute('ry', '12');
      return el;
    },
    rectangle: () => {
      const el = svgEl('rect') as SVGRectElement;
      el.setAttribute('width', String(node.width));
      el.setAttribute('height', String(node.height));
      el.setAttribute('rx', '4');
      el.setAttribute('ry', '4');
      return el;
    },
  };

  const shape = (shapeMap[node.shape] ?? shapeMap.rectangle)();
  shape.setAttribute('fill', colors.fill);
  shape.setAttribute('stroke', colors.stroke);
  shape.setAttribute('stroke-width', '2');
  return shape;
}

function buildNodeGroup(node: DiagramNode): SVGGElement {
  const colors = NODE_COLORS[node.color] ?? NODE_COLORS.default;
  const g = svgEl('g') as SVGGElement;
  g.setAttribute('class', 'diagram-node');
  g.setAttribute('data-id', node.id);
  g.setAttribute('data-testid', `node-${node.id}`);
  g.setAttribute('transform', `translate(${node.x},${node.y})`);

  g.appendChild(buildNodeShape(node, colors));

  const text = svgEl('text');
  text.setAttribute('x', String(node.width / 2));
  text.setAttribute('y', String(node.height / 2 + 1));
  text.setAttribute('text-anchor', 'middle');
  text.setAttribute('dominant-baseline', 'middle');
  text.setAttribute('fill', colors.text);
  text.setAttribute('font-size', '13');
  text.setAttribute('font-family', 'var(--vscode-font-family, sans-serif)');
  text.setAttribute('pointer-events', 'none');
  text.textContent = node.label;
  g.appendChild(text);

  g.addEventListener('mousedown', (e) => startDrag(e as MouseEvent, node.id));
  return g;
}

function buildEdge(
  edge: DiagramEdge,
  nodeMap: Map<string, DiagramNode>,
): SVGGElement | null {
  const src = nodeMap.get(edge.source);
  const tgt = nodeMap.get(edge.target);
  if (!src || !tgt) return null;

  const x1 = src.x + src.width / 2;
  const y1 = src.y + src.height / 2;
  const x2 = tgt.x + tgt.width / 2;
  const y2 = tgt.y + tgt.height / 2;

  const g = svgEl('g') as SVGGElement;
  g.setAttribute('data-testid', `edge-${edge.id}`);

  const line = svgEl('line') as SVGLineElement;
  line.setAttribute('x1', String(x1));
  line.setAttribute('y1', String(y1));
  line.setAttribute('x2', String(x2));
  line.setAttribute('y2', String(y2));
  line.setAttribute('stroke', '#888');
  line.setAttribute('stroke-width', '2');
  line.setAttribute('stroke-dasharray', DASH_MAP[edge.style] ?? 'none');

  if (edge.arrow === 'normal' || edge.arrow === 'arrow') {
    line.setAttribute('marker-end', 'url(#arrow-normal)');
  } else if (edge.arrow === 'open') {
    line.setAttribute('marker-end', 'url(#arrow-open)');
  }

  g.appendChild(line);

  if (edge.label) {
    const label = svgEl('text');
    label.setAttribute('x', String((x1 + x2) / 2));
    label.setAttribute('y', String((y1 + y2) / 2 - 6));
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('fill', '#aaa');
    label.setAttribute('font-size', '11');
    label.setAttribute('font-family', 'var(--vscode-font-family, sans-serif)');
    label.textContent = edge.label;
    g.appendChild(label);
  }

  return g;
}

function computeViewBox(nodes: DiagramNode[]): string {
  if (nodes.length === 0) return '0 0 800 600';
  const pad = 40;
  const minX = Math.min(...nodes.map(n => n.x)) - pad;
  const minY = Math.min(...nodes.map(n => n.y)) - pad;
  const maxRight = Math.max(...nodes.map(n => n.x + n.width)) + pad;
  const maxBottom = Math.max(...nodes.map(n => n.y + n.height)) + pad;
  return `${minX} ${minY} ${maxRight - minX} ${maxBottom - minY}`;
}

function renderDiagram(doc: DiagramDocument): void {
  const svg = document.getElementById('diagram-svg') as SVGSVGElement | null;
  if (!svg) return;

  while (svg.firstChild) svg.removeChild(svg.firstChild);

  svg.appendChild(buildArrowMarkers());

  const edgeLayer = svgEl('g') as SVGGElement;
  edgeLayer.setAttribute('id', 'edge-layer');

  const nodeLayer = svgEl('g') as SVGGElement;
  nodeLayer.setAttribute('id', 'node-layer');

  const nodeMap = new Map<string, DiagramNode>(doc.nodes.map(n => [n.id, n]));

  for (const edge of doc.edges) {
    const edgeEl = buildEdge(edge, nodeMap);
    if (edgeEl) edgeLayer.appendChild(edgeEl);
  }

  for (const node of doc.nodes) {
    nodeLayer.appendChild(buildNodeGroup(node));
  }

  svg.appendChild(edgeLayer);
  svg.appendChild(nodeLayer);
  svg.setAttribute('viewBox', computeViewBox(doc.nodes));
}

// ---------------------------------------------------------------------------
// Drag handling
// ---------------------------------------------------------------------------

function startDrag(e: MouseEvent, nodeId: string): void {
  e.preventDefault();
  if (!currentDoc) return;
  const node = currentDoc.nodes.find(n => n.id === nodeId);
  if (!node) return;
  dragState = { nodeId, startX: node.x, startY: node.y, mouseX: e.clientX, mouseY: e.clientY };
}

function onMouseMove(e: MouseEvent): void {
  if (!dragState || !currentDoc) return;
  const dx = e.clientX - dragState.mouseX;
  const dy = e.clientY - dragState.mouseY;
  const node = currentDoc.nodes.find((n) => n.id === dragState!.nodeId);
  if (!node) return;
  node.x = dragState.startX + dx;
  node.y = dragState.startY + dy;
  renderDiagram(currentDoc);
}

function onMouseUp(e: MouseEvent): void {
  if (!dragState || !currentDoc) return;
  const dx = e.clientX - dragState.mouseX;
  const dy = e.clientY - dragState.mouseY;
  vscode.postMessage({
    type: 'NODE_DRAGGED',
    id: dragState.nodeId,
    position: {
      x: Math.round(dragState.startX + dx),
      y: Math.round(dragState.startY + dy),
    },
  });
  dragState = null;
}

// ---------------------------------------------------------------------------
// Export: SVG with embedded .diagram source metadata
// ---------------------------------------------------------------------------

/**
 * Builds a standalone SVG string from the current diagram, embedding the
 * original .diagram JSON inside a <metadata> element so the file can be
 * re-imported later with full fidelity via "Open SVG".
 */
function buildExportSvg(): string | null {
  const svg = document.getElementById('diagram-svg') as SVGSVGElement | null;
  if (!svg || !currentDoc) return null;

  const clone = svg.cloneNode(true) as SVGSVGElement;

  // Preserve viewBox dimensions explicitly in width/height for standalone viewers
  const vb = svg.getAttribute('viewBox');
  if (vb) {
    const parts = vb.split(' ').map(Number);
    if (parts.length === 4) {
      clone.setAttribute('width', String(parts[2]));
      clone.setAttribute('height', String(parts[3]));
    }
  }

  // Embed diagram source as metadata for round-trip import
  const metadata = document.createElementNS('http://www.w3.org/2000/svg', 'metadata');
  const source = document.createElementNS(DIAGRAM_NS, 'diagramflow:source');
  source.setAttribute('xmlns:diagramflow', DIAGRAM_NS);
  source.textContent = JSON.stringify(currentDoc);
  metadata.appendChild(source);
  clone.insertBefore(metadata, clone.firstChild);

  // Dark background for standalone viewing
  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  bg.setAttribute('width', '100%');
  bg.setAttribute('height', '100%');
  bg.setAttribute('fill', '#1e1e1e');
  clone.insertBefore(bg, metadata.nextSibling);

  return `<?xml version="1.0" encoding="UTF-8"?>\n` + new XMLSerializer().serializeToString(clone);
}

function handleSaveSvg(): void {
  const data = buildExportSvg();
  if (!data) return;
  vscode.postMessage({ type: 'EXPORT', format: 'svg', data });
}

// ---------------------------------------------------------------------------
// Export: PNG (rasterised from SVG via canvas)
// ---------------------------------------------------------------------------

function handleSavePng(): void {
  const svgData = buildExportSvg();
  if (!svgData) return;

  const svg = document.getElementById('diagram-svg') as SVGSVGElement | null;
  if (!svg) return;

  const bbox = svg.getBoundingClientRect();
  const width = Math.max(Math.round(bbox.width), 800);
  const height = Math.max(Math.round(bbox.height), 600);

  const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const img = new Image();

  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) { URL.revokeObjectURL(url); return; }
    ctx.drawImage(img, 0, 0, width, height);
    URL.revokeObjectURL(url);
    // Send only the base64 payload (without the data: prefix)
    const dataUrl = canvas.toDataURL('image/png');
    const base64 = dataUrl.split(',')[1] ?? '';
    vscode.postMessage({ type: 'EXPORT', format: 'png', data: base64 });
  };
  img.onerror = () => URL.revokeObjectURL(url);
  img.src = url;
}

// ---------------------------------------------------------------------------
// Open: request extension to open an SVG file and import its diagram source
// ---------------------------------------------------------------------------

function handleOpenSvg(): void {
  vscode.postMessage({ type: 'OPEN_SVG_REQUEST' });
}

// ---------------------------------------------------------------------------
// Toolbar
// ---------------------------------------------------------------------------

function createToolbarButton(
  id: string,
  label: string,
  title: string,
  onClick: () => void,
): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.id = id;
  btn.textContent = label;
  btn.title = title;
  btn.className = 'toolbar-btn';
  btn.dataset['testid'] = id;
  btn.addEventListener('click', onClick);
  return btn;
}

function buildToolbar(): HTMLElement {
  const toolbar = document.createElement('div');
  toolbar.id = 'toolbar';

  const titleEl = document.createElement('span');
  titleEl.className = 'toolbar-title';
  titleEl.textContent = 'DiagramFlow';
  toolbar.appendChild(titleEl);

  const actions = document.createElement('div');
  actions.className = 'toolbar-actions';
  actions.appendChild(
    createToolbarButton(
      'btn-open-svg',
      '↑ Open SVG',
      'Open an SVG file and import its embedded .diagram source',
      handleOpenSvg,
    ),
  );
  actions.appendChild(
    createToolbarButton(
      'btn-save-svg',
      '↓ Save SVG',
      'Save as SVG with embedded .diagram source for re-import',
      handleSaveSvg,
    ),
  );
  actions.appendChild(
    createToolbarButton(
      'btn-save-png',
      '↓ Save PNG',
      'Save as PNG image',
      handleSavePng,
    ),
  );
  toolbar.appendChild(actions);
  return toolbar;
}

// ---------------------------------------------------------------------------
// Message handling
// ---------------------------------------------------------------------------

window.addEventListener('message', (event: MessageEvent) => {
  const msg = event.data;
  if (msg?.type === 'DOCUMENT_UPDATED') {
    currentDoc = msg.doc as DiagramDocument;
    renderDiagram(currentDoc);
  }
});

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

function initDom(): void {
  const root = document.getElementById('root');
  if (!root) return;

  root.appendChild(buildToolbar());

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg') as SVGSVGElement;
  svg.setAttribute('id', 'diagram-svg');
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  root.appendChild(svg);
}

document.addEventListener('DOMContentLoaded', () => {
  initDom();
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
  vscode.postMessage({ type: 'WEBVIEW_READY' });
});
