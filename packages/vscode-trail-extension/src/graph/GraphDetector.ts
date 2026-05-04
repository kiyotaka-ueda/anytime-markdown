import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_EXCLUDE_DIRS = new Set([
  'node_modules',
  'dist',
  '.next',
  'out',
  'build',
  '.git',
  'coverage',
  '.vscode-test',
  '__tests__',
  '.worktrees',
]);
const CODE_EXTS = new Set(['.ts', '.tsx']);
const DOC_EXTS = new Set(['.md', '.txt']);

export class GraphDetector {
  private readonly excludeDirs: Set<string>;

  constructor(
    private readonly rootPath: string,
    extraExcludePatterns: readonly string[] = [],
  ) {
    this.excludeDirs = new Set(DEFAULT_EXCLUDE_DIRS);
    for (const p of extraExcludePatterns) {
      const trimmed = p.trim();
      if (trimmed) this.excludeDirs.add(trimmed);
    }
  }

  detectCodeFiles(): string[] {
    return this.walk(this.rootPath, (entry) => CODE_EXTS.has(path.extname(entry.name)));
  }

  detectDocFiles(): string[] {
    return this.walk(this.rootPath, (entry) => DOC_EXTS.has(path.extname(entry.name)));
  }

  detectFilesByName(name: string): string[] {
    return this.walk(this.rootPath, (entry) => entry.name === name);
  }

  private walk(dir: string, match: (entry: fs.Dirent) => boolean): string[] {
    const results: string[] = [];
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return results;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!this.excludeDirs.has(entry.name)) {
          results.push(...this.walk(path.join(dir, entry.name), match));
        }
      } else if (entry.isFile() && match(entry)) {
        results.push(path.join(dir, entry.name));
      }
    }
    return results;
  }
}
