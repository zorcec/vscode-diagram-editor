/**
 * Module: src/lib/svgMetadata.ts
 *
 * Utilities for embedding and extracting .diagram source JSON inside SVG
 * <metadata> elements. This enables lossless round-trip export/import:
 * the visual SVG is the artifact users share; the metadata is the editable
 * source that DiagramFlow can re-open at any time.
 *
 * Embedding format:
 *   <metadata>
 *     <diagramflow:source xmlns:diagramflow="https://diagramflow.vscode/schema">
 *       {"meta":...,"nodes":...,"edges":...}
 *     </diagramflow:source>
 *   </metadata>
 */

const SOURCE_RE = /<diagramflow:source[^>]*>([\s\S]*?)<\/diagramflow:source>/;

/**
 * Extracts the .diagram JSON embedded in a DiagramFlow-exported SVG.
 *
 * Returns the raw JSON string if found and valid, or `null` otherwise.
 * Validation only checks structural requirements (nodes + edges arrays);
 * full schema validation is left to {@link DiagramService}.
 */
export function extractDiagramFromSvg(svgContent: string): string | null {
  const match = svgContent.match(SOURCE_RE);
  if (!match?.[1]) return null;

  const json = match[1].trim();
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) return null;
    return json;
  } catch {
    return null;
  }
}
