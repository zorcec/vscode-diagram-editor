import type { DiagramDocument } from '../types/DiagramDocument';
import {
  NODE_SHAPES,
  NODE_TYPES,
  SECURITY_CLASSIFICATIONS,
  DEPLOYMENT_ENVIRONMENTS,
  EDGE_STYLES,
  ARROW_TYPES,
  NODE_COLORS,
} from '../types/DiagramDocument';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateDiagram(doc: unknown): ValidationResult {
  const errors: string[] = [];

  if (!doc || typeof doc !== 'object') {
    return { valid: false, errors: ['Document must be a non-null object'] };
  }

  const d = doc as Record<string, unknown>;

  validateMeta(d.meta, errors);
  const nodeIds = validateNodes(d.nodes, errors);
  const groupIds = validateGroups(d.groups, errors, nodeIds);
  validateEdges(d.edges, errors, nodeIds);
  validateNodeGroupRefs(d.nodes, errors, groupIds);
  validateViewport(d.viewport, errors);
  validateIdUniqueness(d, errors);

  return { valid: errors.length === 0, errors };
}

function validateMeta(meta: unknown, errors: string[]): void {
  if (!meta || typeof meta !== 'object') {
    errors.push('meta is required and must be an object');
    return;
  }
  const m = meta as Record<string, unknown>;
  if (typeof m.title !== 'string' || m.title.length === 0) {
    errors.push('meta.title is required and must be a non-empty string');
  }
  if (typeof m.created !== 'string' || m.created.length === 0) {
    errors.push('meta.created is required and must be a non-empty string');
  }
  if (typeof m.modified !== 'string' || m.modified.length === 0) {
    errors.push('meta.modified is required and must be a non-empty string');
  }
  if (m.abstractionLevel !== undefined) {
    const validLevels = ['context', 'container', 'component'];
    if (!validLevels.includes(m.abstractionLevel as string)) {
      errors.push(`meta.abstractionLevel must be one of: ${validLevels.join(', ')}`);
    }
  }
  if (m.owners !== undefined) {
    if (!Array.isArray(m.owners) || (m.owners as unknown[]).some((o) => typeof o !== 'string')) {
      errors.push('meta.owners must be an array of strings');
    }
  }
  if (m.glossary !== undefined) {
    if (typeof m.glossary !== 'object' || Array.isArray(m.glossary)) {
      errors.push('meta.glossary must be a plain object');
    } else {
      for (const [k, v] of Object.entries(m.glossary as Record<string, unknown>)) {
        if (typeof v !== 'string') {
          errors.push(`meta.glossary["${k}"] must be a string`);
        }
      }
    }
  }
}

function validateNodes(
  nodes: unknown,
  errors: string[],
): Set<string> {
  const ids = new Set<string>();
  if (!Array.isArray(nodes)) {
    errors.push('nodes must be an array');
    return ids;
  }

  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    const prefix = `nodes[${i}]`;

    if (!n || typeof n !== 'object') {
      errors.push(`${prefix} must be an object`);
      continue;
    }

    if (typeof n.id !== 'string' || n.id.length === 0) {
      errors.push(`${prefix}.id is required`);
    } else {
      ids.add(n.id);
    }

    if (typeof n.label !== 'string') {
      errors.push(`${prefix}.label must be a string`);
    }

    if (typeof n.x !== 'number') {
      errors.push(`${prefix}.x must be a number`);
    }
    if (typeof n.y !== 'number') {
      errors.push(`${prefix}.y must be a number`);
    }

    if (typeof n.width !== 'number' || n.width <= 0) {
      errors.push(`${prefix}.width must be a positive number`);
    }
    if (typeof n.height !== 'number' || n.height <= 0) {
      errors.push(`${prefix}.height must be a positive number`);
    }

    if (!NODE_SHAPES.includes(n.shape)) {
      errors.push(
        `${prefix}.shape must be one of: ${NODE_SHAPES.join(', ')}`,
      );
    }

    if (!NODE_COLORS.includes(n.color)) {
      errors.push(
        `${prefix}.color must be one of: ${NODE_COLORS.join(', ')}`,
      );
    }

    if (typeof n.pinned !== 'boolean') {
      errors.push(`${prefix}.pinned must be a boolean`);
    }

    if (n.type !== undefined && !NODE_TYPES.includes(n.type)) {
      errors.push(`${prefix}.type must be one of: ${NODE_TYPES.join(', ')}`);
    }

    if (n.tags !== undefined) {
      if (!Array.isArray(n.tags) || (n.tags as unknown[]).some((t) => typeof t !== 'string')) {
        errors.push(`${prefix}.tags must be an array of strings`);
      }
    }

    if (n.properties !== undefined && (typeof n.properties !== 'object' || Array.isArray(n.properties))) {
      errors.push(`${prefix}.properties must be a plain object`);
    }

    if (n.securityClassification !== undefined && !SECURITY_CLASSIFICATIONS.includes(n.securityClassification)) {
      errors.push(`${prefix}.securityClassification must be one of: ${SECURITY_CLASSIFICATIONS.join(', ')}`);
    }

    if (n.deploymentEnvironment !== undefined && !DEPLOYMENT_ENVIRONMENTS.includes(n.deploymentEnvironment)) {
      errors.push(`${prefix}.deploymentEnvironment must be one of: ${DEPLOYMENT_ENVIRONMENTS.join(', ')}`);
    }
  }

  return ids;
}

