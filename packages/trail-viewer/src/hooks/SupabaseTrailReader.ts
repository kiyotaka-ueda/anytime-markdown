import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type {
  CombinedData,
  CombinedPeriodMode,
  CombinedRangeDays,
  CostOptimizationData,
  ToolMetrics,
  TrailFilter,
  TrailMessage,
  TrailSession,
  TrailSessionCommit,
  TrailToolCall,
} from '../parser/types';
// AnalyticsData は trail-core の共通型を使用（React 依存を避け、server-safe にする）
import type { AnalyticsData, ITrailReader, TrailRelease } from '@anytime-markdown/trail-core/domain';
import { computeDeploymentFrequency, computeQualityMetrics, computeReleaseQualityTimeSeries } from '@anytime-markdown/trail-core/domain/metrics';
import type { DateRange, QualityMetrics, ReleaseQualityBucket } from '@anytime-markdown/trail-core/domain/metrics';
import { calculateCost } from '@anytime-markdown/trail-core/domain/engine';

// ---------------------------------------------------------------------------
// Row shapes returned by Supabase (snake_case DB columns)
// ---------------------------------------------------------------------------

interface SessionCostDbRow {
  readonly session_id: string;
  readonly model: string;
  readonly input_tokens: number;
  readonly output_tokens: number;
  readonly cache_read_tokens: number;
  readonly cache_creation_tokens: number;
  readonly estimated_cost_usd: number;
}

interface SessionDbRow {
  readonly id: string;
  readonly slug: string;
  readonly repo_name: string;
  readonly model: string;
  readonly version: string;
  readonly start_time: string;
  readonly end_time: string;
  readonly message_count: number;
  readonly peak_context_tokens: number | null;
  readonly initial_context_tokens: number | null;
  readonly interruption_reason: string | null;
  readonly interruption_context_tokens: number | null;
  readonly compact_count: number | null;
  readonly source?: 'claude_code' | 'codex' | null;
  readonly trail_session_costs?: readonly SessionCostDbRow[];
}

interface MessageDbRow {
  readonly uuid: string;
  readonly parent_uuid: string | null;
  readonly type: string;
  readonly subtype: string | null;
  readonly text_content: string | null;
  readonly user_content: string | null;
  readonly tool_calls: string | null;
  readonly model: string | null;
  readonly stop_reason: string | null;
  readonly input_tokens: number;
  readonly output_tokens: number;
  readonly cache_read_tokens: number;
  readonly cache_creation_tokens: number;
  readonly timestamp: string;
  readonly is_sidechain: number;
  readonly agent_id?: string | null;
  readonly agent_description?: string | null;
  readonly source_tool_assistant_uuid?: string | null;
}

interface CommitDbRow {
  readonly repo_name?: string | null;
  readonly commit_hash: string;
  readonly commit_message: string;
  readonly author: string;
  readonly committed_at: string;
  readonly is_ai_assisted: number;
  readonly files_changed: number;
  readonly lines_added: number;
  readonly lines_deleted: number;
}

// ---------------------------------------------------------------------------
// SupabaseTrailReader
// ---------------------------------------------------------------------------

export class SupabaseTrailReader implements ITrailReader {
  private readonly client: SupabaseClient;

  constructor(url: string, anonKey: string) {
    this.client = createClient(url, anonKey);
  }

