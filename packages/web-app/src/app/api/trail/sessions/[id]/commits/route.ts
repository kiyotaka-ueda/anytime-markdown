import { NextResponse } from "next/server";
import { createTrailReader } from "../../../../../../lib/supabase-trail-reader";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, ctx: Ctx): Promise<NextResponse> {
  const { id } = await ctx.params;
  const reader = createTrailReader();
  if (!reader) return NextResponse.json({ commits: [] }, { headers: noStore() });
  try {
    const commits = await reader.getSessionCommits(id);
    return NextResponse.json({ commits }, { headers: noStore() });
  } catch (e) {
    console.error(`[/api/trail/sessions/${id}/commits] error`, e);
    return NextResponse.json({ commits: [] }, { headers: noStore() });
  }
}

function noStore(): Record<string, string> {
  return { 'Cache-Control': 'no-store, must-revalidate' };
}