function validateEdges(
  edges: unknown,
  errors: string[],
  nodeIds: Set<string>,
): void {
  if (!Array.isArray(edges)) {
    errors.push('edges must be an array');
    return;
  }

  for (let i = 0; i < edges.length; i++) {
    const e = edges[i];
    const prefix = `edges[${i}]`;

    if (!e || typeof e !== 'object') {
      errors.push(`${prefix} must be an object`);
      continue;
    }

    if (typeof e.id !== 'string' || e.id.length === 0) {
      errors.push(`${prefix}.id is required`);
    }

    if (typeof e.source !== 'string' || !nodeIds.has(e.source)) {
      errors.push(
        `${prefix}.source must reference an existing node id`,
      );
    }

    if (typeof e.target !== 'string' || !nodeIds.has(e.target)) {
      errors.push(
        `${prefix}.target must reference an existing node id`,
      );
    }

    if (!EDGE_STYLES.includes(e.style)) {
      errors.push(
        `${prefix}.style must be one of: ${EDGE_STYLES.join(', ')}`,
      );
    }

    if (!ARROW_TYPES.includes(e.arrow)) {
      errors.push(
        `${prefix}.arrow must be one of: ${ARROW_TYPES.join(', ')}`,
      );
    }

    if (e.protocol !== undefined && typeof e.protocol !== 'string') {
      errors.push(`${prefix}.protocol must be a string`);
    }

    if (e.dataTypes !== undefined) {
      if (!Array.isArray(e.dataTypes) || (e.dataTypes as unknown[]).some((t) => typeof t !== 'string')) {
        errors.push(`${prefix}.dataTypes must be an array of strings`);
      }
    }
  }
}

function validateGroups(
  groups: unknown,
  errors: string[],
  nodeIds: Set<string>,
): Set<string> {
  const groupIds = new Set<string>();
  if (groups === undefined || groups === null) {
    return groupIds;
  }
  if (!Array.isArray(groups)) {
    errors.push('groups must be an array if present');
    return groupIds;
  }

  for (let i = 0; i < groups.length; i++) {
    const g = groups[i];
    const prefix = `groups[${i}]`;

    if (!g || typeof g !== 'object') {
      errors.push(`${prefix} must be an object`);
      continue;
    }

    if (typeof g.id !== 'string' || g.id.length === 0) {
      errors.push(`${prefix}.id is required`);
    } else {
      groupIds.add(g.id);
    }

    if (typeof g.label !== 'string' || g.label.length === 0) {
      errors.push(`${prefix}.label is required and must be a non-empty string`);
    }
  }

  return groupIds;
}

function validateNodeGroupRefs(
  nodes: unknown,
  errors: string[],
  groupIds: Set<string>,
): void {
  if (!Array.isArray(nodes)) return;

  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    if (n?.group && !groupIds.has(n.group)) {
      errors.push(
        `nodes[${i}].group "${n.group}" must reference an existing group id`,
      );
    }
  }
}

function validateViewport(viewport: unknown, errors: string[]): void {
  if (viewport === undefined || viewport === null) return;

  if (typeof viewport !== 'object') {
    errors.push('viewport must be an object if present');
    return;
  }

  const v = viewport as Record<string, unknown>;
  if (typeof v.x !== 'number') errors.push('viewport.x must be a number');
  if (typeof v.y !== 'number') errors.push('viewport.y must be a number');
  if (typeof v.zoom !== 'number' || (v.zoom as number) <= 0) {
    errors.push('viewport.zoom must be a positive number');
  }
}

function validateIdUniqueness(
  d: Record<string, unknown>,
  errors: string[],
): void {
  const allIds: string[] = [];

  if (Array.isArray(d.nodes)) {
    for (const n of d.nodes) {
      if (n?.id) allIds.push(n.id);
    }
  }
  if (Array.isArray(d.edges)) {
    for (const e of d.edges) {
      if (e?.id) allIds.push(e.id);
    }
  }
  if (Array.isArray(d.groups)) {
    for (const g of d.groups) {
      if (g?.id) allIds.push(g.id);
    }
  }

  const seen = new Set<string>();
  for (const id of allIds) {
    if (seen.has(id)) {
      errors.push(`Duplicate id: "${id}"`);
    }
    seen.add(id);
  }
}

export function parseDiagramJSON(
  text: string,
): { doc: DiagramDocument; errors: string[] } | { doc: null; errors: string[] } {
  try {
    const parsed = JSON.parse(text);
    const result = validateDiagram(parsed);
    if (result.valid) {
      return { doc: parsed as DiagramDocument, errors: [] };
    }
    return { doc: null, errors: result.errors };
  } catch (e) {
    return {
      doc: null,
      errors: [`Invalid JSON: ${e instanceof Error ? e.message : String(e)}`],
    };
  }
}
