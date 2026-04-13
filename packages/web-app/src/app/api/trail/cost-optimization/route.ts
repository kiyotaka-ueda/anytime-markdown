import { NextResponse } from "next/server";
import { createTrailReader } from "../../../../lib/supabase-trail-reader";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(): Promise<NextResponse> {
  const reader = createTrailReader();
  if (!reader) return NextResponse.json(null, { headers: noStore() });
  try {
    const data = await reader.getCostOptimization();
    return NextResponse.json(data, { headers: noStore() });
  } catch (e) {
    console.error('[/api/trail/cost-optimization] error', e);
    return NextResponse.json(null, { headers: noStore(), status: 500 });
  }
}

function noStore(): Record<string, string> {
  return { 'Cache-Control': 'no-store, must-revalidate' };
}
