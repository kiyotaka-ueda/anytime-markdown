import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_ANALYZE_EXCLUDE_CONTENT } from './defaultContent';

export function seedAnalyzeExclude(workspaceRoot: string): boolean {
  const dir = path.join(workspaceRoot, '.trail');
  const file = path.join(dir, 'analyze-exclude');
  if (fs.existsSync(file)) return false;
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, DEFAULT_ANALYZE_EXCLUDE_CONTENT, 'utf-8');
  return true;
}
