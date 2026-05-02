import type { CodeGraph, CodeGraphQueryResult } from '@anytime-markdown/trail-core/codeGraph';
import { createClient } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { NO_STORE_HEADERS } from '../../../../lib/api-helpers';
import { resolveSupabaseEnv } from '../../../../lib/supabase-env';

export const dynamic = 'force-dynamic';

function queryGraph(graph: CodeGraph, keyword: string, depth = 3): CodeGraphQueryResult {
  const lower = keyword.toLowerCase();
  const starts = graph.nodes
    .filter((n) => n.label.toLowerCase().includes(lower) || n.id.toLowerCase().includes(lower))
    .map((n) => n.id);

  // Build adjacency list
  const adj = new Map<string, string[]>();
  for (const e of graph.edges) {
    const ns = adj.get(e.source) ?? [];
    ns.push(e.target);
    adj.set(e.source, ns);
    const nt = adj.get(e.target) ?? [];
    nt.push(e.source);
    adj.set(e.target, nt);
  }

  const visited = new Set<string>(starts);
  let frontier = new Set(starts);
  for (let i = 0; i < depth; i++) {
    const next = new Set<string>();
    for (const n of frontier) {
      for (const nb of adj.get(n) ?? []) {
        if (!visited.has(nb)) { visited.add(nb); next.add(nb); }
      }
    }
    frontier = next;
  }

  const edges = graph.edges
    .filter((e) => visited.has(e.source) && visited.has(e.target))
    .map((e) => ({ source: e.source, target: e.target }));
  return { nodes: [...visited], edges };
}

/**
 * GET /api/code-graph/query?q=...
 *
 * キーワードに関連するノードを BFS depth=3 で返す。
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const q = request.nextUrl.searchParams.get('q') ?? '';
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
    return NextResponse.json(queryGraph(graph, q), { headers: NO_STORE_HEADERS });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
