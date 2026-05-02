import fs from 'node:fs';
import path from 'node:path';

import type { C4Element } from '@anytime-markdown/trail-core/c4';

/**
 * `analyzeWorkspace` 未実行で TrailGraph が利用できないときのフォールバック用。
 * 各リポジトリの `packages/<pkg>/src/<dir>` 構造を直接走査して、
 * - container: `pkg_<pkg>` (name = pkg)
 * - component: `pkg_<pkg>/<dir>` (name = dir)
 * を合成する。
 *
 * trail-core/transform/toC4.ts の `extractComponentName` と同じ命名規則で合成するため、
 * GraphClusterer.buildCommunityLabels の解決ロジックがそのまま機能する。
 */
export function synthesizeC4ElementsFromFilesystem(
  repositories: readonly { readonly path: string }[],
): C4Element[] {
  const elements: C4Element[] = [];
  const seen = new Set<string>();

  for (const repo of repositories) {
    const pkgsDir = path.join(repo.path, 'packages');
    if (!fs.existsSync(pkgsDir)) continue;

    for (const pkg of safeReadDir(pkgsDir)) {
      if (!pkg.isDirectory()) continue;
      const containerId = `pkg_${pkg.name}`;
      if (!seen.has(containerId)) {
        elements.push({ id: containerId, type: 'container', name: pkg.name });
        seen.add(containerId);
      }

      const srcDir = path.join(pkgsDir, pkg.name, 'src');
      if (!fs.existsSync(srcDir)) continue;

      for (const sub of safeReadDir(srcDir)) {
        if (!sub.isDirectory()) continue;
        const compId = `pkg_${pkg.name}/${sub.name}`;
        if (seen.has(compId)) continue;
        elements.push({
          id: compId,
          type: 'component',
          name: sub.name,
          boundaryId: containerId,
        });
        seen.add(compId);
      }
    }
  }

  return elements;
}

function safeReadDir(dir: string): fs.Dirent[] {
  try {
    return fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}
