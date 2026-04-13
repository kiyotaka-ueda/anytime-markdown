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
  if (!reader) return NextResponse.json(null, { headers: noStore() });
  try {
    const metrics = await reader.getSessionToolMetrics(id);
    return NextResponse.json(metrics, { headers: noStore() });
  } catch (e) {
    console.error(`[/api/trail/sessions/${id}/tool-metrics] error`, e);
    return NextResponse.json(null, { headers: noStore() });
  }
}

function noStore(): Record<string, string> {
  return { 'Cache-Control': 'no-store, must-revalidate' };
}
