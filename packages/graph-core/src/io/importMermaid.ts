import { createNode, createEdge, createDocument, type GraphDocument, type GraphNode, type GraphEdge, type NodeType } from '../types';
import { createBody } from '../engine/physics/PhysicsBody';
import { computeHierarchicalLayout } from '../engine/physics/hierarchical';

type Direction = 'TD' | 'TB' | 'LR' | 'RL' | 'BT';

export interface MermaidImportResult {
  doc: GraphDocument;
  direction: 'TB' | 'LR';
}

interface ParsedNode {
  mermaidId: string;
  text: string;
  type: NodeType;
  borderRadius?: number;
  groupId?: string;
}

interface ParsedEdge {
  fromId: string;
  toId: string;
  label?: string;
  hasArrow: boolean;
  dashed?: boolean;
  thick?: boolean;
}

interface SubgraphInfo {
  mermaidId: string;
  title: string;
}

/** Strip surrounding quotes (double or single) from a string. */
function stripQuotes(text: string): string {
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
    return text.slice(1, -1);
  }
  return text;
}

/**
 * Parse a node definition like `A[text]`, `B(text)`, `C{text}`, etc.
 * Returns the mermaid ID, label text, and resolved node type.
 * Returns null if the string is not a node definition.
 */
function parseNodeDef(token: string): ParsedNode | null {
  // Order matters: multi-char delimiters first
  const patterns: Array<{ regex: RegExp; type: NodeType; borderRadius?: number }> = [
    { regex: /^(\w+)\(\[(.+?)\]\)$/, type: 'ellipse' },           // ([stadium])
    { regex: /^(\w+)\(\((.+?)\)\)$/, type: 'ellipse' },           // ((circle))
    { regex: /^(\w+)\[\((.+?)\)\]$/, type: 'cylinder' },          // [(cylinder)]
    { regex: /^(\w+)\{\{(.+?)\}\}$/, type: 'diamond' },           // {{hexagon}}
    { regex: /^(\w+)\[(.+?)\]$/, type: 'rect' },                  // [rect]
    { regex: /^(\w+)\((.+?)\)$/, type: 'rect', borderRadius: 10 }, // (round)
    { regex: /^(\w+)\{(.+?)\}$/, type: 'diamond' },               // {diamond}
    { regex: /^(\w+)>(.+?)\]$/, type: 'parallelogram' },          // >asymmetric]
  ];

  for (const { regex, type, borderRadius } of patterns) {
    const m = regex.exec(token);
    if (m) {
      return { mermaidId: m[1], text: stripQuotes(m[2]), type, borderRadius };
    }
  }

  // Plain ID (no brackets) — used in edges
  if (/^\w+$/.test(token)) {
    return { mermaidId: token, text: token, type: 'rect' };
  }
  return null;
}

// Edge arrow patterns sorted by specificity (longer patterns first)
const EDGE_PATTERNS: Array<{
  regex: RegExp;
  hasArrow: boolean;
  dashed?: boolean;
  thick?: boolean;
  labelGroup?: number;
}> = [
  // Pipe-label variants: -->|label|, -.->|label|, ==>|label|
  { regex: /^==>\|(.+?)\|$/, hasArrow: true, thick: true, labelGroup: 1 },
  { regex: /^-\.->\|(.+?)\|$/, hasArrow: true, dashed: true, labelGroup: 1 },
  { regex: /^-->\|(.+?)\|$/, hasArrow: true, labelGroup: 1 },
  { regex: /^---\|(.+?)\|$/, hasArrow: false, labelGroup: 1 },
  // No-label arrows
  { regex: /^==>$/, hasArrow: true, thick: true },
  { regex: /^-.->$/, hasArrow: true, dashed: true },
  { regex: /^-\.-$/, hasArrow: false, dashed: true },
  { regex: /^-->$/, hasArrow: true },
  { regex: /^---$/, hasArrow: false },
];

// Inline label patterns: -- label -->, == label ==>, -. label .->
const INLINE_LABEL_PATTERNS: Array<{
  startRegex: RegExp;
  endRegex: RegExp;
  hasArrow: boolean;
  dashed?: boolean;
  thick?: boolean;
}> = [
  { startRegex: /^==$/, endRegex: /^==>$/, hasArrow: true, thick: true },
  { startRegex: /^-\.$/, endRegex: /^\.->$/, hasArrow: true, dashed: true },
  { startRegex: /^--$/, endRegex: /^-->$/, hasArrow: true },
  { startRegex: /^--$/, endRegex: /^---$/, hasArrow: false },
];

