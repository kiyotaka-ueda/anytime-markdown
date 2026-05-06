// data/readers/C4Reader.ts — C4 モデル取得を集約した Reader
//
// trail_c4_models / trail_current_graphs / trail_release_graphs / trail_releases から
// C4 モデル・TrailGraph を取得する。
// SupabaseC4ModelStore はこの Reader への薄いファサードとして残置される。

import type { SupabaseClient } from '@supabase/supabase-js';
import type { C4Model } from '@anytime-markdown/trail-core/c4';
import { trailToC4 } from '@anytime-markdown/trail-core/transform';
import type { TrailGraph } from '@anytime-markdown/trail-core/model';
import type {
  C4ModelEntry,
  C4ModelResult,
  IC4ModelStore,
} from '@anytime-markdown/trail-core/domain';

interface CurrentGraphRow {
  readonly repo_name: string;
  readonly commit_id: string;
  readonly graph_json: string;
}

interface ReleaseGraphRow {
  readonly tag: string;
  readonly graph_json: string;
}

interface TrailReleaseRow {
  readonly tag: string;
  readonly repo_name: string | null;
  readonly released_at: string | null;
}

export class C4Reader implements IC4ModelStore {
  constructor(private readonly client: SupabaseClient) {}

  async getC4Model(): Promise<Record<string, unknown> | null> {
    const { data, error } = await this.client
      .from('trail_c4_models')
      .select('model_json')
      .eq('id', 'current')
      .single();
    if (error || !data) return null;
    try {
      return JSON.parse(data.model_json) as Record<string, unknown>;
    } catch (parseError) {
      console.warn('C4Reader.getC4Model: failed to parse model_json', {
        context: { id: 'current', length: data.model_json?.length ?? 0 },
        error: parseError instanceof Error
          ? { message: parseError.message, stack: parseError.stack }
          : { value: String(parseError) },
      });
      return null;
    }
  }

  async getCurrentC4Model(repoName: string): Promise<C4ModelResult | null> {
    const result = await this.getCurrentGraph(repoName);
    if (!result) return null;
    return { model: trailToC4(result.graph), commitId: result.commitId };
  }

  async getReleaseC4Model(tag: string): Promise<C4ModelResult | null> {
    const graph = await this.getReleaseGraph(tag);
    if (!graph) return null;
    return { model: trailToC4(graph) };
  }

  /** 生の TrailGraph を取得する（DSM 計算用）。 */
  async getCurrentGraph(repoName: string): Promise<{ graph: TrailGraph; commitId: string } | null> {
    const { data, error } = await this.client
      .from('trail_current_graphs')
      .select('repo_name, commit_id, graph_json')
      .eq('repo_name', repoName)
      .maybeSingle<CurrentGraphRow>();
    if (error || !data) return null;
    const graph = C4Reader.parseGraph(data.graph_json);
    if (!graph) return null;
    return { graph, commitId: data.commit_id };
  }

  /** リリース別の生の TrailGraph を取得する（DSM 計算用）。 */
  async getReleaseGraph(tag: string): Promise<TrailGraph | null> {
    const { data, error } = await this.client
      .from('trail_release_graphs')
      .select('tag, graph_json')
      .eq('tag', tag)
      .maybeSingle<ReleaseGraphRow>();
    if (error || !data) return null;
    return C4Reader.parseGraph(data.graph_json);
  }

  async getC4ModelEntries(): Promise<readonly C4ModelEntry[]> {
    // 2 テーブルへの SELECT を並列実行する
    const [currentRes, releaseRes] = await Promise.all([
      this.client
        .from('trail_current_graphs')
        .select('repo_name')
        .returns<{ repo_name: string }[]>(),
      this.client
        .from('trail_releases')
        .select('tag, repo_name, released_at')
        .order('released_at', { ascending: false })
        .returns<TrailReleaseRow[]>(),
    ]);
    if (currentRes.error) {
      console.error('[C4Reader] trail_current_graphs select failed:', currentRes.error.message);
    }
    if (releaseRes.error) {
      console.error('[C4Reader] trail_releases select failed:', releaseRes.error.message);
    }

    const entries: C4ModelEntry[] = [];
    for (const r of currentRes.data ?? []) {
      entries.push({ tag: 'current', repoName: r.repo_name });
    }
    for (const r of releaseRes.data ?? []) {
      entries.push({ tag: r.tag, repoName: r.repo_name });
    }
    return entries;
  }

  private static parseGraph(json: string): TrailGraph | null {
    try {
      const parsed: unknown = JSON.parse(json);
      if (parsed && typeof parsed === 'object') {
        return parsed as TrailGraph;
      }
      return null;
    } catch (parseError) {
      console.warn('C4Reader.parseGraph: failed to parse graph json', {
        context: { length: json?.length ?? 0 },
        error: parseError instanceof Error
          ? { message: parseError.message, stack: parseError.stack }
          : { value: String(parseError) },
      });
      return null;
    }
  }
}

// C4Model 型を re-export（既存の trailToC4 の戻り値型を消費する側で使う場合がある）
export type { C4Model };
