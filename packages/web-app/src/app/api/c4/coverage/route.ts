import { aggregateCoverageFromDb, fetchC4Model } from "@anytime-markdown/trail-core/c4";
import type { ReleaseCoverageRow } from "@anytime-markdown/trail-core/domain";
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from "next/server";

import { createC4ModelStore, NO_STORE_HEADERS } from "../../../../lib/api-helpers";
import { resolveSupabaseEnv } from "../../../../lib/supabase-env";

export const dynamic = 'force-dynamic';

/**
 * GET /api/c4/coverage
 *
 * 拡張機能の /api/c4/coverage と互換。
 * trail_current_coverage テーブル（拡張機能が Sync で書き込む）から
 * カバレッジを取得し、C4 モデルで集約して返す。
 */
export async function GET(): Promise<NextResponse> {
  const empty = { coverageMatrix: null, coverageDiff: null };

  const store = createC4ModelStore();
  if (!store) return NextResponse.json(empty, { headers: NO_STORE_HEADERS });

  const env = resolveSupabaseEnv();
  if (!env) return NextResponse.json(empty, { headers: NO_STORE_HEADERS });

  try {
    const [payload, supabaseCovResult] = await Promise.all([
      fetchC4Model(store, 'current', undefined),
      createClient(env.url, env.anonKey)
        .from('trail_current_coverage')
        .select('package,file_path,lines_total,lines_covered,lines_pct,statements_total,statements_covered,statements_pct,functions_total,functions_covered,functions_pct,branches_total,branches_covered,branches_pct'),
    ]);

    if (!payload) return NextResponse.json(empty, { headers: NO_STORE_HEADERS });

    const rows = (supabaseCovResult.data ?? []) as Array<Record<string, unknown>>;
    if (rows.length === 0) return NextResponse.json(empty, { headers: NO_STORE_HEADERS });

    const coverageRows: ReleaseCoverageRow[] = rows.map((r) => ({
      release_tag: '__current__',
      package: String(r.package),
      file_path: String(r.file_path),
      lines_total: Number(r.lines_total),
      lines_covered: Number(r.lines_covered),
      lines_pct: Number(r.lines_pct),
      statements_total: Number(r.statements_total),
      statements_covered: Number(r.statements_covered),
      statements_pct: Number(r.statements_pct),
      functions_total: Number(r.functions_total),
      functions_covered: Number(r.functions_covered),
      functions_pct: Number(r.functions_pct),
      branches_total: Number(r.branches_total),
      branches_covered: Number(r.branches_covered),
      branches_pct: Number(r.branches_pct),
    }));

    const coverageMatrix = aggregateCoverageFromDb(coverageRows, payload.model);
    return NextResponse.json({ coverageMatrix, coverageDiff: null }, { headers: NO_STORE_HEADERS });
  } catch (e) {
    console.error('[/api/c4/coverage] error', e);
    return NextResponse.json(empty, { headers: NO_STORE_HEADERS });
  }
}
