import { SupabaseTrailReader } from '../../hooks/SupabaseTrailReader';

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
});
