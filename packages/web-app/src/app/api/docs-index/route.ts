import { fetchC4Model } from "@anytime-markdown/trail-core/c4";
import type { DocLink } from "@anytime-markdown/trail-core/c4";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { createC4ModelStore } from "../../../lib/api-helpers";

/**
 * GET /api/docs-index?repo=...
 *
 * GitHub API でドキュメントリポジトリのファイルツリーを取得し、
 * フロントマターに `c4Scope` を持つ Markdown をインデックスとして返す。
 *
 * `repo` パラメータが指定された場合は、その repo の C4 モデル要素 ID 集合と
 * `doc.c4Scope` がヒット（完全一致または親パス）するドキュメントだけを返す。
 *
 * 環境変数:
 *   DOCS_GITHUB_REPO  — "owner/repo" 形式（必須）
 *   DOCS_GITHUB_TOKEN — PAT（private repo 用、省略可）
 */

const CACHE_MAX_AGE = 300; // 5 min

/** フロントマターの c4Scope / title / type / date を抽出する */
function parseFrontmatter(raw: string): Pick<DocLink, "title" | "type" | "c4Scope" | "date"> | null {
  const normalized = raw.replaceAll("\r\n", "\n");
  const lines = normalized.split("\n");
  if (lines[0] !== "---") return null;

  let endLineIndex = -1;
  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i] === "---") {
      endLineIndex = i;
      break;
    }
  }
  if (endLineIndex < 0) return null;

  const fmLines = lines.slice(1, endLineIndex);

  const trimQuotes = (value: string): string => {
    const trimmed = value.trim();
    if (trimmed.length >= 2) {
      const first = trimmed[0];
      const last = trimmed[trimmed.length - 1];
      if ((first === `"` && last === `"`) || (first === "'" && last === "'")) {
        return trimmed.slice(1, -1);
      }
    }
    return trimmed;
  };

  const parseScalar = (line: string, key: string): string | null => {
    const trimmed = line.trim();
    if (!trimmed.startsWith(`${key}:`)) return null;
    return trimQuotes(trimmed.slice(key.length + 1));
  };

  // c4Scope (YAML array)
  const scopeLines: string[] = [];
  let inScope = false;
  for (const line of fmLines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("c4Scope:")) {
      inScope = true;
      // inline value (e.g. c4Scope: ["a"])
      const start = line.indexOf("[");
      const end = line.lastIndexOf("]");
      if (start >= 0 && end > start) {
        const inline = line.slice(start + 1, end);
        scopeLines.push(
          ...inline
            .split(",")
            .map((s) => trimQuotes(s))
            .filter(Boolean),
        );
        inScope = false;
      }
      continue;
    }
    if (inScope) {
      if (trimmed.startsWith("- ")) {
        scopeLines.push(trimQuotes(trimmed.slice(2)));
      } else {
        inScope = false;
      }
    }
  }
  if (scopeLines.length === 0) return null;

  let title: string | null = null;
  let type: string | null = null;
  let date: string | null = null;
  for (const line of fmLines) {
    if (title === null) title = parseScalar(line, "title");
    if (type === null) type = parseScalar(line, "type");
    if (date === null) date = parseScalar(line, "date");
    if (title !== null && type !== null && date !== null) break;
  }

  return {
    title: title ?? "Untitled",
    type: type ?? "unknown",
    c4Scope: scopeLines,
    date: date ?? "",
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

/** GitHub から全ドキュメントを取得（5 分キャッシュ） */
async function fetchAllDocs(): Promise<DocLink[] | null> {
  const repoRaw = process.env.DOCS_GITHUB_REPO;
  if (!repoRaw) return null;
  const repo = extractOwnerRepo(repoRaw);
  if (!repo) return null;

  if (cachedIndex && Date.now() < cachedIndex.expiresAt) {
    return cachedIndex.docs;
  }

  const token = process.env.DOCS_GITHUB_TOKEN;
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "anytime-markdown-web-app",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const treeRes = await fetch(
    `https://api.github.com/repos/${encodeURI(repo)}/git/trees/main?recursive=1`,
    { headers, next: { revalidate: CACHE_MAX_AGE } },
  );
  if (!treeRes.ok) return null;
  const treeData = (await treeRes.json()) as GitHubTreeResponse;
  const mdPaths = (treeData.tree ?? [])
    .filter((item) => item.type === "blob" && item.path?.endsWith(".md"))
    .map((item) => item.path as string);

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
  return docs;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const repoParam = request.nextUrl.searchParams.get("repo") ?? undefined;

  const allDocs = await fetchAllDocs();
  if (allDocs === null) {
    return NextResponse.json({ docs: [] });
  }

  // repo 指定なしは workspace global（全件返却、後方互換）
  if (!repoParam) {
    return NextResponse.json(
      { docs: allDocs },
      { headers: { "Cache-Control": `public, max-age=${CACHE_MAX_AGE}` } },
    );
  }

  // C4 モデルから repo の要素 ID 集合を構築し、
  // doc.c4Scope のいずれかが要素 ID と完全一致または親パスとしてヒットするものだけ返す
  const store = createC4ModelStore();
  if (!store) {
    return NextResponse.json({ docs: allDocs });
  }
  try {
    const payload = await fetchC4Model(store, 'current', repoParam);
    const elementIds = new Set((payload?.model.elements ?? []).map((e) => e.id));
    if (elementIds.size === 0) {
      return NextResponse.json({ docs: [] });
    }
    const filtered = allDocs.filter((d) =>
      d.c4Scope.some((scope) =>
        elementIds.has(scope) || [...elementIds].some((id) => id.startsWith(scope + '/'))
      )
    );
    return NextResponse.json(
      { docs: filtered },
      { headers: { "Cache-Control": `public, max-age=${CACHE_MAX_AGE}` } },
    );
  } catch {
    return NextResponse.json({ docs: allDocs });
  }
}
