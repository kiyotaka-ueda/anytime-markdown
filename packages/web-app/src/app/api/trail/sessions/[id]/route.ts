import { NextResponse } from 'next/server';
import { createTrailReader } from '../../../../../lib/supabase-trail-reader';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/trail/sessions/[id]
 *
 * 指定セッションのメッセージ一覧を返す。データソースは Supabase。
 * 旧実装はローカル JSONL を直接 parseSession していたが、Supabase に統一した。
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
  }

  const reader = createTrailReader();
  if (!reader) {
    return NextResponse.json({ messages: [] }, { headers: noStore() });
  }

  try {
    const messages = await reader.getMessages(id);
    return NextResponse.json({ messages }, { headers: noStore() });
  } catch (err) {
    console.error(`[/api/trail/sessions/${id}] error`, err);
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500, headers: noStore() });
  }
}

function noStore(): Record<string, string> {
  return { 'Cache-Control': 'no-store, must-revalidate' };
}
