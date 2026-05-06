import { parseSession } from '../parseSession';
import type { TrailSession, TrailMessage } from '../types';

// --- Test helpers ---

function makeUserLine(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    parentUuid: 'parent-1',
    isSidechain: false,
    type: 'user',
    message: { role: 'user', content: 'Hello' },
    uuid: 'user-1',
    timestamp: '2026-03-27T23:23:45.106Z',
    sessionId: 'session-1',
    version: '2.1.85',
    gitBranch: 'develop',
    isMeta: false,
    ...overrides,
  });
}

function makeAssistantLine(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    parentUuid: 'user-1',
    isSidechain: false,
    message: {
      model: 'claude-opus-4-6',
      role: 'assistant',
      content: [{ type: 'text', text: 'Hello back' }],
      usage: {
        input_tokens: 100,
        output_tokens: 50,
        cache_read_input_tokens: 200,
        cache_creation_input_tokens: 300,
      },
    },
    type: 'assistant',
    uuid: 'assistant-1',
    timestamp: '2026-03-27T23:24:57.304Z',
    sessionId: 'session-1',
    version: '2.1.85',
    gitBranch: 'develop',
    slug: 'async-wiggling-pony',
    ...overrides,
  });
}

function makeToolUseLine(): string {
  return JSON.stringify({
    parentUuid: 'assistant-1',
    isSidechain: false,
    message: {
      model: 'claude-opus-4-6',
      role: 'assistant',
      content: [
        {
          type: 'tool_use',
          id: 'toolu_01DFgMQg',
          name: 'Read',
          input: { file_path: '/path/to/file.md' },
        },
        { type: 'text', text: 'Reading file...' },
      ],
      usage: {
        input_tokens: 50,
        output_tokens: 25,
        cache_read_input_tokens: 100,
        cache_creation_input_tokens: 150,
      },
    },
    type: 'assistant',
    uuid: 'assistant-2',
    timestamp: '2026-03-27T23:25:10.000Z',
    sessionId: 'session-1',
    version: '2.1.85',
    gitBranch: 'develop',
    slug: 'async-wiggling-pony',
  });
}

