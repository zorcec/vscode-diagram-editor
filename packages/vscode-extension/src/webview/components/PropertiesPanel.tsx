import { useCallback, useEffect, useState } from 'react';
import type { Node, Edge } from '@xyflow/react';
import type { DiagramNodeData } from '../lib/docToFlow';
import type {
  DiagramGroup,
  NodeShape,
  NodeColor,
  EdgeStyle,
  ArrowType,
  NodeType,
  SecurityClassification,
  DeploymentEnvironment,
  NodeProperties,
} from '../../types/DiagramDocument';
import {
  NODE_SHAPES,
  NODE_COLORS,
  EDGE_STYLES,
  ARROW_TYPES,
  NODE_TYPES,
  SECURITY_CLASSIFICATIONS,
  DEPLOYMENT_ENVIRONMENTS,
} from '../../types/DiagramDocument';

interface NodeProps {
  kind: 'node';
  node: Node<DiagramNodeData>;
  groups: DiagramGroup[];
  onUpdateNode: (
    id: string,
    changes: {
      label?: string;
      shape?: NodeShape;
      color?: NodeColor;
      notes?: string;
      group?: string | null;
      pinned?: boolean;
      type?: NodeType;
      tags?: string[];
      properties?: NodeProperties;
      securityClassification?: SecurityClassification;
      deploymentEnvironment?: DeploymentEnvironment;
    },
  ) => void;
}

interface EdgeProps {
  kind: 'edge';
  edge: Edge;
  onUpdateEdge: (
    id: string,
    changes: { label?: string; style?: EdgeStyle; arrow?: ArrowType; animated?: boolean; protocol?: string; dataTypes?: string[] },
  ) => void;
}

interface GroupProps {
  kind: 'group';
  group: DiagramGroup;
  onUpdateGroup: (id: string, changes: { label?: string; color?: NodeColor }) => void;
}

interface TextElementProps {
  kind: 'textElement';
  id: string;
  element: Record<string, unknown>;
  onUpdateTextElement: (id: string, changes: {
    content?: string; fontSize?: number; color?: string; bold?: boolean; italic?: boolean; href?: string; pinned?: boolean;
  }) => void;
}

interface ImageElementProps {
  kind: 'imageElement';
  id: string;
  element: Record<string, unknown>;
  onUpdateImageElement: (id: string, changes: {
    src?: string; description?: string; href?: string; pinned?: boolean;
  }) => void;
}

interface EmptyProps { kind: 'none' }

export type PropertiesPanelInput = NodeProps | EdgeProps | GroupProps | TextElementProps | ImageElementProps | EmptyProps;

const NODE_TYPE_LABELS: Record<NodeType, string> = {
  Person: 'Person',
  ExternalSystem: 'External System',
  Container: 'Container',
  Service: 'Service',
  Database: 'Database',
  MessageQueue: 'Message Queue',
  Cache: 'Cache',
  Function: 'Function',
};

const SECURITY_LABELS: Record<SecurityClassification, string> = {
  'public': 'Public',
  'internal': 'Internal',
  'pii-data-store': 'PII Data Store',
  'security-boundary': 'Security Boundary',
};

const DEPLOYMENT_LABELS: Record<DeploymentEnvironment, string> = {
  production: 'Production',
  staging: 'Staging',
  development: 'Development',
  all: 'All',
};

const SHAPE_LABELS: Record<NodeShape, string> = {
  rectangle: 'Rectangle',
  rounded: 'Rounded',
  diamond: 'Diamond',
  cylinder: 'Cylinder',
  note: 'Note',
};

const COLOR_LABELS: Record<NodeColor, string> = {
  default: 'Default',
  blue: 'Blue',
  green: 'Green',
  red: 'Red',
  yellow: 'Yellow',
  purple: 'Purple',
  gray: 'Gray',
};

const STYLE_LABELS: Record<EdgeStyle, string> = {
  solid: 'Solid',
  dashed: 'Dashed',
  dotted: 'Dotted',
};

const ARROW_LABELS: Record<ArrowType, string> = {
  normal: 'Arrow',
  arrow: 'Arrow (alt)',
  open: 'Open',
  none: 'None',
};

