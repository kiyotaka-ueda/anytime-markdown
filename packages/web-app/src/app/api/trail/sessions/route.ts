import { NextResponse } from 'next/server';
import { createTrailReader } from '../../../../lib/supabase-trail-reader';
import type { TrailFilter } from '@anytime-markdown/trail-viewer';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/trail/sessions
 *
 * クエリパラメータ（branch / model / project / q）でフィルタした Trail セッション一覧を返す。
 * データソースは Supabase（SupabaseTrailReader 経由）。
 *
 * 旧実装はローカルファイルシステム（~/.claude/projects）から直接読んでいたが、
 * Supabase 同期ができていれば Supabase を単一ソースとして使用する方針に統一した。
 */
export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const filter: TrailFilter = {
    gitBranch: url.searchParams.get('branch') ?? undefined,
    model: url.searchParams.get('model') ?? undefined,
    project: url.searchParams.get('project') ?? undefined,
    searchText: url.searchParams.get('q') ?? undefined,
  };

  const reader = createTrailReader();
  if (!reader) return NextResponse.json([], { headers: noStore() });
  try {
    const sessions = await reader.getSessions(filter);
    return NextResponse.json(sessions, { headers: noStore() });
  } catch (e) {
    console.error('[/api/trail/sessions] error', e);
    return NextResponse.json([], { headers: noStore() });
  }
}

function noStore(): Record<string, string> {
  return { 'Cache-Control': 'no-store, must-revalidate' };
}
