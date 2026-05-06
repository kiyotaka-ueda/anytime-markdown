import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  TrailFilter,
  TrailMessage,
  TrailSession,
  TrailSessionCommit,
} from '../../domain/parser/types';
import {
  toTrailMessage,
  toTrailSession,
} from '../../domain/analytics/mappers';
import type {
  SessionDbRow,
  MessageDbRow,
  CommitDbRow,
} from '../types';

export class SessionReader {
  constructor(private readonly client: SupabaseClient) {}

  async getSessions(filters?: TrailFilter): Promise<readonly TrailSession[]> {
    let query = this.client
      .from('trail_sessions')
      .select('*, trail_session_costs(*)')
      .order('start_time', { ascending: false });

    if (filters?.model) {
      query = query.eq('model', filters.model);
    }
    if (filters?.dateRange) {
      query = query.gte('start_time', filters.dateRange.from).lte('start_time', filters.dateRange.to);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Supabase getSessions failed: ${error.message}`);

    const sessions = (data ?? []) as readonly SessionDbRow[];
    const sessionById = new Map(sessions.map((s) => [s.id, s] as const));
    const sessionIds = sessions.map((s) => s.id);
    // 互いに依存しない 2 つの補助 fetch を並列化。Phase 0 計測で /api/trail/sessions が
    // 581ms (目標 500ms) と +81ms 未達。1 ラウンドトリップぶん削減する。
    const [subAgentCounts, linkedCodexByParent] = await Promise.all([
      this.fetchSubAgentCountsForSessions(sessionIds),
      this.fetchLinkedCodexSessionIdsByParent(sessions),
    ]);
    const consumedCodexIds = new Set<string>();
    for (const ids of linkedCodexByParent.values()) {
      for (const id of ids) consumedCodexIds.add(id);
    }

    const visibleSessions = sessions.filter((s) => !(s.source === 'codex' && consumedCodexIds.has(s.id)));
    return visibleSessions.map((r) => {
      const linkedIds = linkedCodexByParent.get(r.id) ?? new Set<string>();
      let linkedMessageCount = 0;
      let linkedInput = 0;
      let linkedOutput = 0;
      let linkedCacheRead = 0;
      let linkedCacheCreation = 0;
      let linkedCost = 0;
      for (const linkedId of linkedIds) {
        const linked = sessionById.get(linkedId);
        if (!linked) continue;
        linkedMessageCount += linked.message_count ?? 0;
        for (const c of linked.trail_session_costs ?? []) {
          linkedInput += c.input_tokens;
          linkedOutput += c.output_tokens;
          linkedCacheRead += c.cache_read_tokens;
          linkedCacheCreation += c.cache_creation_tokens;
          linkedCost += c.estimated_cost_usd;
        }
      }
      const base = toTrailSession(r, [], undefined, subAgentCounts.get(r.id));
      return {
        ...base,
        messageCount: base.messageCount + linkedMessageCount,
        usage: {
          inputTokens: base.usage.inputTokens + linkedInput,
          outputTokens: base.usage.outputTokens + linkedOutput,
          cacheReadTokens: base.usage.cacheReadTokens + linkedCacheRead,
          cacheCreationTokens: base.usage.cacheCreationTokens + linkedCacheCreation,
        },
        estimatedCostUsd: (base.estimatedCostUsd ?? 0) + linkedCost,
      };
    });
  }

  async getMessages(sessionId: string): Promise<readonly TrailMessage[]> {
    const { data, error } = await this.client
      .from('trail_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('timestamp', { ascending: true });
    if (error) throw new Error(`Supabase getMessages failed: ${error.message}`);
    return (data ?? []).map((r: MessageDbRow) => toTrailMessage(r));
  }

  async getSessionCommits(sessionId: string): Promise<readonly TrailSessionCommit[]> {
    const { data, error } = await this.client
      .from('trail_session_commits')
      .select('*')
      .eq('session_id', sessionId);
    if (error) throw new Error(`Supabase getSessionCommits failed: ${error.message}`);
    return (data ?? []).map((r: CommitDbRow) => ({
      commitHash: r.commit_hash,
      commitMessage: r.commit_message,
      author: r.author,
      committedAt: r.committed_at,
      isAiAssisted: r.is_ai_assisted === 1,
      filesChanged: r.files_changed,
      linesAdded: r.lines_added,
      linesDeleted: r.lines_deleted,
      repoName: r.repo_name ?? '',
    }));
  }

  async searchMessages(query: string): Promise<readonly { sessionId: string; uuid: string; snippet: string }[]> {
    const { data, error } = await this.client
      .from('trail_messages')
      .select('uuid, session_id, text_content')
      .ilike('text_content', `%${query}%`)
      .limit(100);
    if (error) return [];
    return (data ?? []).map((r: { uuid: string; session_id: string; text_content: string | null }) => ({
      sessionId: r.session_id,
      uuid: r.uuid,
      snippet: (r.text_content ?? '').slice(0, 200),
    }));
  }

  private async fetchSubAgentCountsForSessions(sessionIds: readonly string[]): Promise<Map<string, number>> {
    const out = new Map<string, number>();
    if (sessionIds.length === 0) return out;
    const claudeTrackBySession = new Map<string, Set<string>>();
    const delegatedTrackBySession = new Map<string, Set<string>>();
    const agentCallCountBySession = new Map<string, number>();
    const BATCH = 200;
    for (let i = 0; i < sessionIds.length; i += BATCH) {
      const batchIds = sessionIds.slice(i, i + BATCH);
      const { data, error } = await this.client
        .from('trail_messages')
        .select('session_id, agent_id, tool_calls')
        .in('session_id', batchIds as string[])
        .eq('type', 'assistant');
      if (error) {
        console.warn(
          `[SupabaseTrailReader] fetchSubAgentCountsForSessions failed (sessionCount=${sessionIds.length}): ${error.message}`,
        );
        return out;
      }
      for (const row of (data ?? []) as Array<{ session_id: string; agent_id: string | null; tool_calls: string | null }>) {
        const sid = row.session_id;
        if (row.agent_id) {
          let set = claudeTrackBySession.get(sid);
          if (!set) {
            set = new Set();
            claudeTrackBySession.set(sid, set);
          }
          set.add(row.agent_id);
        }
        if (!row.tool_calls) continue;
        let calls: Array<{ name?: string; input?: Record<string, unknown> }> = [];
        try {
          calls = JSON.parse(row.tool_calls) as Array<{ name?: string; input?: Record<string, unknown> }>;
        } catch (parseError) {
          console.warn('SessionReader.fetchSubAgentCountsForSessions: failed to parse tool_calls', {
            context: { sessionId: sid, length: row.tool_calls?.length ?? 0 },
            error: parseError instanceof Error
              ? { message: parseError.message, stack: parseError.stack }
              : { value: String(parseError) },
          });
          continue;
        }
        const agentCall = calls.find((c) => c.name === 'Agent');
        if (!agentCall) continue;
        agentCallCountBySession.set(sid, (agentCallCountBySession.get(sid) ?? 0) + 1);
        if (!row.agent_id) {
          const subagentType = typeof agentCall.input?.subagent_type === 'string'
            ? agentCall.input.subagent_type
            : 'unknown';
          let set = delegatedTrackBySession.get(sid);
          if (!set) {
            set = new Set();
            delegatedTrackBySession.set(sid, set);
          }
          set.add(`delegated:${subagentType}`);
        }
      }
    }
    for (const sid of sessionIds) {
      const claudeTracks = claudeTrackBySession.get(sid)?.size ?? 0;
      const delegatedTracks = delegatedTrackBySession.get(sid)?.size ?? 0;
      const agentCalls = agentCallCountBySession.get(sid) ?? 0;
      const count = Math.max(agentCalls, claudeTracks + delegatedTracks);
      if (count > 0) out.set(sid, count);
    }
    return out;
  }

  private async fetchLinkedCodexSessionIdsByParent(
    sessions: readonly SessionDbRow[],
  ): Promise<Map<string, Set<string>>> {
    const out = new Map<string, Set<string>>();
    const parentSessions = sessions.filter((s) => s.source !== 'codex');
    if (parentSessions.length === 0) return out;

    const parentIds = parentSessions.map((s) => s.id);
    const allMarkerRows: Array<{ session_id: string; source_tool_assistant_uuid: string | null; timestamp: string | null }> = [];
    const BATCH = 200;
    for (let i = 0; i < parentIds.length; i += BATCH) {
      const batchIds = parentIds.slice(i, i + BATCH);
      const { data: batchRows, error: markerErr } = await this.client
        .from('trail_messages')
        .select('session_id, source_tool_assistant_uuid, timestamp')
        .in('session_id', batchIds as string[])
        .not('source_tool_assistant_uuid', 'is', null);
      if (markerErr) return out;
      if (batchRows) allMarkerRows.push(...(batchRows as typeof allMarkerRows));
    }
    const markerRows = allMarkerRows;

    const codexSessions = sessions
      .filter((s) => s.source === 'codex')
      .map((s) => ({
        id: s.id,
        repoName: s.repo_name ?? '',
        startMs: Date.parse(s.start_time),
        endMs: Date.parse(s.end_time),
      }))
      .filter((s) => Number.isFinite(s.startMs) && Number.isFinite(s.endMs));

    const parentRepoById = new Map(parentSessions.map((s) => [s.id, s.repo_name ?? ''] as const));
    for (const row of (markerRows ?? []) as Array<{ session_id: string; source_tool_assistant_uuid: string | null; timestamp: string | null }>) {
      if (!row.timestamp) continue;
      const sid = row.session_id;
      const t = Date.parse(row.timestamp);
      if (!Number.isFinite(t)) continue;
      const parentRepo = parentRepoById.get(sid) ?? '';
      const candidates = codexSessions.filter((s) => parentRepo === '' || s.repoName === parentRepo);
      let bestId: string | null = null;
      let bestScore = Number.POSITIVE_INFINITY;
      for (const c of candidates) {
        const inside = t >= (c.startMs - 5 * 60_000) && t <= (c.endMs + 5 * 60_000);
        const score = Math.abs(c.startMs - t);
        if (inside && score < bestScore) {
          bestScore = score;
          bestId = c.id;
        }
      }
      if (!bestId) {
        for (const c of candidates) {
          const score = Math.abs(c.startMs - t);
          if (score <= 60 * 60_000 && score < bestScore) {
            bestScore = score;
            bestId = c.id;
          }
        }
      }
      if (bestId) {
        let set = out.get(sid);
        if (!set) {
          set = new Set<string>();
          out.set(sid, set);
        }
        set.add(bestId);
      }
    }
    return out;
  }
}
