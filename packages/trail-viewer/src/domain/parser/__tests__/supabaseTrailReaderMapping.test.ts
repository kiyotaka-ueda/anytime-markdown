import { SupabaseTrailReader } from '../../../hooks/SupabaseTrailReader';

describe('SupabaseTrailReader mapping', () => {
  it('maps session source into TrailSession', () => {
    const reader = new SupabaseTrailReader('http://localhost:54321', 'anon-key') as any;
    const session = reader.toTrailSession(
      {
        id: 's1',
        slug: 'slug-1',
        repo_name: 'repo',
        model: 'gpt-5',
        version: '0.1.0',
        start_time: '2026-04-30T00:00:00.000Z',
        end_time: '2026-04-30T00:10:00.000Z',
        message_count: 2,
        peak_context_tokens: null,
        initial_context_tokens: null,
        interruption_reason: null,
        interruption_context_tokens: null,
        compact_count: null,
        source: 'codex',
        trail_session_costs: [],
      },
      [],
      undefined,
      undefined,
    );

    expect(session.source).toBe('codex');
  });

  it('maps agent fields into TrailMessage', () => {
    const reader = new SupabaseTrailReader('http://localhost:54321', 'anon-key') as any;
    const message = reader.toTrailMessage({
      uuid: 'm1',
      parent_uuid: null,
      type: 'assistant',
      subtype: null,
      text_content: 'hi',
      user_content: null,
      tool_calls: null,
      model: 'gpt-5',
      stop_reason: null,
      input_tokens: 1,
      output_tokens: 2,
      cache_read_tokens: 3,
      cache_creation_tokens: 4,
      timestamp: '2026-04-30T00:00:01.000Z',
      is_sidechain: 0,
      agent_id: 'agent-123',
      agent_description: 'Codex delegation',
    });

    expect(message.agentId).toBe('agent-123');
    expect(message.agentDescription).toBe('Codex delegation');
  });

  it('propagates subAgentCount through toTrailSession', () => {
    const reader = new SupabaseTrailReader('http://localhost:54321', 'anon-key') as any;
    const session = reader.toTrailSession(
      {
        id: 's1',
        slug: 'slug-1',
        repo_name: 'repo',
        model: 'opus',
        version: '0.1.0',
        start_time: '2026-04-30T00:00:00.000Z',
        end_time: '2026-04-30T00:10:00.000Z',
        message_count: 2,
        peak_context_tokens: null,
        initial_context_tokens: null,
        interruption_reason: null,
        interruption_context_tokens: null,
        compact_count: null,
        source: 'claude_code',
        trail_session_costs: [],
      },
      [],
      undefined,
      3,
    );

    expect(session.subAgentCount).toBe(3);
  });

  it('omits subAgentCount when 0 or undefined', () => {
    const reader = new SupabaseTrailReader('http://localhost:54321', 'anon-key') as any;
    const baseRow = {
      id: 's1',
      slug: 'slug-1',
      repo_name: 'repo',
      model: 'opus',
      version: '0.1.0',
      start_time: '2026-04-30T00:00:00.000Z',
      end_time: '2026-04-30T00:10:00.000Z',
      message_count: 2,
      peak_context_tokens: null,
      initial_context_tokens: null,
      interruption_reason: null,
      interruption_context_tokens: null,
      compact_count: null,
      source: 'claude_code',
      trail_session_costs: [],
    };
    expect(reader.toTrailSession(baseRow, [], undefined, undefined).subAgentCount).toBeUndefined();
    expect(reader.toTrailSession(baseRow, [], undefined, 0).subAgentCount).toBeUndefined();
  });

  describe('extractWorkspace', () => {
    // extractWorkspace は SupabaseTrailReader の private メソッドなので any キャストでアクセス
    let reader: any;
    beforeEach(() => {
      reader = new SupabaseTrailReader('http://localhost:54321', 'anon-key') as any;
    });

    it('通常ワークスペースのパスを返す', () => {
      expect(reader.extractWorkspace('/home/node/.claude/projects/-anytime-lab/session.jsonl'))
        .toBe('/anytime-lab');
    });

    it('anytime-markdown ワークスペースのパスを返す', () => {
      expect(reader.extractWorkspace('/home/node/.claude/projects/-anytime-markdown/session.jsonl'))
        .toBe('/anytime-markdown');
    });

    it('--worktrees- suffix を除去して親ワークスペースを返す', () => {
      expect(reader.extractWorkspace(
        '/home/node/.claude/projects/-anytime-markdown--worktrees-feature-xyz/session.jsonl'
      )).toBe('/anytime-markdown');
    });

    it('--claude-worktrees- suffix を除去して親ワークスペースを返す', () => {
      expect(reader.extractWorkspace(
        '/home/node/.claude/projects/-anytime-markdown--claude-worktrees-feature-xyz/session.jsonl'
      )).toBe('/anytime-markdown');
    });

    it('Codex セッション（/projects/ なし）は undefined を返す', () => {
      expect(reader.extractWorkspace(
        '/home/node/.codex/sessions/2026/05/05/session.jsonl'
      )).toBeUndefined();
    });

    it('undefined は undefined を返す', () => {
      expect(reader.extractWorkspace(undefined)).toBeUndefined();
    });

    it('null は undefined を返す', () => {
      expect(reader.extractWorkspace(null)).toBeUndefined();
    });
  });

  it('file_path からワークスペースを導出して TrailSession にマッピングする', () => {
    const reader = new SupabaseTrailReader('http://localhost:54321', 'anon-key') as any;
    const session = reader.toTrailSession(
      {
        id: 's1',
        slug: 'slug-1',
        repo_name: 'anytime-markdown',
        model: 'claude-sonnet-4-6',
        version: '2.1.0',
        start_time: '2026-05-05T00:00:00.000Z',
        end_time: '2026-05-05T01:00:00.000Z',
        message_count: 5,
        peak_context_tokens: null,
        initial_context_tokens: null,
        interruption_reason: null,
        interruption_context_tokens: null,
        compact_count: null,
        source: 'claude_code',
        file_path: '/home/node/.claude/projects/-anytime-lab/session.jsonl',
        trail_session_costs: [],
      },
      [],
      undefined,
      undefined,
    );
    expect(session.workspace).toBe('/anytime-lab');
  });

  it('worktree セッションは親ワークスペースにマッピングされる', () => {
    const reader = new SupabaseTrailReader('http://localhost:54321', 'anon-key') as any;
    const session = reader.toTrailSession(
      {
        id: 's2',
        slug: 'slug-2',
        repo_name: 'anytime-markdown',
        model: 'claude-sonnet-4-6',
        version: '2.1.0',
        start_time: '2026-05-05T00:00:00.000Z',
        end_time: '2026-05-05T01:00:00.000Z',
        message_count: 3,
        peak_context_tokens: null,
        initial_context_tokens: null,
        interruption_reason: null,
        interruption_context_tokens: null,
        compact_count: null,
        source: 'claude_code',
        file_path: '/home/node/.claude/projects/-anytime-markdown--worktrees-feature-xyz/s2.jsonl',
        trail_session_costs: [],
      },
      [],
      undefined,
      undefined,
    );
    expect(session.workspace).toBe('/anytime-markdown');
  });
});
