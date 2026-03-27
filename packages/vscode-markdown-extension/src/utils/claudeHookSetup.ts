import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

const HOOK_ID = 'anytime-markdown';
const STATUS_FILE = path.join(os.tmpdir(), 'claude-code-status.json');
const CLAUDE_DIR = path.join(os.homedir(), '.claude');
const SETTINGS_PATH = path.join(CLAUDE_DIR, 'settings.json');

interface HookEntry {
  id?: string;
  matcher: string;
  command: string;
}

interface ClaudeSettings {
  hooks?: {
    PreToolUse?: HookEntry[];
    PostToolUse?: HookEntry[];
  };
  [key: string]: unknown;
}

export function getStatusFilePath(): string {
  return STATUS_FILE;
}

export function setupClaudeHooks(): boolean {
  if (!fs.existsSync(CLAUDE_DIR)) {
    return false;
  }

  let settings: ClaudeSettings = {};
  if (fs.existsSync(SETTINGS_PATH)) {
    try {
      settings = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf-8'));
    } catch {
      return false;
    }
  }

  settings.hooks ??= {};
  settings.hooks.PreToolUse ??= [];
  settings.hooks.PostToolUse ??= [];

  const hasPreHook = settings.hooks.PreToolUse.some(
    (h) => h.id === HOOK_ID
  );
  const hasPostHook = settings.hooks.PostToolUse.some(
    (h) => h.id === HOOK_ID
  );

  if (hasPreHook && hasPostHook) {
    return true;
  }

  // フックコマンド: stdin の JSON から tool_input.file_path を jq で取得
  const preCommand = `FP=$(jq -r '.tool_input.file_path // empty'); [ -n "$FP" ] && echo "{\\"editing\\":true,\\"file\\":\\"$FP\\",\\"timestamp\\":$(date +%s000)}" > ${STATUS_FILE}`;
  const postCommand = `FP=$(jq -r '.tool_input.file_path // empty'); [ -n "$FP" ] && echo "{\\"editing\\":false,\\"file\\":\\"$FP\\",\\"timestamp\\":$(date +%s000)}" > ${STATUS_FILE}`;

  if (!hasPreHook) {
    settings.hooks.PreToolUse.push({
      id: HOOK_ID,
      matcher: 'Edit|Write',
      command: preCommand,
    });
  }

  if (!hasPostHook) {
    settings.hooks.PostToolUse.push({
      id: HOOK_ID,
      matcher: 'Edit|Write',
      command: postCommand,
    });
  }

  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2));
  return true;
}
