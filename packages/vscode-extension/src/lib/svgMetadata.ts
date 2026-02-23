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
 * Unescapes XML character entities that may appear in SVG text content.
 * Only handles entities that can appear in serialised JSON embedded in SVG:
 * &amp; → &, &lt; → <, &gt; → >, &quot; → ", &apos; → '
 */
function unescapeXmlEntities(text: string): string {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

/**
 * Extracts the .diagram JSON embedded in a DiagramFlow-exported SVG.
 *
 * Returns the unescaped JSON string if found and valid, or `null` otherwise.
 * Validation only checks structural requirements (nodes + edges arrays);
 * full schema validation is left to {@link DiagramService}.
 *
 * Handles both:
 * - Raw JSON in element text content (current format, preferred)
 * - XML-escaped JSON with &quot; entities (legacy format, still readable)
 */
export function extractDiagramFromSvg(svgContent: string): string | null {
  const match = svgContent.match(SOURCE_RE);
  if (!match?.[1]) return null;

  const raw = match[1].trim();
  // Unescape any XML entities (handles both escaped and unescaped formats).
  const json = unescapeXmlEntities(raw);
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) return null;
    return json;
  } catch {
    return null;
  }
}
