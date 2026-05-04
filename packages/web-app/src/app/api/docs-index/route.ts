import type { DocLink } from "@anytime-markdown/trail-core/c4";
import { NextResponse } from "next/server";

/**
 * GET /api/docs-index
 *
 * GitHub API でドキュメントリポジトリのファイルツリーを取得し、
 * フロントマターに `c4Scope` を持つ Markdown をインデックスとして返す。
 *
 * 環境変数:
 *   DOCS_GITHUB_REPO  — "owner/repo" 形式（必須）
 *   DOCS_GITHUB_TOKEN — PAT（private repo 用、省略可）
 */

const CACHE_MAX_AGE = 300; // 5 min

function trimQuotes(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length < 2) return trimmed;
  const first = trimmed[0];
  const last = trimmed[trimmed.length - 1];
  if ((first === `"` && last === `"`) || (first === "'" && last === "'")) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseScalar(line: string, key: string): string | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith(`${key}:`)) return null;
  return trimQuotes(trimmed.slice(key.length + 1));
}

function findFrontmatterRange(lines: string[]): [number, number] | null {
  if (lines[0] !== "---") return null;
  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i] === "---") return [1, i];
  }
  return null;
}

function parseInlineC4Scope(line: string): string[] | null {
  const start = line.indexOf("[");
  const end = line.lastIndexOf("]");
  if (start < 0 || end <= start) return null;
  return line
    .slice(start + 1, end)
    .split(",")
    .map(trimQuotes)
    .filter(Boolean);
}

function parseC4Scope(fmLines: readonly string[]): string[] {
  const scope: string[] = [];
  let inScope = false;
  for (const line of fmLines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("c4Scope:")) {
      const inline = parseInlineC4Scope(line);
      if (inline) {
        scope.push(...inline);
        inScope = false;
      } else {
        inScope = true;
      }
      continue;
    }
    if (!inScope) continue;
    if (trimmed.startsWith("- ")) {
      scope.push(trimQuotes(trimmed.slice(2)));
    } else {
      inScope = false;
    }
  }
  return scope;
}

function parseScalars(
  fmLines: readonly string[],
  keys: readonly string[],
): Record<string, string | null> {
  const result: Record<string, string | null> = {};
  for (const k of keys) result[k] = null;
  for (const line of fmLines) {
    for (const k of keys) {
      if (result[k] === null) result[k] = parseScalar(line, k);
    }
    if (keys.every((k) => result[k] !== null)) break;
  }
  return result;
}

/** フロントマターの c4Scope / title / type / date を抽出する */
function parseFrontmatter(raw: string): Pick<DocLink, "title" | "type" | "c4Scope" | "date"> | null {
  const lines = raw.replaceAll("\r\n", "\n").split("\n");
  const range = findFrontmatterRange(lines);
  if (!range) return null;
  const fmLines = lines.slice(range[0], range[1]);

  const c4Scope = parseC4Scope(fmLines);
  if (c4Scope.length === 0) return null;

  const scalars = parseScalars(fmLines, ["title", "type", "date"]);
  return {
    title: scalars["title"] ?? "Untitled",
    type: scalars["type"] ?? "unknown",
    c4Scope,
    date: scalars["date"] ?? "",
  };
}

interface GitHubTreeItem {
  path?: string;
  type?: string;
}

interface GitHubTreeResponse {
  tree?: GitHubTreeItem[];
  truncated?: boolean;
}

interface GitHubBlobResponse {
  content?: string;
  encoding?: string;
}

/** "https://github.com/owner/repo" または "owner/repo" から "owner/repo" を抽出 */
function extractOwnerRepo(value: string): string | null {
  const urlMatch = /github\.com\/([^/]+\/[^/]+)\/?$/.exec(value);
  if (urlMatch) return urlMatch[1];
  if (/^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/.test(value)) return value;
  return null;
}

let cachedIndex: { docs: DocLink[]; expiresAt: number } | null = null;

export async function GET(): Promise<NextResponse> {
  const repoRaw = process.env.DOCS_GITHUB_REPO;
  if (!repoRaw) {
    return NextResponse.json({ docs: [] });
  }

  const repo = extractOwnerRepo(repoRaw);
  if (!repo) {
    return NextResponse.json({ docs: [] });
  }

  // in-memory cache
  if (cachedIndex && Date.now() < cachedIndex.expiresAt) {
    return NextResponse.json(
      { docs: cachedIndex.docs },
      { headers: { "Cache-Control": `public, max-age=${CACHE_MAX_AGE}` } },
    );
  }

  const token = process.env.DOCS_GITHUB_TOKEN;
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "anytime-markdown-web-app",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // 1. ファイルツリー取得
  const treeRes = await fetch(
    `https://api.github.com/repos/${encodeURI(repo)}/git/trees/main?recursive=1`,
    { headers, next: { revalidate: CACHE_MAX_AGE } },
  );
  if (!treeRes.ok) {
    return NextResponse.json(
      { error: "Failed to fetch repository tree" },
      { status: treeRes.status },
    );
  }
  const treeData = (await treeRes.json()) as GitHubTreeResponse;
  const mdPaths = (treeData.tree ?? [])
    .filter((item) => item.type === "blob" && item.path?.endsWith(".md"))
    .map((item) => item.path as string);

  // 2. 各ファイルのフロントマター取得（並列、最大20件ずつ）
  const docs: DocLink[] = [];
  const BATCH_SIZE = 20;
  for (let i = 0; i < mdPaths.length; i += BATCH_SIZE) {
    const batch = mdPaths.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map(async (filePath) => {
        const blobRes = await fetch(
          `https://api.github.com/repos/${encodeURI(repo)}/contents/${encodeURI(filePath)}?ref=main`,
          { headers },
        );
        if (!blobRes.ok) return null;
        const blob = (await blobRes.json()) as GitHubBlobResponse;
        if (!blob.content) return null;
        const raw = Buffer.from(blob.content, "base64").toString("utf-8");
        const meta = parseFrontmatter(raw);
        if (!meta) return null;
        return { ...meta, path: filePath } satisfies DocLink;
      }),
    );
    for (const doc of results) {
      if (doc) docs.push(doc);
    }
  }

  cachedIndex = { docs, expiresAt: Date.now() + CACHE_MAX_AGE * 1000 };

  return NextResponse.json(
    { docs },
    { headers: { "Cache-Control": `public, max-age=${CACHE_MAX_AGE}` } },
  );
}
