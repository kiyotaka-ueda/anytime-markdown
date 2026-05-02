import type { CodeGraph } from '@anytime-markdown/trail-core/codeGraph';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

import { NO_STORE_HEADERS } from '../../../lib/api-helpers';
import { resolveSupabaseEnv } from '../../../lib/supabase-env';

export const dynamic = 'force-dynamic';

/**
 * GET /api/code-graph
 *
 * trail_current_code_graphs から anytime-markdown リポジトリの CodeGraph を返す。
 * グラフ未生成時は 404。
 */
export async function GET(): Promise<NextResponse> {
  const env = resolveSupabaseEnv();
  if (!env) return new NextResponse(null, { status: 404 });

  try {
    const supabase = createClient(env.url, env.anonKey);
    const { data, error } = await supabase
      .from('trail_current_code_graphs')
      .select('graph_json')
      .limit(1)
      .single();

    if (error || !data) return new NextResponse(null, { status: 404 });

    const graph = JSON.parse(data.graph_json as string) as CodeGraph;
    return NextResponse.json(graph, { headers: NO_STORE_HEADERS });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