export function PropertiesPanel(props: PropertiesPanelInput) {
  if (props.kind === 'none') {
    return (
      <aside className="properties-panel properties-panel--empty" data-testid="properties-panel">
        <p className="properties-panel__hint">Select a node or edge to edit its properties.</p>
      </aside>
    );
  }

  if (props.kind === 'node') {
    return <NodePropertiesPanel {...props} />;
  }

  if (props.kind === 'group') {
    return <GroupPropertiesPanel {...props} />;
  }

  if (props.kind === 'textElement') {
    return <TextElementPropertiesPanel {...props} />;
  }

  if (props.kind === 'imageElement') {
    return <ImageElementPropertiesPanel {...props} />;
  }

  return <EdgePropertiesPanel {...props} />;
}

// ---------------------------------------------------------------------------
// Node Properties
// ---------------------------------------------------------------------------

function NodePropertiesPanel({ node, groups, onUpdateNode }: NodeProps) {
  const [label, setLabel] = useState(node.data.label);
  const [notes, setNotes] = useState(node.data.notes ?? '');
  const [tags, setTags] = useState((node.data as Record<string, unknown>).tags as string[] ?? []);
  const [tagsInput, setTagsInput] = useState(tags.join(', '));
  const [repo, setRepo] = useState(((node.data as Record<string, unknown>).properties as NodeProperties)?.repo ?? '');
  const [team, setTeam] = useState(((node.data as Record<string, unknown>).properties as NodeProperties)?.team ?? '');
  const [adr, setAdr] = useState(((node.data as Record<string, unknown>).properties as NodeProperties)?.adr ?? '');
  const [status, setStatus] = useState(((node.data as Record<string, unknown>).properties as NodeProperties)?.status ?? '');
  const [technicalDebt, setTechnicalDebt] = useState(((node.data as Record<string, unknown>).properties as NodeProperties)?.technicalDebt ?? '');

  // Sync when a different node is selected.
  useEffect(() => {
    setLabel(node.data.label);
    setNotes(node.data.notes ?? '');
    const nodeTags = (node.data as Record<string, unknown>).tags as string[] ?? [];
    setTags(nodeTags);
    setTagsInput(nodeTags.join(', '));
    const props = (node.data as Record<string, unknown>).properties as NodeProperties | undefined;
    setRepo(props?.repo ?? '');
    setTeam(props?.team ?? '');
    setAdr(props?.adr ?? '');
    setStatus(props?.status ?? '');
    setTechnicalDebt(props?.technicalDebt ?? '');
  }, [node.id, node.data.label, node.data.notes, node.data]);

  const commitLabel = useCallback(() => {
    const trimmed = label.trim();
    if (trimmed && trimmed !== node.data.label) {
      onUpdateNode(node.id, { label: trimmed });
    }
  }, [node.id, node.data.label, label, onUpdateNode]);

  const commitNotes = useCallback(() => {
    if (notes !== (node.data.notes ?? '')) {
      onUpdateNode(node.id, { notes: notes.trim() || undefined });
    }
  }, [node.id, node.data.notes, notes, onUpdateNode]);

  const currentGroup = (node as any).parentId ?? null;

  const handleGroupChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const value = e.target.value;
      onUpdateNode(node.id, { group: value === '' ? null : value });
    },
    [node.id, onUpdateNode],
  );

  return (
    <aside className="properties-panel" data-testid="properties-panel">
      <h3 className="properties-panel__title">Node Properties</h3>

      <div className="prop-group">
        <label className="prop-label" htmlFor="prop-label">Label</label>
        <input
          id="prop-label"
          className="prop-input"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={commitLabel}
          onKeyDown={(e) => { if (e.key === 'Enter') commitLabel(); }}
          data-testid="prop-node-label"
        />
      </div>

      <div className="prop-group">
        <span className="prop-label">Shape</span>
        <div className="prop-radio-group" data-testid="prop-node-shape">
          {NODE_SHAPES.map((s) => (
            <button
              key={s}
              className={`prop-chip${node.data.shape === s ? ' prop-chip--active' : ''}`}
              onClick={() => onUpdateNode(node.id, { shape: s })}
              title={SHAPE_LABELS[s]}
              data-testid={`prop-shape-${s}`}
            >
              {SHAPE_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      <div className="prop-group">
        <span className="prop-label">Color</span>
        <div className="prop-color-grid" data-testid="prop-node-color">
          {NODE_COLORS.map((c) => (
            <button
              key={c}
              className={`prop-color-swatch color-swatch--${c}${node.data.color === c ? ' prop-color-swatch--active' : ''}`}
              onClick={() => onUpdateNode(node.id, { color: c })}
              title={COLOR_LABELS[c]}
              data-testid={`prop-color-${c}`}
              aria-label={COLOR_LABELS[c]}
            />
          ))}
        </div>
      </div>

      {groups.length > 0 && (
        <div className="prop-group">
          <label className="prop-label" htmlFor="prop-node-group">Group</label>
          <select
            id="prop-node-group"
            className="prop-select"
            value={currentGroup ?? ''}
            onChange={handleGroupChange}
            data-testid="prop-node-group"
          >
            <option value="">(none)</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="prop-group">
        <label className="prop-label" htmlFor="prop-notes">Notes</label>
        <textarea
          id="prop-notes"
          className="prop-textarea"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={commitNotes}
          rows={4}
          placeholder="Optional notes for this node…"
          data-testid="prop-node-notes"
        />
      </div>

      <div className="prop-group prop-group--row">
        <label className="prop-label" htmlFor="prop-node-pinned">Pinned (lock position)</label>
        <input
          id="prop-node-pinned"
          type="checkbox"
          className="prop-checkbox"
          checked={node.data.pinned ?? false}
          onChange={(e) => onUpdateNode(node.id, { pinned: e.target.checked })}
          title="When pinned, auto-layout won't move this node"
          data-testid="prop-node-pinned"
        />
      </div>

      {/* LLM Metadata Section */}
      <div className="prop-divider" />
      <h4 className="properties-panel__subtitle">Metadata (LLM)</h4>

      <div className="prop-group">
        <label className="prop-label" htmlFor="prop-node-type">Component Type</label>
        <select
          id="prop-node-type"
          className="prop-select"
          value={((node.data as Record<string, unknown>).type as string) ?? ''}
          onChange={(e) => onUpdateNode(node.id, { type: (e.target.value || undefined) as NodeType | undefined })}
          data-testid="prop-node-type"
        >
          <option value="">(none)</option>
          {NODE_TYPES.map((t) => (
            <option key={t} value={t}>
              {NODE_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </div>

      <div className="prop-group">
        <label className="prop-label" htmlFor="prop-node-tags">Tags</label>
        <input
          id="prop-node-tags"
          className="prop-input"
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          onBlur={() => {
            const parsed = tagsInput
              .split(',')
              .map((t) => t.trim())
              .filter(Boolean);
            setTags(parsed);
            onUpdateNode(node.id, { tags: parsed.length > 0 ? parsed : undefined });
          }}
          placeholder="e.g. deprecated, external-facing"
          data-testid="prop-node-tags"
        />
      </div>

      <div className="prop-group">
        <label className="prop-label" htmlFor="prop-node-security">Security</label>
        <select
          id="prop-node-security"
          className="prop-select"
          value={((node.data as Record<string, unknown>).securityClassification as string) ?? ''}
          onChange={(e) =>
            onUpdateNode(node.id, {
              securityClassification: (e.target.value || undefined) as SecurityClassification | undefined,
            })
          }
          data-testid="prop-node-security"
        >
          <option value="">(none)</option>
          {SECURITY_CLASSIFICATIONS.map((s) => (
            <option key={s} value={s}>
              {SECURITY_LABELS[s]}
            </option>
          ))}
        </select>
      </div>

      <div className="prop-group">
        <label className="prop-label" htmlFor="prop-node-env">Environment</label>
        <select
          id="prop-node-env"
          className="prop-select"
          value={((node.data as Record<string, unknown>).deploymentEnvironment as string) ?? ''}
          onChange={(e) =>
            onUpdateNode(node.id, {
              deploymentEnvironment: (e.target.value || undefined) as DeploymentEnvironment | undefined,
            })
          }
          data-testid="prop-node-env"
        >
          <option value="">(none)</option>
          {DEPLOYMENT_ENVIRONMENTS.map((env) => (
            <option key={env} value={env}>
              {DEPLOYMENT_LABELS[env]}
            </option>
          ))}
        </select>
      </div>

      <div className="prop-group">
        <label className="prop-label" htmlFor="prop-node-repo">Repository</label>
        <input
          id="prop-node-repo"
          className="prop-input"
          value={repo}
          onChange={(e) => setRepo(e.target.value)}
          onBlur={() => onUpdateNode(node.id, { properties: { ...((node.data as Record<string, unknown>).properties as NodeProperties), repo: repo.trim() || undefined } })}
          placeholder="github.com/org/repo"
          data-testid="prop-node-repo"
        />
      </div>

      <div className="prop-group">
        <label className="prop-label" htmlFor="prop-node-team">Team</label>
        <input
          id="prop-node-team"
          className="prop-input"
          value={team}
          onChange={(e) => setTeam(e.target.value)}
          onBlur={() => onUpdateNode(node.id, { properties: { ...((node.data as Record<string, unknown>).properties as NodeProperties), team: team.trim() || undefined } })}
          placeholder="Owning team"
          data-testid="prop-node-team"
        />
      </div>

      <div className="prop-group">
        <label className="prop-label" htmlFor="prop-node-adr">ADR</label>
        <input
          id="prop-node-adr"
          className="prop-input"
          value={adr}
          onChange={(e) => setAdr(e.target.value)}
          onBlur={() => onUpdateNode(node.id, { properties: { ...((node.data as Record<string, unknown>).properties as NodeProperties), adr: adr.trim() || undefined } })}
          placeholder="Path to architecture decision record"
          data-testid="prop-node-adr"
        />
      </div>

      <div className="prop-group">
        <label className="prop-label" htmlFor="prop-node-status">Status</label>
        <input
          id="prop-node-status"
          className="prop-input"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          onBlur={() => onUpdateNode(node.id, { properties: { ...((node.data as Record<string, unknown>).properties as NodeProperties), status: status.trim() || undefined } })}
          placeholder="active, deprecated, being-replaced-by:..."
          data-testid="prop-node-status"
        />
      </div>

      <div className="prop-group">
        <label className="prop-label" htmlFor="prop-node-debt">Technical Debt</label>
        <textarea
          id="prop-node-debt"
          className="prop-textarea"
          value={technicalDebt}
          onChange={(e) => setTechnicalDebt(e.target.value)}
          onBlur={() => onUpdateNode(node.id, { properties: { ...((node.data as Record<string, unknown>).properties as NodeProperties), technicalDebt: technicalDebt.trim() || undefined } })}
          rows={2}
          placeholder="Known issues or debt (JIRA ref)…"
          data-testid="prop-node-debt"
        />
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Text Element Properties
// ---------------------------------------------------------------------------

function TextElementPropertiesPanel({ id, element, onUpdateTextElement }: TextElementProps) {
  const [content, setContent] = useState(String(element.content ?? ''));
  const [href, setHref] = useState(String(element.href ?? ''));
  const [color, setColor] = useState(String(element.color ?? ''));
  const [fontSize, setFontSize] = useState(Number(element.fontSize ?? 14));
  const [bold, setBold] = useState(Boolean(element.bold));
  const [italic, setItalic] = useState(Boolean(element.italic));

  useEffect(() => {
    setContent(String(element.content ?? ''));
    setHref(String(element.href ?? ''));
    setColor(String(element.color ?? ''));
    setFontSize(Number(element.fontSize ?? 14));
    setBold(Boolean(element.bold));
    setItalic(Boolean(element.italic));
  }, [id, element.content, element.href, element.color, element.fontSize, element.bold, element.italic]);

  return (
    <aside className="properties-panel" data-testid="properties-panel">
      <h3 className="properties-panel__title">Text Properties</h3>

      <div className="prop-group">
        <label className="prop-label" htmlFor="prop-text-content">Content</label>
        <textarea
          id="prop-text-content"
          className="prop-textarea"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onBlur={() => onUpdateTextElement(id, { content })}
          rows={3}
          data-testid="prop-text-content"
        />
      </div>

      <div className="prop-group">
        <label className="prop-label" htmlFor="prop-text-font-size">Font Size</label>
        <input
          id="prop-text-font-size"
          type="number"
          className="prop-input"
          value={fontSize}
          min={8}
          max={72}
          onChange={(e) => setFontSize(Number(e.target.value))}
          onBlur={() => onUpdateTextElement(id, { fontSize })}
          data-testid="prop-text-font-size"
        />
      </div>

      <div className="prop-group">
        <label className="prop-label" htmlFor="prop-text-color">Color</label>
        <input
          id="prop-text-color"
          className="prop-input"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          onBlur={() => onUpdateTextElement(id, { color: color || undefined })}
          placeholder="#fff or CSS color"
          data-testid="prop-text-color"
        />
      </div>

      <div className="prop-group prop-group--row">
        <label className="prop-label" htmlFor="prop-text-bold">Bold</label>
        <input
          id="prop-text-bold"
          type="checkbox"
          className="prop-checkbox"
          checked={bold}
          onChange={(e) => { setBold(e.target.checked); onUpdateTextElement(id, { bold: e.target.checked }); }}
          data-testid="prop-text-bold"
        />
      </div>

      <div className="prop-group prop-group--row">
        <label className="prop-label" htmlFor="prop-text-italic">Italic</label>
        <input
          id="prop-text-italic"
          type="checkbox"
          className="prop-checkbox"
          checked={italic}
          onChange={(e) => { setItalic(e.target.checked); onUpdateTextElement(id, { italic: e.target.checked }); }}
          data-testid="prop-text-italic"
        />
      </div>

      <div className="prop-group">
        <label className="prop-label" htmlFor="prop-text-href">Link URL</label>
        <input
          id="prop-text-href"
          className="prop-input"
          value={href}
          onChange={(e) => setHref(e.target.value)}
          onBlur={() => onUpdateTextElement(id, { href: href.trim() || undefined })}
          placeholder="https://..."
          data-testid="prop-text-href"
        />
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Image Element Properties
// ---------------------------------------------------------------------------

function ImageElementPropertiesPanel({ id, element, onUpdateImageElement }: ImageElementProps) {
  const [src, setSrc] = useState(String(element.src ?? ''));
  const [description, setDescription] = useState(String(element.description ?? ''));
  const [href, setHref] = useState(String(element.href ?? ''));

  useEffect(() => {
    setSrc(String(element.src ?? ''));
    setDescription(String(element.description ?? ''));
    setHref(String(element.href ?? ''));
  }, [id, element.src, element.description, element.href]);

  return (
    <aside className="properties-panel" data-testid="properties-panel">
      <h3 className="properties-panel__title">Image Properties</h3>

      <div className="prop-group">
        <label className="prop-label" htmlFor="prop-image-src">Image URL</label>
        <input
          id="prop-image-src"
          className="prop-input"
          value={src}
          onChange={(e) => setSrc(e.target.value)}
          onBlur={() => onUpdateImageElement(id, { src })}
          placeholder="https://... or data:"
          data-testid="prop-image-src"
        />
      </div>

      <div className="prop-group">
        <label className="prop-label" htmlFor="prop-image-description">Description</label>
        <textarea
          id="prop-image-description"
          className="prop-textarea"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={() => onUpdateImageElement(id, { description: description.trim() || undefined })}
          rows={3}
          placeholder="Describe this image for context..."
          data-testid="prop-image-description"
        />
      </div>

      <div className="prop-group">
        <label className="prop-label" htmlFor="prop-image-href">Link URL</label>
        <input
          id="prop-image-href"
          className="prop-input"
          value={href}
          onChange={(e) => setHref(e.target.value)}
          onBlur={() => onUpdateImageElement(id, { href: href.trim() || undefined })}
          placeholder="https://..."
          data-testid="prop-image-href"
        />
      </div>
    </aside>
  );
}

function GroupPropertiesPanel({ group, onUpdateGroup }: GroupProps) {
  const [label, setLabel] = useState(group.label);

  useEffect(() => {
    setLabel(group.label);
  }, [group.id, group.label]);

  const commitLabel = useCallback(() => {
    const trimmed = label.trim();
    if (trimmed && trimmed !== group.label) {
      onUpdateGroup(group.id, { label: trimmed });
    }
  }, [group.id, group.label, label, onUpdateGroup]);

  return (
    <aside className="properties-panel" data-testid="properties-panel">
      <h3 className="properties-panel__title">Group Properties</h3>

      <div className="prop-group">
        <label className="prop-label" htmlFor="prop-group-label">Label</label>
        <input
          id="prop-group-label"
          className="prop-input"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={commitLabel}
          onKeyDown={(e) => { if (e.key === 'Enter') commitLabel(); }}
          data-testid="prop-group-label"
        />
      </div>

      <div className="prop-group">
        <span className="prop-label">Color</span>
        <div className="prop-color-grid" data-testid="prop-group-color">
          {NODE_COLORS.map((c) => (
            <button
              key={c}
              className={`prop-color-swatch color-swatch--${c}${(group.color ?? 'default') === c ? ' prop-color-swatch--active' : ''}`}
              onClick={() => onUpdateGroup(group.id, { color: c })}
              title={COLOR_LABELS[c]}
              data-testid={`prop-group-color-${c}`}
              aria-label={COLOR_LABELS[c]}
            />
          ))}
        </div>
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Edge Properties
// ---------------------------------------------------------------------------

function EdgePropertiesPanel({ edge, onUpdateEdge }: EdgeProps) {
  const data = edge.data as { style?: EdgeStyle; arrow?: ArrowType; protocol?: string; dataTypes?: string[] } | undefined;
  const [label, setLabel] = useState(String(edge.label ?? ''));
  const [animated, setAnimated] = useState(edge.animated ?? false);
  const [edgeProtocol, setEdgeProtocol] = useState(data?.protocol ?? '');
  const [dataTypesInput, setDataTypesInput] = useState((data?.dataTypes ?? []).join(', '));

  useEffect(() => {
    setLabel(String(edge.label ?? ''));
    setAnimated(edge.animated ?? false);
    const d = edge.data as { protocol?: string; dataTypes?: string[] } | undefined;
    setEdgeProtocol(d?.protocol ?? '');
    setDataTypesInput((d?.dataTypes ?? []).join(', '));
  }, [edge.id, edge.label, edge.animated, edge.data]);

  const commitLabel = useCallback(() => {
    const trimmed = label.trim();
    if (trimmed !== String(edge.label ?? '').trim()) {
      onUpdateEdge(edge.id, { label: trimmed || undefined });
    }
  }, [edge.id, edge.label, label, onUpdateEdge]);

  const toggleAnimated = useCallback(() => {
    const next = !animated;
    setAnimated(next);
    onUpdateEdge(edge.id, { animated: next });
  }, [edge.id, animated, onUpdateEdge]);

  return (
    <aside className="properties-panel" data-testid="properties-panel">
      <h3 className="properties-panel__title">Edge Properties</h3>

      <div className="prop-group">
        <label className="prop-label" htmlFor="prop-edge-label">Label</label>
        <input
          id="prop-edge-label"
          className="prop-input"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={commitLabel}
          onKeyDown={(e) => { if (e.key === 'Enter') commitLabel(); }}
          data-testid="prop-edge-label"
        />
      </div>

      <div className="prop-group">
        <span className="prop-label">Line Style</span>
        <div className="prop-radio-group" data-testid="prop-edge-style">
          {EDGE_STYLES.map((s) => (
            <button
              key={s}
              className={`prop-chip${data?.style === s ? ' prop-chip--active' : ''}`}
              onClick={() => onUpdateEdge(edge.id, { style: s })}
              data-testid={`prop-style-${s}`}
            >
              {STYLE_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      <div className="prop-group">
        <span className="prop-label">Arrow</span>
        <div className="prop-radio-group" data-testid="prop-edge-arrow">
          {ARROW_TYPES.map((a) => (
            <button
              key={a}
              className={`prop-chip${data?.arrow === a ? ' prop-chip--active' : ''}`}
              onClick={() => onUpdateEdge(edge.id, { arrow: a })}
              data-testid={`prop-arrow-${a}`}
            >
              {ARROW_LABELS[a]}
            </button>
          ))}
        </div>
      </div>

      <div className="prop-group prop-group--row">
        <label className="prop-label" htmlFor="prop-edge-animated">Animated</label>
        <input
          id="prop-edge-animated"
          type="checkbox"
          className="prop-checkbox"
          checked={animated}
          onChange={toggleAnimated}
          data-testid="prop-edge-animated"
        />
      </div>

      {/* LLM Metadata Section */}
      <div className="prop-divider" />
      <h4 className="properties-panel__subtitle">Metadata (LLM)</h4>

      <div className="prop-group">
        <label className="prop-label" htmlFor="prop-edge-protocol">Protocol</label>
        <input
          id="prop-edge-protocol"
          className="prop-input"
          value={edgeProtocol}
          onChange={(e) => setEdgeProtocol(e.target.value)}
          onBlur={() => {
            const val = edgeProtocol.trim() || undefined;
            onUpdateEdge(edge.id, { protocol: val });
          }}
          placeholder="REST, gRPC, Kafka, WebSocket…"
          data-testid="prop-edge-protocol"
        />
      </div>

      <div className="prop-group">
        <label className="prop-label" htmlFor="prop-edge-data-types">Data Types</label>
        <input
          id="prop-edge-data-types"
          className="prop-input"
          value={dataTypesInput}
          onChange={(e) => setDataTypesInput(e.target.value)}
          onBlur={() => {
            const parsed = dataTypesInput
              .split(',')
              .map((t) => t.trim())
              .filter(Boolean);
            onUpdateEdge(edge.id, { dataTypes: parsed.length > 0 ? parsed : undefined });
          }}
          placeholder="OrderDTO, CustomerPII…"
          data-testid="prop-edge-data-types"
        />
      </div>
    </aside>
  );
}
