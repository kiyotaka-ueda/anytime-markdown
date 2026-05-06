import type { SupabaseClient } from '@supabase/supabase-js';
import type { CostOptimizationData } from '../../domain/parser/types';
import { computeQualityMetrics } from '@anytime-markdown/trail-core/domain/metrics';
import type {
  DateRange,
  QualityMetrics,
} from '@anytime-markdown/trail-core/domain/metrics';
import { calculateCost } from '@anytime-markdown/trail-core/domain/engine';

export class MetricsReader {
  constructor(private readonly client: SupabaseClient) {}

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
}