function parseEdge(tokens: string[]): { consumed: number; edge: ParsedEdge } | null {
  // Need at least 3 tokens: FROM ARROW TO
  if (tokens.length < 3) return null;

  const fromNode = parseNodeDef(tokens[0]);
  if (!fromNode) return null;

  // Try simple edge pattern (FROM ARROW TO)
  for (const pat of EDGE_PATTERNS) {
    const m = pat.regex.exec(tokens[1]);
    if (m) {
      const toNode = parseNodeDef(tokens[2]);
      if (!toNode) return null;
      return {
        consumed: 3,
        edge: {
          fromId: fromNode.mermaidId,
          toId: toNode.mermaidId,
          label: pat.labelGroup ? m[pat.labelGroup] : undefined,
          hasArrow: pat.hasArrow,
          dashed: pat.dashed,
          thick: pat.thick,
        },
      };
    }
  }

  // Try inline label pattern (FROM -- label --> TO)
  if (tokens.length >= 4) {
    for (const pat of INLINE_LABEL_PATTERNS) {
      if (pat.startRegex.test(tokens[1])) {
        // Find the matching end token
        for (let i = 3; i < tokens.length; i++) {
          if (pat.endRegex.test(tokens[i])) {
            const label = tokens.slice(2, i).join(' ');
            const toNode = parseNodeDef(tokens[i + 1]);
            if (!toNode) return null;
            return {
              consumed: i + 2,
              edge: {
                fromId: fromNode.mermaidId,
                toId: toNode.mermaidId,
                label,
                hasArrow: pat.hasArrow,
                dashed: pat.dashed,
                thick: pat.thick,
              },
            };
          }
        }
      }
    }
  }

  return null;
}

/**
 * Tokenize a line, respecting brackets and pipe-delimited labels.
 * Splits on whitespace but keeps bracketed/pipe content together.
 */
function tokenizeLine(line: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let depth = 0;
  let inPipe = false;
  const brackets: Record<string, string> = { '[': ']', '(': ')', '{': '}' };
  const closers = new Set(Object.values(brackets));

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (depth === 0 && !inPipe && (ch === ' ' || ch === '\t')) {
      if (current) {
        tokens.push(current);
        current = '';
      }
      continue;
    }

    current += ch;

    if (ch === '|' && depth === 0) {
      inPipe = !inPipe;
    } else if (brackets[ch]) {
      depth++;
    } else if (closers.has(ch)) {
      depth = Math.max(0, depth - 1);
    }
  }
  if (current) tokens.push(current);
  return tokens;
}

/**
 * Import a Mermaid flowchart/graph string into a GraphDocument.
 * Supports: flowchart/graph, TD/TB/LR/RL/BT directions,
 * node shapes, edge types, labels, and subgraphs.
 */
