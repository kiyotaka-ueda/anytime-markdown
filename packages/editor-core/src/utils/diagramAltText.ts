import { detectMermaidType } from "../hooks/useMermaidRender";

/** Max input length to prevent ReDoS */
const MAX_INPUT_LENGTH = 500;
const MAX_ELEMENTS = 5;

/** Type label map (matches i18n keys from detectMermaidType) */
const TYPE_LABELS: Record<string, string> = {
  diagramFlowchart: "Flowchart",
  diagramSequence: "Sequence diagram",
  diagramClass: "Class diagram",
  diagramState: "State diagram",
  diagramEr: "ER diagram",
  diagramGantt: "Gantt chart",
  diagramPie: "Pie chart",
  diagramMindmap: "Mindmap",
  diagramGeneric: "Diagram",
};

function formatList(prefix: string, items: string[]): string {
  if (items.length === 0) return prefix;
  const shown = items.slice(0, MAX_ELEMENTS);
  const rest = items.length - MAX_ELEMENTS;
  const list = shown.join(", ");
  return rest > 0 ? `${prefix}: ${list} ...and ${rest} more` : `${prefix}: ${list}`;
}

function unique(arr: string[]): string[] {
  const seen = new Set<string>();
  return arr.filter((item) => {
    if (seen.has(item)) return false;
    seen.add(item);
    return true;
  });
}

function extractMermaidFlowchartNames(code: string): string[] {
  const labels: string[] = [];
  const nodeIds: string[] = [];
  let match: RegExpExecArray | null;

  // Extract nodes with labels: A[Label], B{Label}, C(Label), D>Label]
  const labeledNodeRegex = /([A-Za-z0-9_]+)\s*(?:\[([^\]]+)\]|\{([^}]+)\}|\(([^)]+)\))/g;
  while ((match = labeledNodeRegex.exec(code)) !== null) {
    const label = match[2] || match[3] || match[4];
    if (label && !label.includes("-->") && !label.includes("---")) {
      labels.push(label.trim());
    }
    nodeIds.push(match[1]);
  }

  if (labels.length > 0) return unique(labels);

  // Fallback: extract bare node IDs from arrow patterns (A --> B)
  const srcRegex = /([A-Za-z0-9_]+)\s*-->/g;
  const dstRegex = /-->\s*(?:\|[^|]*\|\s*)?([A-Za-z0-9_]+)/g;
  const bareIds: string[] = [];
  while ((match = srcRegex.exec(code)) !== null) {
    bareIds.push(match[1]);
  }
  while ((match = dstRegex.exec(code)) !== null) {
    bareIds.push(match[1]);
  }

  return unique(bareIds.length > 0 ? bareIds : nodeIds);
}

function extractMermaidSequenceNames(code: string): string[] {
  const names: string[] = [];
  const regex = /(?:participant|actor)\s+(\S+)/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(code)) !== null) {
    names.push(match[1]);
  }
  return unique(names);
}

function extractPlantUmlNames(code: string): string[] {
  const names: string[] = [];
  const regex = /(?:actor|participant|entity|database|collections)\s+(?:"([^"]+)"|(\S+))/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(code)) !== null) {
    let name = match[1] || match[2];
    // Strip "as Alias" suffix if present in unquoted form
    if (name && !match[1]) {
      name = name.replace(/\s+as\s+\S+$/i, "");
    }
    if (name) names.push(name);
  }
  return unique(names);
}

/**
 * Extract a descriptive alt text from diagram source code.
 * Used for aria-label on diagram preview elements.
 */
export function extractDiagramAltText(
  code: string,
  language: "mermaid" | "plantuml" | "html" | "math"
): string {
  if (!code.trim()) return "Diagram";

  // ReDoS protection: limit input length
  const safeCode = code.slice(0, MAX_INPUT_LENGTH);

  if (language === "html") return "HTML block";

  if (language === "math") {
    const trimmed = code.trim();
    if (trimmed.length <= 30) return `Math: ${trimmed}`;
    return `Math: ${trimmed.slice(0, 30)}...`;
  }

  if (language === "plantuml") {
    const names = extractPlantUmlNames(safeCode);
    return formatList("PlantUML", names);
  }

  // Mermaid
  const mermaidType = detectMermaidType(safeCode);
  const typeLabel = TYPE_LABELS[mermaidType] || "Diagram";

  if (mermaidType === "diagramFlowchart") {
    const names = extractMermaidFlowchartNames(safeCode);
    return formatList(typeLabel, names);
  }

  if (mermaidType === "diagramSequence") {
    const names = extractMermaidSequenceNames(safeCode);
    return formatList(typeLabel, names);
  }

  // For other mermaid types, just return the type label
  return typeLabel;
}
