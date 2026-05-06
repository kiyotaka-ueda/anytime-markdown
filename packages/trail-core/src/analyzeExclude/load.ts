import fs from 'node:fs';
import path from 'node:path';
import { parseAnalyzeExclude } from './parse';

export function loadAnalyzeExclude(workspaceRoot: string): string[] {
  const file = path.join(workspaceRoot, '.trail', 'analyze-exclude');
  try {
    const content = fs.readFileSync(file, 'utf-8');
    return parseAnalyzeExclude(content);
  } catch (err) {
    if (err instanceof Error && 'code' in err && (err as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw err;
  }
}