export function importFromMermaid(mmdString: string): MermaidImportResult {
  const trimmed = mmdString.trim();
  if (!trimmed) throw new Error('Empty input');

  const lines = trimmed.split('\n').map(l => l.trim());

  // Parse header: flowchart/graph + direction
  const headerIdx = lines.findIndex(l => /^(flowchart|graph)\s/i.test(l));
  if (headerIdx < 0) throw new Error('Missing flowchart/graph declaration');

  const headerMatch = /^(flowchart|graph)\s+(TD|TB|LR|RL|BT)\s*$/i.exec(lines[headerIdx]);
  const direction: Direction = (headerMatch?.[2]?.toUpperCase() as Direction) ?? 'TD';

  const nodeMap = new Map<string, ParsedNode>();
  const parsedEdges: ParsedEdge[] = [];
  const subgraphStack: SubgraphInfo[] = [];
  const nodeSubgraphMap = new Map<string, string>(); // mermaidId → subgraph mermaidId

  // Process body lines
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line || line.startsWith('%%')) continue;

    // Handle subgraph
    const subgraphMatch = /^subgraph\s+(\w+)\s*\[(.+?)\]\s*$/.exec(line)
      ?? /^subgraph\s+(.+?)\s*$/.exec(line);
    if (subgraphMatch) {
      const id = subgraphMatch[2] ? subgraphMatch[1] : subgraphMatch[1].replaceAll(/\s+/g, '_');
      const title = subgraphMatch[2] ?? subgraphMatch[1];
      subgraphStack.push({ mermaidId: id, title });
      // Register subgraph as a frame node
      nodeMap.set(id, { mermaidId: id, text: title, type: 'frame' });
      continue;
    }

    if (/^end\s*$/.test(line)) {
      subgraphStack.pop();
      continue;
    }

    // Tokenize and parse
    const tokens = tokenizeLine(line);
    if (tokens.length === 0) continue;

    let pos = 0;
    while (pos < tokens.length) {
      // Try to parse an edge starting at pos
      const edgeResult = parseEdge(tokens.slice(pos));
      if (edgeResult) {
        const { consumed, edge } = edgeResult;
        parsedEdges.push(edge);

        // Register nodes from edge (both endpoints + any inline definitions)
        for (const token of [tokens[pos], tokens[pos + consumed - 1]]) {
          const nodeDef = parseNodeDef(token);
          if (nodeDef && !nodeMap.has(nodeDef.mermaidId)) {
            nodeMap.set(nodeDef.mermaidId, nodeDef);
            if (subgraphStack.length > 0) {
              nodeSubgraphMap.set(nodeDef.mermaidId, subgraphStack.at(-1)!.mermaidId);
            }
          }
        }

        // Continue parsing from the last token (it might be the start of a chained edge)
        pos += consumed - 1;
        continue;
      }

      // Try standalone node definition
      const nodeDef = parseNodeDef(tokens[pos]);
      if (nodeDef && !nodeMap.has(nodeDef.mermaidId)) {
        nodeMap.set(nodeDef.mermaidId, nodeDef);
        if (subgraphStack.length > 0) {
          nodeSubgraphMap.set(nodeDef.mermaidId, subgraphStack.at(-1)!.mermaidId);
        }
      }
      pos++;
    }
  }

  // Build GraphDocument
  const doc = createDocument('Imported');
  const idMap = new Map<string, string>(); // mermaidId → generated UUID

  // Layout: grid positions based on direction
  const isHorizontal = direction === 'LR' || direction === 'RL';
  const spacing = { x: isHorizontal ? 250 : 200, y: isHorizontal ? 150 : 180 };
  const cols = isHorizontal ? Math.ceil(Math.sqrt(nodeMap.size * 2)) : Math.ceil(Math.sqrt(nodeMap.size));

  let idx = 0;
  for (const [mermaidId, parsed] of nodeMap) {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const x = 100 + col * spacing.x;
    const y = 100 + row * spacing.y;

    const node = createNode(parsed.type, x, y, { text: parsed.text });

    if (parsed.borderRadius) {
      node.style = { ...node.style, borderRadius: parsed.borderRadius };
    }

    idMap.set(mermaidId, node.id);
    doc.nodes.push(node);
    idx++;
  }

  // Assign groupId for subgraph children
  for (const [mermaidId, subgraphMermaidId] of nodeSubgraphMap) {
    const nodeId = idMap.get(mermaidId);
    const frameId = idMap.get(subgraphMermaidId);
    if (nodeId && frameId) {
      const node = doc.nodes.find(n => n.id === nodeId);
      if (node) node.groupId = frameId;
    }
  }

  // Create edges
  for (const pe of parsedEdges) {
    const fromNodeId = idMap.get(pe.fromId);
    const toNodeId = idMap.get(pe.toId);
    if (!fromNodeId || !toNodeId) continue;

    const fromNode = doc.nodes.find(n => n.id === fromNodeId);
    const toNode = doc.nodes.find(n => n.id === toNodeId);
    if (!fromNode || !toNode) continue;

    // Use 'connector' type for node-to-node edges (orthogonal routing)
    const edgeType = pe.hasArrow ? 'connector' : 'line';
    const edge = createEdge(
      edgeType,
      { nodeId: fromNodeId, x: fromNode.x + fromNode.width / 2, y: fromNode.y + fromNode.height / 2 },
      { nodeId: toNodeId, x: toNode.x + toNode.width / 2, y: toNode.y + toNode.height / 2 },
      { label: pe.label },
    );

    if (pe.dashed) edge.style = { ...edge.style, dashed: true };
    if (pe.thick) edge.style = { ...edge.style, strokeWidth: 4 };

    doc.edges.push(edge);
  }

  // Normalize direction: TD/TB/BT → 'TB', LR/RL → 'LR'
  const normalizedDirection: 'TB' | 'LR' = (direction === 'LR' || direction === 'RL') ? 'LR' : 'TB';

  return { doc, direction: normalizedDirection };
}

const FRAME_PADDING = 40;
const FRAME_TITLE_HEIGHT = 28;

/**
 * Bottom-up layout for subgroups (ELK SEPARATE_CHILDREN style).
 * 1. Layout children inside each frame independently
 * 2. Determine frame sizes from children bounding boxes
 * 3. Layout frames (as fixed-size nodes) + orphan nodes in parent graph
 * 4. Translate children to absolute coordinates inside their frame
 */