  async getSessions(filters?: TrailFilter): Promise<readonly TrailSession[]> {
    let query = this.client
      .from('trail_sessions')
      .select('*, trail_session_costs(*)')
      .order('start_time', { ascending: false });

    if (filters?.repository) {
      query = query.eq('repo_name', filters.repository);
    }
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
    const subAgentCounts = await this.fetchSubAgentCountsForSessions(sessionIds);
    const linkedCodexByParent = await this.fetchLinkedCodexSessionIdsByParent(sessions);
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
      const base = this.toTrailSession(r, [], undefined, subAgentCounts.get(r.id));
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
        } catch {
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

  async getMessages(sessionId: string): Promise<readonly TrailMessage[]> {
    const { data, error } = await this.client
      .from('trail_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('timestamp', { ascending: true });
    if (error) throw new Error(`Supabase getMessages failed: ${error.message}`);
    return (data ?? []).map((r: MessageDbRow) => this.toTrailMessage(r));
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

  async getC4Model(): Promise<Record<string, unknown> | null> {
    const { data, error } = await this.client
      .from('trail_c4_models')
      .select('model_json')
      .eq('id', 'current')
      .single();
    if (error || !data) return null;
    try {
      return JSON.parse(data.model_json) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  async getAnalytics(): Promise<AnalyticsData | null> {
    const allSessions: Array<{ id: string; start_time?: string; end_time?: string }> = [];
    for (let offset = 0; ; offset += 1000) {
      const { data: batch, error } = await this.client
        .from('trail_sessions')
        .select('id,start_time,end_time')
        .range(offset, offset + 999);
      if (error) return null;
      if (!batch || batch.length === 0) break;
      allSessions.push(...(batch as typeof allSessions));
      if (batch.length < 1000) break;
    }
    if (allSessions.length === 0) return null;
    const sessions = allSessions;

    const allCommits: Array<{ repo_name?: string; committed_at?: string; lines_added: number; lines_deleted: number; files_changed: number; is_ai_assisted: number }> = [];
    for (let offset = 0; ; offset += 1000) {
      const { data: batch } = await this.client
        .from('trail_session_commits')
        .select('repo_name,committed_at,lines_added,lines_deleted,files_changed,is_ai_assisted')
        .order('committed_at', { ascending: true })
        .range(offset, offset + 999);
      if (!batch || batch.length === 0) break;
      allCommits.push(...(batch as typeof allCommits));
      if (batch.length < 1000) break;
    }

    // Build start_time lookup map from sessions
    const startBySessionId = new Map<string, string>();
    for (const s of sessions as Array<{ id: string; start_time?: string }>) {
      if (s.start_time) startBySessionId.set(s.id, s.start_time);
    }

    let totalInput = 0, totalOutput = 0, totalCacheRead = 0, totalCacheCreation = 0;
    let totalEstimatedCost = 0;
    type DailyEntry = { sessions: number; inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheCreationTokens: number; estimatedCostUsd: number; commits: number; linesAdded: number };
    const dailyMap = new Map<string, DailyEntry>();

    if (sessions.length > 0) {
      const getIanaOffsetMs = (timeZone: string, at: Date): number => {
        const parts = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' }).formatToParts(at);
        const label = parts.find(p => p.type === 'timeZoneName')?.value ?? 'GMT+00:00';
        const match = /^GMT([+-])(\d{1,2}):(\d{2})$/.exec(label);
        if (!match) return 0;
        return (match[1] === '+' ? 1 : -1) * (Number(match[2]) * 60 + Number(match[3])) * 60_000;
      };
      const toJSTDate = (isoStr: string): string => {
        const ms = new Date(isoStr).getTime();
        const jstMs = ms + getIanaOffsetMs('Asia/Tokyo', new Date(ms));
        const d = new Date(jstMs);
        return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
      };

      for (const s of sessions as Array<{ id: string; start_time?: string }>) {
        if (s.start_time) {
          const date = toJSTDate(s.start_time);
          const entry = dailyMap.get(date) ?? { sessions: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0, estimatedCostUsd: 0, commits: 0, linesAdded: 0 };
          entry.sessions += 1;
          dailyMap.set(date, entry);
        }
      }

      for (const c of allCommits) {
        if (c.committed_at) {
          const date = toJSTDate(c.committed_at);
          const entry = dailyMap.get(date) ?? { sessions: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0, estimatedCostUsd: 0, commits: 0, linesAdded: 0 };
          entry.commits += 1;
          entry.linesAdded += c.lines_added;
          dailyMap.set(date, entry);
        }
      }

      // Fetch session costs (no date limit — all sessions are synced).
      // trail_messages is limited to 7 days for privacy; trail_session_costs has no such limit
      // and already contains per-session token totals, so use it for the token chart.
      const allSessionCostRows: Array<{ session_id: string; input_tokens: number | null; output_tokens: number | null; cache_read_tokens: number | null; cache_creation_tokens: number | null; estimated_cost_usd: number | null }> = [];
      for (let offset = 0; ; offset += 1000) {
        const { data: batchRows } = await this.client
          .from('trail_session_costs')
          .select('session_id,input_tokens,output_tokens,cache_read_tokens,cache_creation_tokens,estimated_cost_usd')
          .range(offset, offset + 999);
        if (!batchRows || batchRows.length === 0) break;
        allSessionCostRows.push(...(batchRows as typeof allSessionCostRows));
        if (batchRows.length < 1000) break;
      }

      for (const c of allSessionCostRows) {
        const inp = c.input_tokens ?? 0;
        const out = c.output_tokens ?? 0;
        const crd = c.cache_read_tokens ?? 0;
        const ccr = c.cache_creation_tokens ?? 0;
        const cost = c.estimated_cost_usd ?? 0;

        totalInput += inp;
        totalOutput += out;
        totalCacheRead += crd;
        totalCacheCreation += ccr;
        totalEstimatedCost += cost;

        const start = startBySessionId.get(c.session_id);
        if (start) {
          const date = toJSTDate(start);
          const entry = dailyMap.get(date) ?? { sessions: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0, estimatedCostUsd: 0, commits: 0, linesAdded: 0 };
          entry.inputTokens += inp;
          entry.outputTokens += out;
          entry.cacheReadTokens += crd;
          entry.cacheCreationTokens += ccr;
          entry.estimatedCostUsd += cost;
          dailyMap.set(date, entry);
        }
      }
    }

    const dailyActivity = [...dailyMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date, ...v }));

    // Fetch current total LOC from current_coverage
    const { data: locData } = await this.client
      .from('trail_current_coverage')
      .select('lines_total');
    const totalLoc = (locData ?? []).reduce((s, r) => s + (r.lines_total ?? 0), 0);

    const totals = {
      sessions: sessions.length,
      inputTokens: totalInput,
      outputTokens: totalOutput,
      cacheReadTokens: totalCacheRead,
      cacheCreationTokens: totalCacheCreation,
      estimatedCostUsd: totalEstimatedCost,
      totalCommits: allCommits.length,
      totalLinesAdded: allCommits.reduce((s, c) => s + c.lines_added, 0),
      totalLinesDeleted: allCommits.reduce((s, c) => s + c.lines_deleted, 0),
      totalFilesChanged: allCommits.reduce((s, c) => s + c.files_changed, 0),
      totalAiAssistedCommits: allCommits.filter((c) => c.is_ai_assisted === 1).length,
      totalSessionDurationMs: sessions.reduce((s, r) => {
        if (!r.start_time || !r.end_time) return s;
        const start = new Date(r.start_time).getTime();
        const end = new Date(r.end_time).getTime();
        return s + (Number.isFinite(end - start) ? end - start : 0);
      }, 0),
      totalLoc,
      totalRetries: 0,
      totalEdits: 0,
      totalBuildRuns: 0,
      totalBuildFails: 0,
      totalTestRuns: 0,
      totalTestFails: 0,
    };

    return { totals, toolUsage: [], dailyActivity };
  }

  async getCostOptimization(): Promise<CostOptimizationData | null> {
    const { data, error } = await this.client
      .from('trail_daily_counts')
      .select('date,kind,key,estimated_cost_usd')
      .in('kind', ['cost_actual', 'cost_skill'])
      .order('date');
    if (error || !data) return null;

    const rows = data as readonly { date: string; kind: string; key: string; estimated_cost_usd: number }[];

    const actualByModel: Record<string, number> = {};
    const skillByModel: Record<string, number> = {};
    const dailyMap = new Map<string, { actualCost: number; skillCost: number }>();

    for (const r of rows) {
      const entry = dailyMap.get(r.date) ?? { actualCost: 0, skillCost: 0 };
      if (r.kind === 'cost_actual') {
        actualByModel[r.key] = (actualByModel[r.key] ?? 0) + r.estimated_cost_usd;
        entry.actualCost += r.estimated_cost_usd;
      } else if (r.kind === 'cost_skill') {
        skillByModel[r.key] = (skillByModel[r.key] ?? 0) + r.estimated_cost_usd;
        entry.skillCost += r.estimated_cost_usd;
      }
      dailyMap.set(r.date, entry);
    }

    const daily = [...dailyMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date, actualCost: v.actualCost, skillCost: v.skillCost }));

    const totalActual = Object.values(actualByModel).reduce((s, v) => s + v, 0);
    const totalSkill = Object.values(skillByModel).reduce((s, v) => s + v, 0);

    return {
      actual: { totalCost: totalActual, byModel: actualByModel },
      skillEstimate: { totalCost: totalSkill, byModel: skillByModel },
      daily,
      modelDistribution: { actual: actualByModel, skillRecommended: skillByModel },
    };
  }

  async getSessionToolMetrics(sessionId: string): Promise<ToolMetrics | null> {
    const { data, error } = await this.client
      .from('trail_messages')
      .select('tool_calls')
      .eq('session_id', sessionId)
      .not('tool_calls', 'is', null);
    if (error) return null;

    let totalRetries = 0;
    let totalEdits = 0;
    let totalBuildRuns = 0;
    let totalBuildFails = 0;
    let totalTestRuns = 0;
    let totalTestFails = 0;

    for (const row of data ?? []) {
      if (!row.tool_calls) continue;
      try {
        const calls = JSON.parse(row.tool_calls) as readonly { name?: string; error?: boolean }[];
        for (const call of calls) {
          const name = call.name ?? '';
          if (name === 'Retry') totalRetries++;
          if (name === 'Edit' || name === 'Write') totalEdits++;
          if (name === 'Bash' && totalBuildRuns >= 0) {
            // Approximation — count build/test by name heuristic
          }
          if (name.toLowerCase().includes('build')) {
            totalBuildRuns++;
            if (call.error) totalBuildFails++;
          }
          if (name.toLowerCase().includes('test')) {
            totalTestRuns++;
            if (call.error) totalTestFails++;
          }
        }
      } catch {
        // Skip unparseable tool_calls
      }
    }

    // ツール別利用統計を message_tool_calls + messages から集計
    const normalizeTool = (name: string): string => {
      if (!name.startsWith('mcp__')) return name;
      const parts = name.split('__');
      return parts.length >= 3 ? `${parts[0]}__${parts[1]}` : name;
    };
    const { data: tcData } = await this.client
      .from('trail_message_tool_calls')
      .select('message_uuid, turn_index, tool_name, skill_name, is_error, turn_exec_ms, model')
      .eq('session_id', sessionId);
    const tcRows = (tcData ?? []) as { message_uuid: string; turn_index: number; tool_name: string; skill_name: string | null; is_error: number; turn_exec_ms: number | null; model: string | null }[];

    // メッセージのトークン数を取得
    const msgUuids = [...new Set(tcRows.map(r => r.message_uuid))];
    const msgTokenMap = new Map<string, number>();
    const msgToolCount = new Map<string, number>();
    for (const r of tcRows) {
      msgToolCount.set(r.message_uuid, (msgToolCount.get(r.message_uuid) ?? 0) + 1);
    }
    for (let i = 0; i < msgUuids.length; i += 1000) {
      const batch = msgUuids.slice(i, i + 1000);
      const { data: msgData } = await this.client
        .from('trail_messages')
        .select('uuid, input_tokens, output_tokens')
        .in('uuid', batch);
      if (msgData) {
        for (const m of msgData as { uuid: string; input_tokens: number; output_tokens: number }[]) {
          msgTokenMap.set(m.uuid, (m.input_tokens ?? 0) + (m.output_tokens ?? 0));
        }
      }
    }
    // ターン内ツール数
    const turnToolCount = new Map<string, number>();
    for (const r of tcRows) {
      const tk = `${sessionId}:${r.turn_index}`;
      turnToolCount.set(tk, (turnToolCount.get(tk) ?? 0) + 1);
    }
    const toolAgg = new Map<string, { count: number; tokens: number; durationMs: number }>();
    for (const r of tcRows) {
      const tool = normalizeTool(r.tool_name);
      const e = toolAgg.get(tool) ?? { count: 0, tokens: 0, durationMs: 0 };
      e.count++;
      const mTokens = msgTokenMap.get(r.message_uuid) ?? 0;
      const mTools = msgToolCount.get(r.message_uuid) ?? 1;
      e.tokens += Math.round(mTokens / mTools);
      const tk = `${sessionId}:${r.turn_index}`;
      const tTools = turnToolCount.get(tk) ?? 1;
      e.durationMs += Math.round((r.turn_exec_ms ?? 0) / tTools);
      toolAgg.set(tool, e);
    }
    const toolUsage = [...toolAgg.entries()]
      .sort(([, a], [, b]) => b.count - a.count)
      .map(([tool, e]) => ({ tool, ...e }));

    // スキル別利用統計
    const skillAgg = new Map<string, { count: number; tokens: number; durationMs: number }>();
    for (const r of tcRows) {
      if (!r.skill_name) continue;
      const skill = r.skill_name;
      const e = skillAgg.get(skill) ?? { count: 0, tokens: 0, durationMs: 0 };
      e.count++;
      const mTokens = msgTokenMap.get(r.message_uuid) ?? 0;
      const mTools = msgToolCount.get(r.message_uuid) ?? 1;
      e.tokens += Math.round(mTokens / mTools);
      const tk = `${sessionId}:${r.turn_index}`;
      const tTools = turnToolCount.get(tk) ?? 1;
      e.durationMs += Math.round((r.turn_exec_ms ?? 0) / tTools);
      skillAgg.set(skill, e);
    }
    const skillUsage = [...skillAgg.entries()]
      .sort(([, a], [, b]) => b.count - a.count)
      .map(([skill, e]) => ({ skill, ...e }));

    // ツール別エラー回数（MCP 正規化）
    const errorAgg = new Map<string, number>();
    for (const r of tcRows) {
      if (!r.is_error) continue;
      const tool = normalizeTool(r.tool_name);
      errorAgg.set(tool, (errorAgg.get(tool) ?? 0) + 1);
    }
    const errorsByTool = [...errorAgg.entries()]
      .sort(([, a], [, b]) => b - a)
      .map(([tool, count]) => ({ tool, count }));

    // モデル別利用統計: count/tokens は assistant メッセージから、durationMs は turn_exec_ms をターン単位で集計
    const { data: modelMsgData } = await this.client
      .from('trail_messages')
      .select('uuid, model, input_tokens, output_tokens')
      .eq('session_id', sessionId)
      .eq('type', 'assistant')
      .not('model', 'is', null);
    const modelAgg = new Map<string, { count: number; tokens: number; durationMs: number }>();
    for (const m of (modelMsgData ?? []) as { uuid: string; model: string | null; input_tokens: number | null; output_tokens: number | null }[]) {
      if (!m.model) continue;
      const e = modelAgg.get(m.model) ?? { count: 0, tokens: 0, durationMs: 0 };
      e.count++;
      e.tokens += (m.input_tokens ?? 0) + (m.output_tokens ?? 0);
      modelAgg.set(m.model, e);
    }
    // turn_exec_ms はターン内全行で同一値。turn_index 単位で一度だけ加算する。
    const turnSeen = new Set<number>();
    for (const r of tcRows) {
      if (turnSeen.has(r.turn_index)) continue;
      turnSeen.add(r.turn_index);
      if (!r.model) continue;
      const e = modelAgg.get(r.model);
      if (e) e.durationMs += r.turn_exec_ms ?? 0;
    }
    const modelUsage = [...modelAgg.entries()]
      .sort(([, a], [, b]) => b.count - a.count)
      .map(([model, e]) => ({ model, ...e }));

    return { totalRetries, totalEdits, totalBuildRuns, totalBuildFails, totalTestRuns, totalTestFails, toolUsage, skillUsage, errorsByTool, modelUsage };
  }

  async getDayToolMetrics(date: string): Promise<ToolMetrics | null> {
    const { data, error } = await this.client
      .from('trail_daily_counts')
      .select('kind,key,count,tokens,duration_ms')
      .eq('date', date)
      .in('kind', ['tool', 'skill', 'error', 'model']);
    if (error || !data) return null;

    type Row = { kind: string; key: string; count: number; tokens: number; duration_ms: number };
    const rows = data as Row[];

    const toolMap = new Map<string, { count: number; tokens: number; durationMs: number }>();
    const skillMap = new Map<string, { count: number; tokens: number; durationMs: number }>();
    const errMap = new Map<string, number>();
    const modelMap = new Map<string, { count: number; tokens: number; durationMs: number }>();

    for (const r of rows) {
      if (r.kind === 'tool') {
        const e = toolMap.get(r.key) ?? { count: 0, tokens: 0, durationMs: 0 };
        e.count += r.count; e.tokens += r.tokens; e.durationMs += r.duration_ms;
        toolMap.set(r.key, e);
      } else if (r.kind === 'skill') {
        const e = skillMap.get(r.key) ?? { count: 0, tokens: 0, durationMs: 0 };
        e.count += r.count; e.tokens += r.tokens; e.durationMs += r.duration_ms;
        skillMap.set(r.key, e);
      } else if (r.kind === 'error') {
        errMap.set(r.key, (errMap.get(r.key) ?? 0) + r.count);
      } else if (r.kind === 'model') {
        const e = modelMap.get(r.key) ?? { count: 0, tokens: 0, durationMs: 0 };
        e.count += r.count; e.tokens += r.tokens; e.durationMs += r.duration_ms;
        modelMap.set(r.key, e);
      }
    }

    return {
      totalRetries: 0, totalEdits: 0, totalBuildRuns: 0, totalBuildFails: 0,
      totalTestRuns: 0, totalTestFails: 0,
      toolUsage: [...toolMap.entries()].map(([tool, e]) => ({ tool, ...e })).sort((a, b) => b.count - a.count),
      skillUsage: [...skillMap.entries()].map(([skill, e]) => ({ skill, ...e })).sort((a, b) => b.count - a.count),
      errorsByTool: [...errMap.entries()].map(([tool, count]) => ({ tool, count })).sort((a, b) => b.count - a.count),
      modelUsage: [...modelMap.entries()].map(([model, e]) => ({ model, ...e })).sort((a, b) => b.count - a.count),
    };
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

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private toTrailSession(
    r: SessionDbRow,
    commits: readonly CommitDbRow[],
    errorCount?: number,
    subAgentCount?: number,
  ): TrailSession {
    const commitStats = commits.length > 0
      ? {
          commits: commits.length,
          linesAdded: commits.reduce((s, c) => s + c.lines_added, 0),
          linesDeleted: commits.reduce((s, c) => s + c.lines_deleted, 0),
          filesChanged: commits.reduce((s, c) => s + c.files_changed, 0),
        }
      : undefined;

    // Aggregate costs from session_costs join
    const costs = r.trail_session_costs ?? [];
    const totalInput = costs.reduce((s, c) => s + c.input_tokens, 0);
    const totalOutput = costs.reduce((s, c) => s + c.output_tokens, 0);
    const totalCacheRead = costs.reduce((s, c) => s + c.cache_read_tokens, 0);
    const totalCacheCreation = costs.reduce((s, c) => s + c.cache_creation_tokens, 0);
    const totalCostUsd = costs.reduce((s, c) => s + c.estimated_cost_usd, 0);

    return {
      id: r.id,
      slug: r.slug,
      repoName: r.repo_name ?? '',
      gitBranch: '',
      startTime: r.start_time,
      endTime: r.end_time,
      version: r.version,
      model: r.model,
      messageCount: r.message_count,
      peakContextTokens: r.peak_context_tokens ?? undefined,
      initialContextTokens: r.initial_context_tokens ?? undefined,
      interruption: r.interruption_reason
        ? {
            interrupted: true,
            reason: r.interruption_reason as 'max_tokens' | 'no_response',
            contextTokens: r.interruption_context_tokens ?? 0,
          }
        : undefined,
      compactCount: r.compact_count && r.compact_count > 0 ? r.compact_count : undefined,
      source: r.source ?? undefined,
      commitStats,
      usage: {
        inputTokens: totalInput,
        outputTokens: totalOutput,
        cacheReadTokens: totalCacheRead,
        cacheCreationTokens: totalCacheCreation,
      },
      estimatedCostUsd: totalCostUsd,
      errorCount: errorCount && errorCount > 0 ? errorCount : undefined,
      subAgentCount: subAgentCount && subAgentCount > 0 ? subAgentCount : undefined,
    };
  }

  private toTrailMessage(r: MessageDbRow): TrailMessage {
    let toolCalls: readonly TrailToolCall[] | undefined;
    if (r.tool_calls) {
      try {
        toolCalls = JSON.parse(r.tool_calls) as readonly TrailToolCall[];
      } catch {
        // ignore parse errors
      }
    }

    return {
      uuid: r.uuid,
      parentUuid: r.parent_uuid,
      type: r.type as 'user' | 'assistant' | 'system',
      subtype: r.subtype ?? undefined,
      timestamp: r.timestamp,
      isSidechain: r.is_sidechain === 1,
      model: r.model ?? undefined,
      toolCalls,
      textContent: r.text_content ?? undefined,
      userContent: r.user_content ?? undefined,
      stopReason: r.stop_reason,
      usage: {
        inputTokens: r.input_tokens,
        outputTokens: r.output_tokens,
        cacheReadTokens: r.cache_read_tokens,
        cacheCreationTokens: r.cache_creation_tokens,
      },
      agentId: r.agent_id ?? undefined,
      agentDescription: r.agent_description ?? undefined,
    };
  }

  async getReleases(): Promise<readonly TrailRelease[]> {
    const { data, error } = await this.client
      .from('trail_releases')
      .select('*')
      .order('released_at', { ascending: false });
    if (error || !data) return [];
    return (data as readonly {
      tag: string; released_at: string; prev_tag: string | null;
      repo_name: string | null;
      package_tags: string; commit_count: number;
      files_changed: number; lines_added: number; lines_deleted: number;
      feat_count: number; fix_count: number; refactor_count: number;
      test_count: number; other_count: number;
      affected_packages: string; duration_days: number;
    }[]).map((r) => ({
      tag: r.tag,
      releasedAt: r.released_at,
      prevTag: r.prev_tag,
      repoName: r.repo_name,
      packageTags: JSON.parse(r.package_tags) as string[],
      commitCount: r.commit_count,
      filesChanged: r.files_changed,
      linesAdded: r.lines_added,
      linesDeleted: r.lines_deleted,
      featCount: r.feat_count,
      fixCount: r.fix_count,
      refactorCount: r.refactor_count,
      testCount: r.test_count,
      otherCount: r.other_count,
      affectedPackages: JSON.parse(r.affected_packages) as string[],
      durationDays: r.duration_days,
    }));
  }

  async getCombinedData(period: CombinedPeriodMode, rangeDays: CombinedRangeDays): Promise<CombinedData | null> {
    try {
      // daily_counts の date は JST (YYYY-MM-DD)。
      // cutoff も JST 日付文字列で比較する。
      const getIanaOffsetMs = (timeZone: string, at: Date): number => {
        const parts = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' }).formatToParts(at);
        const label = parts.find(p => p.type === 'timeZoneName')?.value ?? 'GMT+00:00';
        const match = /^GMT([+-])(\d{1,2}):(\d{2})$/.exec(label);
        if (!match) return 0;
        const sign = match[1] === '+' ? 1 : -1;
        return sign * (Number(match[2]) * 60 + Number(match[3])) * 60_000;
      };
      const cutoffMs = Date.now() - rangeDays * 86_400_000;
      const cutoffIso = new Date(cutoffMs).toISOString();
      const cutoffLocal = new Date(cutoffMs + getIanaOffsetMs('Asia/Tokyo', new Date(cutoffMs)));
      const cutoffDate = `${cutoffLocal.getUTCFullYear()}-${String(cutoffLocal.getUTCMonth() + 1).padStart(2, '0')}-${String(cutoffLocal.getUTCDate()).padStart(2, '0')}`;

      // Fetch all 4 kinds from trail_daily_counts with pagination
      type DcRow = { date: string; kind: string; key: string; count: number; tokens: number; duration_ms: number };
      const allDcRows: DcRow[] = [];
      for (let offset = 0; ; offset += 1000) {
        const { data: batchRows, error: batchErr } = await this.client
          .from('trail_daily_counts')
          .select('date,kind,key,count,tokens,duration_ms')
          .in('kind', ['skill', 'error', 'tool', 'model'])
          .gte('date', cutoffDate)
          .range(offset, offset + 999);
        if (batchErr || !batchRows || batchRows.length === 0) break;
        allDcRows.push(...(batchRows as DcRow[]));
        if (batchRows.length < 1000) break;
      }

      const getMonday = (dateStr: string): string => {
        const [y, m, d] = dateStr.split('-').map(Number);
        const dt = new Date(Date.UTC(y!, m! - 1, d!));
        const diffToMonday = (dt.getUTCDay() + 6) % 7;
        const monday = new Date(dt.getTime() - diffToMonday * 86_400_000);
        return `${monday.getUTCFullYear()}-${String(monday.getUTCMonth() + 1).padStart(2, '0')}-${String(monday.getUTCDate()).padStart(2, '0')}`;
      };
      const periodKey = (dateStr: string): string =>
        period === 'week' ? getMonday(dateStr) : dateStr;
      const toJSTDate = (isoStr: string): string => {
        const ms = new Date(isoStr).getTime();
        const jstMs = ms + getIanaOffsetMs('Asia/Tokyo', new Date(ms));
        const d = new Date(jstMs);
        return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
      };
      const normalizeTool = (name: string): string => {
        if (!name.startsWith('mcp__')) return name;
        const parts = name.split('__');
        return parts.length >= 3 ? `${parts[0]}__${parts[1]}` : name;
      };

      const errMap = new Map<string, { err: number; total: number; byTool: Record<string, number> }>();
      const skillMap = new Map<string, number>();
      // tool: key = `${periodKey}|${toolName}`, value = { count, tokens, durationMs }
      const toolDcMap = new Map<string, { count: number; tokens: number; durationMs: number }>();
      // model: key = `${periodKey}::${modelName}`, value = { count, tokens }
      const modelDcMap = new Map<string, { count: number; tokens: number }>();

      for (const r of allDcRows) {
        const p = periodKey(r.date);
        if (r.kind === 'error') {
          const ef = errMap.get(p) ?? { err: 0, total: 0, byTool: {} };
          ef.err += r.count;
          ef.byTool[r.key] = (ef.byTool[r.key] ?? 0) + r.count;
          errMap.set(p, ef);
        } else if (r.kind === 'skill') {
          const k = `${p}::${r.key}`;
          skillMap.set(k, (skillMap.get(k) ?? 0) + r.count);
        } else if (r.kind === 'tool') {
          const k = `${p}|${normalizeTool(r.key)}`;
          const cur = toolDcMap.get(k) ?? { count: 0, tokens: 0, durationMs: 0 };
          cur.count += r.count;
          cur.tokens += r.tokens ?? 0;
          cur.durationMs += r.duration_ms ?? 0;
          toolDcMap.set(k, cur);
        } else if (r.kind === 'model') {
          const k = `${p}::${r.key}`;
          const cur = modelDcMap.get(k) ?? { count: 0, tokens: 0 };
          cur.count += r.count;
          cur.tokens += r.tokens ?? 0;
          modelDcMap.set(k, cur);
        }
      }

      // Populate errMap.total from tool daily_counts
      for (const [k, e] of toolDcMap.entries()) {
        const p = k.slice(0, k.indexOf('|'));
        const ef = errMap.get(p) ?? { err: 0, total: 0, byTool: {} };
        ef.total += e.count;
        errMap.set(p, ef);
      }

      const splitKey = (k: string): [string, string] => {
        const sep = k.indexOf('::');
        return [k.slice(0, sep), k.slice(sep + 2)];
      };

      const errorRate = [...errMap.entries()]
        .filter(([, e]) => e.total > 0)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([p, e]) => ({ period: p, rate: e.err / e.total, byTool: e.byTool }));

      const skillStats = [...skillMap.entries()]
        .map(([k, count]) => { const [p, skill] = splitKey(k); return { period: p, skill, count, costUsd: 0 }; })
        .sort((a, b) => a.period.localeCompare(b.period));

      // Paginated fetch of trail_sessions within the period window
      const sourceBySessionId = new Map<string, string>();
      const sessionStartById = new Map<string, string>();
      for (let offset = 0; ; offset += 1000) {
        const { data: batchRows } = await this.client
          .from('trail_sessions')
          .select('id,source,start_time')
          .gte('start_time', cutoffIso)
          .range(offset, offset + 999);
        if (!batchRows || batchRows.length === 0) break;
        for (const s of batchRows as Array<{ id: string; source: string | null; start_time?: string | null }>) {
          const source = s.source === 'codex' ? 'Codex' : 'Claude Code';
          sourceBySessionId.set(s.id, source);
          if (s.start_time) sessionStartById.set(s.id, s.start_time);
        }
        if (batchRows.length < 1000) break;
      }

      // agentStats: tokens + cost from session_costs (all-time, paginated), LOC from session_commits
      const agentMap = new Map<string, { tokens: number; costUsd: number; loc: number }>();
      const addAgent = (periodKeyStr: string, agent: string, delta: Partial<{ tokens: number; costUsd: number; loc: number }>) => {
        const k = `${periodKeyStr}::${agent}`;
        const cur = agentMap.get(k) ?? { tokens: 0, costUsd: 0, loc: 0 };
        cur.tokens += delta.tokens ?? 0;
        cur.costUsd += delta.costUsd ?? 0;
        cur.loc += delta.loc ?? 0;
        agentMap.set(k, cur);
      };

      for (let offset = 0; ; offset += 1000) {
        const { data: batchRows } = await this.client
          .from('trail_session_costs')
          .select('session_id,input_tokens,output_tokens,cache_read_tokens,cache_creation_tokens,estimated_cost_usd')
          .range(offset, offset + 999);
        if (!batchRows || batchRows.length === 0) break;
        for (const c of batchRows as Array<{ session_id: string; input_tokens: number | null; output_tokens: number | null; cache_read_tokens: number | null; cache_creation_tokens: number | null; estimated_cost_usd: number | null }>) {
          const agent = sourceBySessionId.get(c.session_id);
          if (!agent) continue;
          const start = sessionStartById.get(c.session_id);
          if (!start) continue;
          const p = periodKey(toJSTDate(start));
          const tokens = (c.input_tokens ?? 0) + (c.output_tokens ?? 0) + (c.cache_read_tokens ?? 0) + (c.cache_creation_tokens ?? 0);
          addAgent(p, agent, { tokens, costUsd: c.estimated_cost_usd ?? 0 });
        }
        if (batchRows.length < 1000) break;
      }

      for (let offset = 0; ; offset += 1000) {
        const { data: batchRows } = await this.client
          .from('trail_session_commits')
          .select('session_id,committed_at,lines_added')
          .gte('committed_at', cutoffIso)
          .range(offset, offset + 999);
        if (!batchRows || batchRows.length === 0) break;
        for (const c of batchRows as Array<{ session_id: string; committed_at: string; lines_added: number | null }>) {
          const agent = sourceBySessionId.get(c.session_id);
          if (!agent) continue;
          const p = periodKey(toJSTDate(c.committed_at));
          addAgent(p, agent, { loc: c.lines_added ?? 0 });
        }
        if (batchRows.length < 1000) break;
      }

      const toolCounts = [...toolDcMap.entries()].map(([k, e]) => {
        const sep = k.indexOf('|');
        return {
          period: k.slice(0, sep),
          tool: k.slice(sep + 1),
          count: e.count,
          tokens: e.tokens,
          durationMs: e.durationMs,
          tokenMissingRate: 0,
          tokenTotalTurns: 0,
          tokenMissingTurns: 0,
        };
      }).sort((a, b) => a.period.localeCompare(b.period) || b.count - a.count);

      const agentStats = [...agentMap.entries()]
        .map(([k, v]) => {
          const [p, agent] = splitKey(k);
          return {
            period: p,
            agent,
            tokens: v.tokens,
            costUsd: v.costUsd,
            loc: v.loc,
            tokenMissingRate: 0,
            tokenTotalTurns: 0,
            tokenMissingTurns: 0,
          };
        })
        .sort((a, b) => a.period.localeCompare(b.period) || a.agent.localeCompare(b.agent));

      const modelStats = [...modelDcMap.entries()].map(([k, v]) => {
        const sep = k.indexOf('::');
        return {
          period: k.slice(0, sep),
          model: k.slice(sep + 2),
          count: v.count,
          tokens: v.tokens,
          tokenMissingRate: 0,
          tokenTotalTurns: 0,
          tokenMissingTurns: 0,
        };
      }).sort((a, b) => a.period.localeCompare(b.period) || b.count - a.count);

      const extractPrefix = (subject: string): string => {
        const m = /^([a-z]+)(?:\([^)]*\))?!?:\s/i.exec(subject);
        return m ? m[1].toLowerCase() : 'other';
      };
      const seenHashes = new Set<string>();
      const prefixMap = new Map<string, { count: number; linesAdded: number }>();
      for (let offset = 0; ; offset += 1000) {
        const { data: batchRows } = await this.client
          .from('trail_session_commits')
          .select('repo_name,commit_hash,commit_message,committed_at,lines_added')
          .gte('committed_at', cutoffIso)
          .order('committed_at', { ascending: true })
          .range(offset, offset + 999);
        if (!batchRows || batchRows.length === 0) break;
        for (const c of batchRows as Array<{ repo_name: string | null; commit_hash: string; commit_message: string; committed_at: string; lines_added: number }>) {
          const identity = `${c.repo_name ?? ''}:${c.commit_hash}`;
          if (seenHashes.has(identity)) continue;
          seenHashes.add(identity);
          const subject = (c.commit_message ?? '').split('\n')[0];
          const prefix = extractPrefix(subject);
          const p = periodKey(toJSTDate(c.committed_at));
          const commitKey = `${p}::${prefix}`;
          const e = prefixMap.get(commitKey) ?? { count: 0, linesAdded: 0 };
          e.count++;
          e.linesAdded += c.lines_added ?? 0;
          prefixMap.set(commitKey, e);
        }
        if (batchRows.length < 1000) break;
      }

      const commitPrefixStats = [...prefixMap.entries()]
        .map(([k, e]) => { const [p, prefix] = splitKey(k); return { period: p, prefix, count: e.count, linesAdded: e.linesAdded }; })
        .sort((a, b) => a.period.localeCompare(b.period));

      return { toolCounts, errorRate, skillStats, modelStats, agentStats, commitPrefixStats, aiFirstTryRate: [] };
    } catch {
      return null;
    }
  }

