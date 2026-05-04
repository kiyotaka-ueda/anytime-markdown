import type { CommitFileRow, SessionFileRow } from '@anytime-markdown/trail-core';
import {
  computeConfidenceCoupling,
  computeSessionConfidenceCoupling,
  computeSessionCoupling,
  computeTemporalCoupling,
} from '@anytime-markdown/trail-core';
import { createClient } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { NO_STORE_HEADERS } from '../../../lib/api-helpers';
import { resolveSupabaseEnv } from '../../../lib/supabase-env';

export const dynamic = 'force-dynamic';

/** 拡張機能の defaultTemporalCouplingPathFilter と同一のブラックリスト */
const EXCLUDE_PATTERNS: readonly RegExp[] = [
  /\.lock$/,
  /(^|\/)package-lock\.json$/,
  /(^|\/)yarn\.lock$/,
  /(^|\/)pnpm-lock\.yaml$/,
  /(^|\/)dist\//,
  /(^|\/)node_modules\//,
  /\.min\.js$/,
  /\.map$/,
  /(^|\/)\.worktrees\//,
  /(^|\/)\.claude\//,
  /(^|\/)\.vscode\//,
  /(^|\/)\.next\//,
  /(^|\/)out\//,
  /(^|\/)build\//,
  /(^|\/)coverage\//,
];

function pathFilter(filePath: string): boolean {
  return !EXCLUDE_PATTERNS.some((re) => re.test(filePath));
}

function clampInt(raw: string | null, def: number, min: number, max: number): number {
  const v = raw === null ? def : Number.parseInt(raw, 10);
  return Number.isNaN(v) ? def : Math.min(max, Math.max(min, v));
}
function clampFloat(raw: string | null, def: number, min: number, max: number): number {
  const v = raw === null ? def : Number.parseFloat(raw);
  return Number.isNaN(v) ? def : Math.min(max, Math.max(min, v));
}

/**
 * GET /api/temporal-coupling?repo=...&windowDays=...&topK=...&...
 *
 * trail_session_commits + trail_commit_files から Temporal Coupling を計算して返す。
 * パスフィルタは拡張機能と同一のブラックリスト方式（ロックファイル・生成物等を除外）。
 * granularity=subagentType はデータなし（message_tool_calls は 7 日制限）→ 空配列。
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const sp = request.nextUrl.searchParams;
  const granularityRaw = sp.get('granularity');
  const granularity: 'commit' | 'session' | 'subagentType' =
    granularityRaw === 'session' ? 'session'
    : granularityRaw === 'subagentType' ? 'subagentType'
    : 'commit';
  const directional = sp.get('directional') === 'true';
  const windowDays = clampInt(sp.get('windowDays'), 30, 1, 365);
  const topK = clampInt(sp.get('topK'), 50, 1, 500);
  const isSession = granularity === 'session';
  const minChangeCount = clampInt(sp.get('minChange'), isSession ? 3 : 5, 1, 1000);
  const jaccardThreshold = clampFloat(sp.get('threshold'), isSession ? 0.4 : 0.5, 0, 1);
  const confidenceThreshold = clampFloat(sp.get('confidenceThreshold'), 0.5, 0, 1);
  const directionalDiff = clampFloat(sp.get('directionalDiff'), 0.3, 0, 1);
  const maxFilesPerCommit = isSession ? 20 : 50;

  const computedAt = new Date().toISOString();

  if (granularity === 'subagentType') {
    return NextResponse.json(
      { directional, granularity, edges: [], computedAt, windowDays, totalPairs: 0 },
      { headers: NO_STORE_HEADERS },
    );
  }

  const env = resolveSupabaseEnv();
  if (!env) {
    return NextResponse.json(
      { granularity, edges: [], computedAt, windowDays, totalPairs: 0 },
      { headers: NO_STORE_HEADERS },
    );
  }

  try {
    const supabase = createClient(env.url, env.anonKey);
    const fromIso = new Date(Date.now() - windowDays * 86_400_000).toISOString();

    // ウィンドウ内のコミットを取得
    const commitHashToSessionId = new Map<string, string>();
    for (let offset = 0; ; offset += 1000) {
      const { data: batch } = await supabase
        .from('trail_session_commits')
        .select('commit_hash,session_id,committed_at')
        .gte('committed_at', fromIso)
        .range(offset, offset + 999);
      if (!batch || batch.length === 0) break;
      for (const r of batch as Array<{ commit_hash: string; session_id: string; committed_at: string }>) {
        commitHashToSessionId.set(r.commit_hash, r.session_id);
      }
      if (batch.length < 1000) break;
    }

    if (commitHashToSessionId.size === 0) {
      return NextResponse.json(
        { granularity, edges: [], computedAt, windowDays, totalPairs: 0 },
        { headers: NO_STORE_HEADERS },
      );
    }

    // trail_commit_files を全件取得（URL長制限回避のため .in() バッチは使わず全件ロード後 JS でフィルタ）
    // trail_commit_files は最大でも数万行の小テーブルのため全件ロードで問題ない。
    const commitFileRows: CommitFileRow[] = [];
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await supabase
        .from('trail_commit_files')
        .select('commit_hash,file_path')
        .order('commit_hash')
        .order('file_path')
        .range(offset, offset + 999);
      if (error || !data || data.length === 0) break;
      for (const r of data as Array<{ commit_hash: string; file_path: string }>) {
        if (commitHashToSessionId.has(r.commit_hash)) {
          commitFileRows.push({ commitHash: r.commit_hash, filePath: r.file_path });
        }
      }
      if (data.length < 1000) break;
    }

    if (granularity === 'commit') {
      const opts = { minChangeCount, jaccardThreshold, topK, maxFilesPerCommit, pathFilter };
      const confOpts = { minChangeCount, confidenceThreshold, directionalDiffThreshold: directionalDiff, topK, maxFilesPerCommit, pathFilter };
      const edges = directional
        ? computeConfidenceCoupling(commitFileRows, confOpts)
        : computeTemporalCoupling(commitFileRows, opts);
      return NextResponse.json(
        { directional: directional || undefined, granularity, edges, computedAt, windowDays, totalPairs: edges.length },
        { headers: NO_STORE_HEADERS },
      );
    }

    // session granularity
    const sessionFileRows: SessionFileRow[] = commitFileRows.map((r) => ({
      sessionId: commitHashToSessionId.get(r.commitHash) ?? '',
      filePath: r.filePath,
    })).filter((r) => r.sessionId !== '');

    const opts = { minChangeCount, jaccardThreshold, topK, maxFilesPerCommit, pathFilter };
    const confOpts = { minChangeCount, confidenceThreshold, directionalDiffThreshold: directionalDiff, topK, maxFilesPerCommit, pathFilter };
    const edges = directional
      ? computeSessionConfidenceCoupling(sessionFileRows, confOpts)
      : computeSessionCoupling(sessionFileRows, opts);
    return NextResponse.json(
      { directional: directional || undefined, granularity, edges, computedAt, windowDays, totalPairs: edges.length },
      { headers: NO_STORE_HEADERS },
    );
  } catch {
    return NextResponse.json(
      { granularity, edges: [], computedAt, windowDays, totalPairs: 0 },
      { headers: NO_STORE_HEADERS },
    );
  }
}
