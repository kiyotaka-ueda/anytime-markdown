import { NextResponse } from 'next/server';
import { createTrailReader } from '../../../../lib/supabase-trail-reader';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(): Promise<NextResponse> {
  const reader = createTrailReader();
  if (!reader) return NextResponse.json([], { headers: noStore() });
  try {
    const releases = await reader.getReleases();
    return NextResponse.json(releases, { headers: noStore() });
  } catch (e) {
    console.error('[/api/trail/releases] error', e);
    return NextResponse.json([], { headers: noStore() });
  }
}

function noStore(): Record<string, string> {
  return { 'Cache-Control': 'no-store, must-revalidate' };
}