  async getQualityMetrics(range: DateRange): Promise<QualityMetrics> {
    // Compute previous range (same duration immediately before current range).
    const fromMs = new Date(range.from).getTime();
    const toMs = new Date(range.to).getTime();
    const duration = toMs - fromMs;
    const prevTo = new Date(fromMs - 1).toISOString();
    const prevFrom = new Date(fromMs - 1 - duration).toISOString();

    type ReleaseRow = { tag: string; released_at: string; fix_count: number };
    type MessageRow = {
      uuid: string;
      timestamp: string;
      type: string;
      session_id: string;
      input_tokens: number;
      output_tokens: number;
      cache_read_tokens: number;
      cache_creation_tokens: number;
    };
    type CommitRow = {
      repo_name: string | null;
      commit_hash: string;
      commit_message: string;
      committed_at: string;
      session_id: string;
      is_ai_assisted: number;
      lines_added: number;
      lines_deleted: number;
    };

    const fetchReleases = async (f: string, t: string): Promise<ReleaseRow[]> => {
      const { data } = await this.client
        .from('trail_releases')
        .select('tag, released_at, fix_count')
        .gte('released_at', f)
        .lte('released_at', t);
      return (data ?? []) as ReleaseRow[];
    };
    const fetchMessagesBySessionIds = async (sessionIds: string[]): Promise<MessageRow[]> => {
      if (sessionIds.length === 0) return [];
      const SESSION_BATCH = 200;
      const PAGE_SIZE = 1000;
      const results: MessageRow[] = [];
      for (let i = 0; i < sessionIds.length; i += SESSION_BATCH) {
        const batchIds = sessionIds.slice(i, i + SESSION_BATCH);
        let offset = 0;
        while (true) {
          const { data } = await this.client
            .from('trail_messages')
            .select('uuid, timestamp, type, session_id, input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens')
            .eq('type', 'user')
            .in('session_id', batchIds)
            .order('timestamp', { ascending: true })
            .range(offset, offset + PAGE_SIZE - 1);
          const rows = (data ?? []) as MessageRow[];
          results.push(...rows);
          if (rows.length < PAGE_SIZE) break;
          offset += PAGE_SIZE;
        }
      }
      return results;
    };
    const fetchSessionSources = async (sessionIds: string[]): Promise<Map<string, 'claude_code' | 'codex'>> => {
      if (sessionIds.length === 0) return new Map();
      const SESSION_BATCH = 200;
      const sourceMap = new Map<string, 'claude_code' | 'codex'>();
      for (let i = 0; i < sessionIds.length; i += SESSION_BATCH) {
        const batchIds = sessionIds.slice(i, i + SESSION_BATCH);
        const { data } = await this.client
          .from('trail_sessions')
          .select('id, source')
          .in('id', batchIds);
        for (const row of (data ?? []) as Array<{ id: string; source: 'claude_code' | 'codex' }>) {
          sourceMap.set(row.id, row.source);
        }
      }
      return sourceMap;
    };
    const fetchAssistantMessages = async (f: string, t: string) => {
      type AssistantRow = {
        session_id: string;
        timestamp: string;
        input_tokens: number;
        output_tokens: number;
        cache_read_tokens: number;
        cache_creation_tokens: number;
        model: string | null;
      };
      const PAGE_SIZE = 1000;
      const results: AssistantRow[] = [];
      let offset = 0;
      while (true) {
        const { data } = await this.client
          .from('trail_messages')
          .select('session_id, timestamp, input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens, model')
          .eq('type', 'assistant')
          .gte('timestamp', f)
          .lte('timestamp', t)
          .order('timestamp', { ascending: true })
          .range(offset, offset + PAGE_SIZE - 1);
        const rows = (data ?? []) as AssistantRow[];
        results.push(...rows);
        if (rows.length < PAGE_SIZE) break;
        offset += PAGE_SIZE;
      }
      return results;
    };
    const fetchCommits = async (f: string, t: string): Promise<CommitRow[]> => {
      const PAGE_SIZE = 1000;
      const results: CommitRow[] = [];
      let offset = 0;
      while (true) {
        const { data } = await this.client
          .from('trail_session_commits')
          .select('repo_name, commit_hash, commit_message, committed_at, session_id, is_ai_assisted, lines_added, lines_deleted')
          .gte('committed_at', f)
          .lte('committed_at', t)
          .order('committed_at', { ascending: true })
          .range(offset, offset + PAGE_SIZE - 1);
        const rows = (data ?? []) as CommitRow[];
        results.push(...rows);
        if (rows.length < PAGE_SIZE) break;
        offset += PAGE_SIZE;
      }
      return results;
    };
    const fetchFilesByHashes = async (hashes: string[]): Promise<Map<string, string[]>> => {
      if (hashes.length === 0) return new Map();
      const BATCH = 200;
      const map = new Map<string, string[]>();
      for (let i = 0; i < hashes.length; i += BATCH) {
        const { data } = await this.client
          .from('trail_commit_files')
          .select('repo_name, commit_hash, file_path')
          .in('commit_hash', hashes.slice(i, i + BATCH));
        for (const { repo_name, commit_hash, file_path } of (data ?? []) as Array<{ repo_name: string | null; commit_hash: string; file_path: string }>) {
          const key = `${repo_name ?? ''}:${commit_hash}`;
          const arr = map.get(key);
          if (arr) arr.push(file_path);
          else map.set(key, [file_path]);
        }
      }
      return map;
    };

    const aggregateTokensByUser = (
      users: ReadonlyArray<MessageRow>,
      assistants: ReadonlyArray<{ session_id: string; timestamp: string; input_tokens: number; output_tokens: number; cache_read_tokens: number; cache_creation_tokens: number; model: string | null }>,
      sourceBySessionId: ReadonlyMap<string, 'claude_code' | 'codex'>,
    ): Map<string, { input: number; output: number; cr: number; cc: number; cost: number }> => {
      const usersBySession = new Map<string, MessageRow[]>();
      for (const u of users) {
        const arr = usersBySession.get(u.session_id);
        if (arr) arr.push(u);
        else usersBySession.set(u.session_id, [u]);
      }
      for (const arr of usersBySession.values()) {
        arr.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
      }
      const tokensByUuid = new Map<string, { input: number; output: number; cr: number; cc: number; cost: number }>();
      for (const u of users) tokensByUuid.set(u.uuid, { input: 0, output: 0, cr: 0, cc: 0, cost: 0 });
      for (const a of assistants) {
        const sessionUsers = usersBySession.get(a.session_id);
        if (!sessionUsers) continue;
        let lo = 0;
        let hi = sessionUsers.length - 1;
        let idx = -1;
        while (lo <= hi) {
          const mid = (lo + hi) >>> 1;
          if (sessionUsers[mid].timestamp <= a.timestamp) {
            idx = mid;
            lo = mid + 1;
          } else {
            hi = mid - 1;
          }
        }
        if (idx === -1) continue;
        const t = tokensByUuid.get(sessionUsers[idx].uuid);
        if (!t) continue;
        const inputToks = a.input_tokens ?? 0;
        const outputToks = a.output_tokens ?? 0;
        const crToks = a.cache_read_tokens ?? 0;
        const ccToks = a.cache_creation_tokens ?? 0;
        t.input += inputToks;
        t.output += outputToks;
        t.cr += crToks;
        t.cc += ccToks;
        t.cost += calculateCost(a.model ?? '', {
          inputTokens: inputToks,
          outputTokens: outputToks,
          cacheReadTokens: crToks,
          cacheCreationTokens: ccToks,
        }, sourceBySessionId.get(a.session_id));
      }
      return tokensByUuid;
    };

    const [curReleases, curCommits, prevReleases, prevCommits] = await Promise.all([
      fetchReleases(range.from, range.to),
      fetchCommits(range.from, range.to),
      fetchReleases(prevFrom, prevTo),
      fetchCommits(prevFrom, prevTo),
    ]);

    const curSessionIds = [...new Set(curCommits.map((c) => c.session_id))];
    const prevSessionIds = [...new Set(prevCommits.map((c) => c.session_id))];

    const [curMessages, curAssistants, curFilesByHash, prevMessages, prevAssistants, prevFilesByHash, curSources, prevSources] = await Promise.all([
      fetchMessagesBySessionIds(curSessionIds),
      fetchAssistantMessages(range.from, range.to),
      fetchFilesByHashes(curCommits.map((c) => c.commit_hash)),
      fetchMessagesBySessionIds(prevSessionIds),
      fetchAssistantMessages(prevFrom, prevTo),
      fetchFilesByHashes(prevCommits.map((c) => c.commit_hash)),
      fetchSessionSources(curSessionIds),
      fetchSessionSources(prevSessionIds),
    ]);

    const curTokens = aggregateTokensByUser(curMessages, curAssistants, curSources);
    const prevTokens = aggregateTokensByUser(prevMessages, prevAssistants, prevSources);
    return computeQualityMetrics(
      {
        releases: curReleases.map((r) => ({ id: r.tag, tag_date: r.released_at, commit_hashes: [], fix_count: r.fix_count })),
        messages: curMessages.map((m) => {
          const t = curTokens.get(m.uuid) ?? { input: 0, output: 0, cr: 0, cc: 0, cost: 0 };
          return {
            uuid: m.uuid,
            created_at: m.timestamp,
            role: m.type,
            type: 'text',
            session_id: m.session_id,
            input_tokens: t.input,
            output_tokens: t.output,
            cache_read_tokens: t.cr,
            cache_creation_tokens: t.cc,
            cost_usd: t.cost,
          };
        }),
        messageCommits: [],
        commits: curCommits.map((c) => ({
          hash: c.commit_hash,
          subject: (c.commit_message ?? '').split('\n')[0],
          committed_at: c.committed_at,
          is_ai_assisted: c.is_ai_assisted === 1,
          files: curFilesByHash.get(`${c.repo_name ?? ''}:${c.commit_hash}`) ?? [],
          session_id: c.session_id,
          lines_added: c.lines_added ?? 0,
          lines_deleted: c.lines_deleted ?? 0,
        })),
        previousReleases: prevReleases.map((r) => ({ id: r.tag, tag_date: r.released_at, commit_hashes: [], fix_count: r.fix_count })),
        previousMessages: prevMessages.map((m) => {
          const t = prevTokens.get(m.uuid) ?? { input: 0, output: 0, cr: 0, cc: 0, cost: 0 };
          return {
            uuid: m.uuid,
            created_at: m.timestamp,
            role: m.type,
            type: 'text',
            session_id: m.session_id,
            input_tokens: t.input,
            output_tokens: t.output,
            cache_read_tokens: t.cr,
            cache_creation_tokens: t.cc,
            cost_usd: t.cost,
          };
        }),
        previousMessageCommits: [],
        previousCommits: prevCommits.map((c) => ({
          hash: c.commit_hash,
          subject: (c.commit_message ?? '').split('\n')[0],
          committed_at: c.committed_at,
          is_ai_assisted: c.is_ai_assisted === 1,
          files: prevFilesByHash.get(`${c.repo_name ?? ''}:${c.commit_hash}`) ?? [],
          session_id: c.session_id,
          lines_added: c.lines_added ?? 0,
          lines_deleted: c.lines_deleted ?? 0,
        })),
      },
      range,
    );
  }

