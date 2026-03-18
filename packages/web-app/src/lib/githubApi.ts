/** GitHub API ユーティリティ — 重複する fetch パターンを集約 */

/** ファイル内容を取得（branch または commit SHA 指定） */
export async function fetchFileContent(repo: string, filePath: string, ref: string): Promise<string> {
  const res = await fetch(
    `/api/github/content?repo=${encodeURIComponent(repo)}&path=${encodeURIComponent(filePath)}&ref=${encodeURIComponent(ref)}`,
  );
  if (!res.ok) return "";
  const data = await res.json();
  return data.content ?? "";
}

export interface TreeEntry {
  name: string;
  path: string;
  type: "file" | "dir";
  hasMd?: boolean;
}

/** ディレクトリのエントリ一覧を取得 */
export async function fetchDirEntries(repo: string, branch: string, dirPath: string): Promise<TreeEntry[]> {
  const res = await fetch(
    `/api/github/content?repo=${encodeURIComponent(repo)}&path=${encodeURIComponent(dirPath)}&ref=${encodeURIComponent(branch)}`,
  );
  if (!res.ok) return [];
  return res.json();
}

export interface CommitEntry {
  sha: string;
  message: string;
  author: string;
  date: string;
}

/** コミット履歴を取得 */
export async function fetchCommits(
  repo: string, filePath: string, branch: string,
): Promise<{ commits: CommitEntry[]; stale: boolean }> {
  const res = await fetch(
    `/api/github/commits?repo=${encodeURIComponent(repo)}&path=${encodeURIComponent(filePath)}&branch=${encodeURIComponent(branch)}`,
  );
  if (!res.ok) return { commits: [], stale: false };
  return res.json();
}

/** ブランチ一覧を取得 */
export async function fetchBranches(repo: string): Promise<string[]> {
  const res = await fetch(`/api/github/branches?repo=${encodeURIComponent(repo)}`);
  if (!res.ok) return [];
  return res.json();
}

/** ファイルを削除 */
export async function deleteFile(
  repo: string, filePath: string, message: string, branch: string,
): Promise<boolean> {
  const res = await fetch("/api/github/content", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ repo, path: filePath, message, branch }),
  });
  return res.ok;
}

/** ファイルを作成/更新 */
export async function createOrUpdateFile(
  repo: string, filePath: string, content: string, message: string, branch: string,
): Promise<{ ok: boolean; path?: string; sha?: string; commitMessage?: string; author?: string; date?: string }> {
  const res = await fetch("/api/github/content", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ repo, path: filePath, content, message, branch }),
  });
  if (!res.ok) return { ok: false };
  const data = await res.json().catch(() => ({}));
  return { ok: true, ...data };
}

/** ファイルをリネーム */
export async function renameFile(
  repo: string, oldPath: string, newPath: string, branch: string,
): Promise<boolean> {
  const res = await fetch("/api/github/content", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ repo, oldPath, newPath, branch }),
  });
  return res.ok;
}

/** ディレクトリ内の全ファイルを再帰的に取得 */
export async function listAllFiles(repo: string, branch: string, dirPath: string): Promise<string[]> {
  const entries = await fetchDirEntries(repo, branch, dirPath);
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.type === "file") {
      files.push(entry.path);
    } else if (entry.type === "dir") {
      const sub = await listAllFiles(repo, branch, entry.path);
      files.push(...sub);
    }
  }
  return files;
}
