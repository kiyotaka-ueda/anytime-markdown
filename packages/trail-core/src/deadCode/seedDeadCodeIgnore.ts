import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_IGNORE_FILE_CONTENT } from './defaultIgnoreContent';

export function seedDeadCodeIgnore(workspaceRoot: string): boolean {
  const dir = path.join(workspaceRoot, '.trail');
  const file = path.join(dir, 'dead-code-ignore');
  if (fs.existsSync(file)) return false;
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, DEFAULT_IGNORE_FILE_CONTENT, 'utf-8');
  return true;
}