  async getDeploymentFrequency(
    range: DateRange,
    bucket: 'day' | 'week',
  ): Promise<ReadonlyArray<{ bucketStart: string; value: number }>> {
    const { data } = await this.client
      .from('trail_releases')
      .select('released_at')
      .gte('released_at', range.from)
      .lte('released_at', range.to);
    const releases = (data ?? []) as Array<{ released_at: string }>;
    const { timeSeries } = computeDeploymentFrequency(
      releases.map((r) => ({ tag_date: r.released_at })),
      range,
      range,
      bucket,
    );
    return timeSeries;
  }

  async getDeploymentFrequencyQuality(
    range: DateRange,
    bucket: 'day' | 'week',
  ): Promise<ReadonlyArray<ReleaseQualityBucket>> {
    const FIX_WINDOW_MS = 168 * 60 * 60 * 1000;
    const extendedTo = new Date(new Date(range.to).getTime() + FIX_WINDOW_MS).toISOString();

    const [{ data: releaseData }, { data: commitData }] = await Promise.all([
      this.client
        .from('trail_releases')
        .select('released_at')
        .gte('released_at', range.from)
        .lte('released_at', range.to),
      this.client
        .from('trail_session_commits')
        .select('repo_name, commit_hash, subject, committed_at')
        .gte('committed_at', range.from)
        .lte('committed_at', extendedTo),
    ]);

    const releases = (releaseData ?? []) as Array<{ released_at: string }>;
    const rawCommits = (commitData ?? []) as Array<{ repo_name: string | null; commit_hash: string; subject: string; committed_at: string }>;

    const seenHashes = new Set<string>();
    const uniqueCommits = rawCommits.filter(({ repo_name, commit_hash }) => {
      const identity = `${repo_name ?? ''}:${commit_hash}`;
      if (seenHashes.has(identity)) return false;
      seenHashes.add(identity);
      return true;
    });

    const hashes = uniqueCommits.map((c) => c.commit_hash);
    let rawFiles: Array<{ repo_name?: string | null; commit_hash: string; file_path: string }> = [];
    if (hashes.length > 0) {
      const { data } = await this.client
        .from('trail_commit_files')
        .select('repo_name, commit_hash, file_path')
        .in('commit_hash', hashes);
      rawFiles = (data ?? []) as Array<{ repo_name?: string | null; commit_hash: string; file_path: string }>;
    }

    const filesByHash = new Map<string, string[]>();
    for (const { repo_name, commit_hash, file_path } of rawFiles) {
      const key = `${repo_name ?? ''}:${commit_hash}`;
      const arr = filesByHash.get(key);
      if (arr) arr.push(file_path);
      else filesByHash.set(key, [file_path]);
    }

    const commits = uniqueCommits.map(({ repo_name, commit_hash, subject, committed_at }) => ({
      hash: commit_hash,
      subject,
      committed_at,
      files: filesByHash.get(`${repo_name ?? ''}:${commit_hash}`) ?? [],
    }));

    return computeReleaseQualityTimeSeries(
      {
        releases: releases.map((r) => ({ tag_date: r.released_at })),
        commits,
      },
      range,
      bucket,
    );
  }
}
