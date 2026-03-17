const HEADING_RE = /^(#{1,5})\s+(.+)$/;

export interface MarkdownSection {
  heading: string | null;
  level: number;
  headingLine: string;
  bodyLines: string[];
  children: MarkdownSection[];
}

export function parseMarkdownSections(text: string): MarkdownSection[] {
  if (text === "") return [];
  const lines = text.split("\n");
  return buildSections(lines, 0, lines.length, 0);
}

function matchHeading(line: string): { level: number; text: string } | null {
  const m = line.match(HEADING_RE);
  if (!m) return null;
  return { level: m[1].length, text: m[2].trim() };
}

function isCodeFence(line: string): boolean {
  return line.startsWith("```");
}

/**
 * lines[start..end) を見出しで分割してセクション配列を返す。
 * parentLevel: 親セクションの見出しレベル（ルート呼び出しは 0）
 */
function buildSections(lines: string[], start: number, end: number, parentLevel: number): MarkdownSection[] {
  const sections: MarkdownSection[] = [];
  let i = start;
  let inCodeBlock = false;

  // 最初の見出しのレベルを検出（このレベルで分割する）
  let splitLevel = 0;
  {
    let cb = false;
    for (let j = start; j < end; j++) {
      if (isCodeFence(lines[j])) cb = !cb;
      if (cb) continue;
      const h = matchHeading(lines[j]);
      if (h && h.level > parentLevel) { splitLevel = h.level; break; }
    }
  }

  // 見出しが見つからない場合: 全行をルートセクションとして返す
  if (splitLevel === 0) {
    if (start < end) {
      sections.push({
        heading: null, level: 0, headingLine: "",
        bodyLines: lines.slice(start, end), children: [],
      });
    }
    return sections;
  }

  // 最初の見出しより前の行をルートセクションとして収集
  const rootBodyLines: string[] = [];
  while (i < end) {
    if (isCodeFence(lines[i])) inCodeBlock = !inCodeBlock;
    if (!inCodeBlock) {
      const h = matchHeading(lines[i]);
      if (h && h.level === splitLevel) break;
    }
    rootBodyLines.push(lines[i]);
    i++;
  }
  if (rootBodyLines.length > 0) {
    sections.push({ heading: null, level: 0, headingLine: "", bodyLines: rootBodyLines, children: [] });
  }

  // splitLevel の見出しでセクション分割
  inCodeBlock = false;
  while (i < end) {
    if (isCodeFence(lines[i])) inCodeBlock = !inCodeBlock;
    if (inCodeBlock) { i++; continue; }

    const h = matchHeading(lines[i]);
    if (!h || h.level !== splitLevel) { i++; continue; }

    const headingLine = lines[i];
    const heading = h.text;
    const level = h.level;
    i++;

    // このセクションの終端を探す（同レベルの見出しまで）
    const bodyStart = i;
    let cb = false;
    while (i < end) {
      if (isCodeFence(lines[i])) cb = !cb;
      if (!cb) {
        const next = matchHeading(lines[i]);
        if (next && next.level <= level) break;
      }
      i++;
    }

    // bodyStart〜i の範囲でサブ見出しを再帰解析
    const bodyLines: string[] = [];
    const children = extractChildren(lines, bodyStart, i, level, bodyLines);

    sections.push({ heading, level, headingLine, bodyLines, children });
  }

  return sections;
}

/** サブ見出しより前の行を bodyLines に格納し、サブ見出しを再帰的に解析 */
function extractChildren(
  lines: string[], start: number, end: number, parentLevel: number, bodyLines: string[],
): MarkdownSection[] {
  let i = start;
  let inCodeBlock = false;

  while (i < end) {
    if (isCodeFence(lines[i])) inCodeBlock = !inCodeBlock;
    if (!inCodeBlock) {
      const h = matchHeading(lines[i]);
      if (h && h.level > parentLevel) break;
    }
    bodyLines.push(lines[i]);
    i++;
  }
  if (i >= end) return [];
  return buildSections(lines, i, end, parentLevel);
}
