import type { StoredCodeGraph, StoredCommunity } from '@anytime-markdown/trail-core/codeGraph';
import { composeCodeGraph } from '@anytime-markdown/trail-core/codeGraph';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

import { NO_STORE_HEADERS } from '../../../lib/api-helpers';
import { resolveSupabaseEnv } from '../../../lib/supabase-env';

export const dynamic = 'force-dynamic';

/**
 * GET /api/code-graph
 *
 * trail_current_code_graphs + trail_current_code_graph_communities から
 * CodeGraph を合成して返す。グラフ未生成時は 404。
 */
export async function GET(): Promise<NextResponse> {
  const env = resolveSupabaseEnv();
  if (!env) return new NextResponse(null, { status: 404 });

  try {
    const supabase = createClient(env.url, env.anonKey);
    const [{ data: graphRow, error: graphErr }, { data: communityRows, error: commErr }] = await Promise.all([
      supabase.from('trail_current_code_graphs').select('graph_json').limit(1).single(),
      supabase.from('trail_current_code_graph_communities').select('community_id,label,name,summary').limit(1000),
    ]);

    if (graphErr || !graphRow) return new NextResponse(null, { status: 404 });

    const stored = JSON.parse(graphRow.graph_json as string) as StoredCodeGraph;
    const communities: StoredCommunity[] = (communityRows ?? []).map((r: Record<string, unknown>) => ({
      id: r.community_id as number,
      label: (r.label as string) ?? '',
      name: (r.name as string) ?? '',
      summary: (r.summary as string) ?? '',
    }));

    if (commErr) {
      // communities なしでも communities:{} で compose して返す
    }

    const graph = composeCodeGraph(stored, communities);
    return NextResponse.json(graph, { headers: NO_STORE_HEADERS });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
