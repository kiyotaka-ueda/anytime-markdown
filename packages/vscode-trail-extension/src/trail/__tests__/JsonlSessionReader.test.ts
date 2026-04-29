import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { JsonlSessionReader } from '../JsonlSessionReader';

function writeTempJsonl(lines: readonly unknown[]): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jsonl-reader-'));
  const filePath = path.join(dir, 'session.jsonl');
  fs.writeFileSync(filePath, `${lines.map((l) => JSON.stringify(l)).join('\n')}\n`, 'utf-8');
  return filePath;
}

describe('JsonlSessionReader', () => {
  it('loads Claude-style JSONL messages', () => {
    const filePath = writeTempJsonl([
      {
        uuid: 'u1',
        type: 'assistant',
        timestamp: '2026-04-29T00:00:00.000Z',
        message: {
          content: [{ type: 'tool_use', id: 'c1', name: 'Read', input: { file_path: 'a.ts' } }],
        },
      },
      {
        uuid: 'u2',
        type: 'user',
        timestamp: '2026-04-29T00:00:01.000Z',
        message: { content: 'ok' },
      },
    ]);

    const messages = JsonlSessionReader.loadFromFile(filePath);
    expect(messages).toHaveLength(2);
    expect(messages[0]?.toolCalls?.[0]?.name).toBe('Read');
  });

  it('normalizes Codex-style response_item entries including developer/system roles', () => {
    const filePath = writeTempJsonl([
      { type: 'session_meta', payload: { id: '019dd7d7-1c62-77a1-880e-bbcfd32cd66c' } },
      {
        timestamp: '2026-04-29T00:00:00.000Z',
        type: 'response_item',
        payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'hello' }] },
      },
      {
        timestamp: '2026-04-29T00:00:01.000Z',
        type: 'response_item',
        payload: { type: 'message', role: 'developer', content: [{ type: 'input_text', text: 'developer-instruction' }] },
      },
      {
        timestamp: '2026-04-29T00:00:01.500Z',
        type: 'response_item',
        payload: { type: 'message', role: 'system', content: [{ type: 'input_text', text: 'system-instruction' }] },
      },
      {
        timestamp: '2026-04-29T00:00:02.000Z',
        type: 'response_item',
        payload: { type: 'function_call', call_id: 'call_1', name: 'exec_command', arguments: '{"cmd":"pwd"}' },
      },
      {
        timestamp: '2026-04-29T00:00:03.000Z',
        type: 'response_item',
        payload: { type: 'function_call_output', call_id: 'call_1', output: 'ok' },
      },
    ]);

    const messages = JsonlSessionReader.loadFromFile(filePath);
    expect(messages.length).toBeGreaterThanOrEqual(3);
    const assistantTool = messages.find((m) => m.type === 'assistant' && (m.toolCalls?.length ?? 0) > 0);
    expect(assistantTool?.toolCalls?.[0]?.name).toBe('exec_command');
    expect(messages.some((m) => m.type === 'system')).toBe(true);
  });
});