export function layoutWithSubgroups(
  doc: GraphDocument,
  direction: 'TB' | 'LR',
  levelGap: number,
  nodeSpacing: number,
): void {
  const frames = doc.nodes.filter(n => n.type === 'frame');
  const frameIds = new Set(frames.map(n => n.id));

  // Classify nodes
  const childrenOf = new Map<string, GraphNode[]>();
  const orphanNodes: GraphNode[] = [];
  for (const node of doc.nodes) {
    if (node.type === 'frame') continue;
    if (node.groupId && frameIds.has(node.groupId)) {
      const list = childrenOf.get(node.groupId) ?? [];
      list.push(node);
      childrenOf.set(node.groupId, list);
    } else {
      orphanNodes.push(node);
    }
  }

  // Classify edges
  const nodeToFrame = new Map<string, string>();
  for (const [frameId, children] of childrenOf) {
    for (const child of children) {
      nodeToFrame.set(child.id, frameId);
    }
  }
  const intraEdgesOf = new Map<string, GraphEdge[]>();
  const interEdges: GraphEdge[] = [];
  for (const edge of doc.edges) {
    const fromFrame = edge.from.nodeId ? nodeToFrame.get(edge.from.nodeId) : undefined;
    const toFrame = edge.to.nodeId ? nodeToFrame.get(edge.to.nodeId) : undefined;
    if (fromFrame && toFrame && fromFrame === toFrame) {
      const list = intraEdgesOf.get(fromFrame) ?? [];
      list.push(edge);
      intraEdgesOf.set(fromFrame, list);
    } else {
      interEdges.push(edge);
    }
  }

  // Step 1 & 2: Layout children inside each frame, determine frame size
  const childOrigins = new Map<string, { x: number; y: number }>();
  for (const frame of frames) {
    const children = childrenOf.get(frame.id);
    if (!children || children.length === 0) continue;

    const bodies = new Map(children.map(n => [n.id, createBody(n)]));
    const edges = intraEdgesOf.get(frame.id) ?? [];
    computeHierarchicalLayout(bodies, edges, direction, levelGap, nodeSpacing);

    // Apply layout results to children
    for (const child of children) {
      const body = bodies.get(child.id);
      if (body) {
        child.x = body.x;
        child.y = body.y;
      }
    }

    // Compute bounding box of children
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const c of children) {
      minX = Math.min(minX, c.x);
      minY = Math.min(minY, c.y);
      maxX = Math.max(maxX, c.x + c.width);
      maxY = Math.max(maxY, c.y + c.height);
    }

    // Save origin for later absolute positioning
    childOrigins.set(frame.id, { x: minX, y: minY });

    // Set frame size
    frame.width = maxX - minX + FRAME_PADDING * 2;
    frame.height = maxY - minY + FRAME_PADDING * 2 + FRAME_TITLE_HEIGHT;
  }

  // Step 3: Parent layout — frames (fixed size) + orphan nodes
  const parentNodes = [...frames, ...orphanNodes];
  if (parentNodes.length === 0) return;

  const parentBodies = new Map(parentNodes.map(n => [n.id, createBody(n)]));
  // Remap inter-edges that reference child nodes to their parent frame
  const remappedEdges: GraphEdge[] = interEdges.map(edge => {
    const fromFrame = edge.from.nodeId ? nodeToFrame.get(edge.from.nodeId) : undefined;
    const toFrame = edge.to.nodeId ? nodeToFrame.get(edge.to.nodeId) : undefined;
    const newFrom = fromFrame
      ? { ...edge.from, nodeId: fromFrame }
      : edge.from;
    const newTo = toFrame
      ? { ...edge.to, nodeId: toFrame }
      : edge.to;
    return { ...edge, from: newFrom, to: newTo };
  });
  computeHierarchicalLayout(parentBodies, remappedEdges, direction, levelGap, nodeSpacing);

  // Apply parent layout positions
  for (const node of parentNodes) {
    const body = parentBodies.get(node.id);
    if (body) {
      node.x = body.x;
      node.y = body.y;
    }
  }

  // Step 4: Translate children to absolute coordinates inside frame
  for (const frame of frames) {
    const children = childrenOf.get(frame.id);
    const origin = childOrigins.get(frame.id);
    if (!children || !origin) continue;

    const dx = frame.x + FRAME_PADDING - origin.x;
    const dy = frame.y + FRAME_PADDING + FRAME_TITLE_HEIGHT - origin.y;
    for (const child of children) {
      child.x += dx;
      child.y += dy;
    }
  }

  // Update edge endpoints
  const nodeMap = new Map(doc.nodes.map(n => [n.id, n]));
  for (const edge of doc.edges) {
    const fn = edge.from.nodeId ? nodeMap.get(edge.from.nodeId) : undefined;
    const tn = edge.to.nodeId ? nodeMap.get(edge.to.nodeId) : undefined;
    if (fn) { edge.from.x = fn.x + fn.width / 2; edge.from.y = fn.y + fn.height / 2; }
    if (tn) { edge.to.x = tn.x + tn.width / 2; edge.to.y = tn.y + tn.height / 2; }
  }
}