describe('parseSession', () => {
  describe('user and assistant messages', () => {
    it('should parse user and assistant messages correctly', () => {
      const input = [makeUserLine(), makeAssistantLine()].join('\n');
      const { messages } = parseSession(input, 'my-project');

      expect(messages).toHaveLength(2);

      const userMsg = messages[0];
      expect(userMsg.type).toBe('user');
      expect(userMsg.uuid).toBe('user-1');
      expect(userMsg.userContent).toBe('Hello');
      expect(userMsg.isSidechain).toBe(false);

      const assistantMsg = messages[1];
      expect(assistantMsg.type).toBe('assistant');
      expect(assistantMsg.uuid).toBe('assistant-1');
      expect(assistantMsg.textContent).toBe('Hello back');
      expect(assistantMsg.model).toBe('claude-opus-4-6');
      expect(assistantMsg.usage).toEqual({
        inputTokens: 100,
        outputTokens: 50,
        cacheReadTokens: 200,
        cacheCreationTokens: 300,
      });
    });
  });

  describe('tool calls', () => {
    it('should extract tool calls from assistant content array', () => {
      const input = [makeUserLine(), makeToolUseLine()].join('\n');
      const { messages } = parseSession(input, 'my-project');

      const toolMsg = messages[1];
      expect(toolMsg.type).toBe('assistant');
      expect(toolMsg.toolCalls).toHaveLength(1);
      expect(toolMsg.toolCalls![0]).toEqual({
        id: 'toolu_01DFgMQg',
        name: 'Read',
        input: { file_path: '/path/to/file.md' },
      });
      expect(toolMsg.textContent).toBe('Reading file...');
    });
  });

  describe('skip rules', () => {
    it('should skip file-history-snapshot entries', () => {
      const snapshot = JSON.stringify({
        type: 'file-history-snapshot',
        messageId: '02e7e0d3',
        snapshot: {},
        isSnapshotUpdate: false,
      });
      const input = [snapshot, makeUserLine()].join('\n');
      const { messages } = parseSession(input, 'my-project');

      expect(messages).toHaveLength(1);
      expect(messages[0].type).toBe('user');
    });

    it('should skip isMeta messages', () => {
      const metaLine = makeUserLine({ isMeta: true, uuid: 'meta-1' });
      const normalLine = makeUserLine({ isMeta: false, uuid: 'user-2' });
      const input = [metaLine, normalLine].join('\n');
      const { messages } = parseSession(input, 'my-project');

      expect(messages).toHaveLength(1);
      expect(messages[0].uuid).toBe('user-2');
    });

    it('should skip system turn_duration messages', () => {
      const turnDuration = JSON.stringify({
        parentUuid: '0dc23ee3',
        type: 'system',
        subtype: 'turn_duration',
        durationMs: 425821,
        timestamp: '2026-03-27T23:31:58.232Z',
        uuid: '76d22e13',
        sessionId: 'session-1',
        version: '2.1.85',
        gitBranch: 'develop',
      });
      const input = [makeUserLine(), turnDuration].join('\n');
      const { messages } = parseSession(input, 'my-project');

      expect(messages).toHaveLength(1);
      expect(messages[0].type).toBe('user');
    });

    it('should skip last-prompt and queue-operation types', () => {
      const lastPrompt = JSON.stringify({ type: 'last-prompt', data: {} });
      const queueOp = JSON.stringify({ type: 'queue-operation', data: {} });
      const input = [lastPrompt, queueOp, makeUserLine()].join('\n');
      const { messages } = parseSession(input, 'my-project');

      expect(messages).toHaveLength(1);
    });
  });

  describe('session metadata', () => {
    it('should compute session metadata from messages', () => {
      const input = [makeUserLine(), makeAssistantLine()].join('\n');
      const { session } = parseSession(input, 'my-project');

      expect(session.id).toBe('session-1');
      expect(session.repoName).toBe('my-project');
      expect(session.gitBranch).toBe('develop');
      expect(session.version).toBe('2.1.85');
      expect(session.model).toBe('claude-opus-4-6');
      expect(session.startTime).toBe('2026-03-27T23:23:45.106Z');
      expect(session.endTime).toBe('2026-03-27T23:24:57.304Z');
      expect(session.messageCount).toBe(2);
    });

    it('should extract slug from assistant message', () => {
      const input = [makeUserLine(), makeAssistantLine()].join('\n');
      const { session } = parseSession(input, 'my-project');

      expect(session.slug).toBe('async-wiggling-pony');
    });
  });

  describe('token usage aggregation', () => {
    it('should aggregate token usage across all assistant messages', () => {
      const input = [
        makeUserLine(),
        makeAssistantLine(),
        makeToolUseLine(),
      ].join('\n');
      const { session } = parseSession(input, 'my-project');

      expect(session.usage).toEqual({
        inputTokens: 150, // 100 + 50
        outputTokens: 75, // 50 + 25
        cacheReadTokens: 300, // 200 + 100
        cacheCreationTokens: 450, // 300 + 150
      });
    });
  });

  describe('edge cases', () => {
    it('should handle empty input', () => {
      const { session, messages } = parseSession('', 'my-project');

      expect(messages).toHaveLength(0);
      expect(session.id).toBe('');
      expect(session.repoName).toBe('my-project');
      expect(session.messageCount).toBe(0);
      expect(session.usage).toEqual({
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheCreationTokens: 0,
      });
    });

    it('should skip malformed JSON lines gracefully', () => {
      const input = [
        'not valid json',
        '{incomplete',
        makeUserLine(),
      ].join('\n');
      const { messages } = parseSession(input, 'my-project');

      expect(messages).toHaveLength(1);
      expect(messages[0].type).toBe('user');
    });

    it('should handle user message with array content', () => {
      const userWithArray = makeUserLine({
        uuid: 'user-arr',
        message: {
          role: 'user',
          content: [{ type: 'text', text: 'array content' }],
        },
      });
      const input = userWithArray;
      const { messages } = parseSession(input, 'my-project');

      expect(messages).toHaveLength(1);
      // Array content for user messages is not extracted as userContent
      expect(messages[0].userContent).toBeUndefined();
    });
  });

  describe('subAgentCount', () => {
    it('counts Agent tool_use blocks (legacy parent-side count)', () => {
      const agentLine = JSON.stringify({
        parentUuid: 'user-1',
        type: 'assistant',
        uuid: 'assistant-agent',
        timestamp: '2026-03-27T23:24:00.000Z',
        sessionId: 'session-1',
        message: {
          role: 'assistant',
          content: [
            {
              type: 'tool_use',
              id: 'toolu_agent_1',
              name: 'Agent',
              input: { subagent_type: 'general-purpose', description: 'sub task' },
            },
          ],
        },
      });
      const input = [makeUserLine(), agentLine].join('\n');
      const { session } = parseSession(input, 'my-project');
      expect(session.subAgentCount).toBe(1);
    });

    it('counts codex delegation via sourceToolAssistantUUID (no Agent tool_use)', () => {
      // codex 委任マーカー (Bash 経由で codex を起動するとここに記録される)
      const codexMarker = JSON.stringify({
        parentUuid: 'assistant-1',
        type: 'user',
        uuid: 'codex-marker',
        timestamp: '2026-03-27T23:24:30.000Z',
        sessionId: 'session-1',
        sourceToolAssistantUUID: 'assistant-1',
        sourceToolUseID: 'tool-use-1',
        message: { role: 'user', content: 'codex result' },
      });
      const input = [makeUserLine(), makeAssistantLine(), codexMarker].join('\n');
      const { session } = parseSession(input, 'my-project');
      expect(session.subAgentCount).toBe(1);
    });

    it('combines parent-side and child-side counts (max)', () => {
      // 親側: 2 個の Agent tool_use（CC subagent 2 個）
      const parentAgents = JSON.stringify({
        parentUuid: 'user-1',
        type: 'assistant',
        uuid: 'assistant-parent',
        timestamp: '2026-03-27T23:24:00.000Z',
        sessionId: 'session-1',
        message: {
          role: 'assistant',
          content: [
            { type: 'tool_use', id: 't1', name: 'Agent', input: { subagent_type: 'Explore' } },
            { type: 'tool_use', id: 't2', name: 'Agent', input: { subagent_type: 'Plan' } },
          ],
        },
      });
      // 子側: 1 個の codex 委任マーカー（別 parent UUID）
      const codexMarker = JSON.stringify({
        parentUuid: 'assistant-other',
        type: 'user',
        uuid: 'codex-marker',
        timestamp: '2026-03-27T23:25:00.000Z',
        sessionId: 'session-1',
        sourceToolAssistantUUID: 'assistant-other',
        message: { role: 'user', content: 'codex result' },
      });
      const input = [makeUserLine(), parentAgents, codexMarker].join('\n');
      const { session } = parseSession(input, 'my-project');
      // agentToolCount=2, delegationParents.size=1 → max=2
      // (codex via Agent tool は agentToolCount に含まれており二重計上回避)
      expect(session.subAgentCount).toBe(2);
    });

    it('returns undefined when no agent activity', () => {
      const input = [makeUserLine(), makeAssistantLine()].join('\n');
      const { session } = parseSession(input, 'my-project');
      expect(session.subAgentCount).toBeUndefined();
    });
  });
});
