import { NextResponse } from "next/server";

import { fetchC4ModelEntries } from "@anytime-markdown/trail-core/c4";
import { SupabaseC4ModelStore } from "@anytime-markdown/trail-viewer/supabase";

/**
 * GET /api/c4/releases
 *
 * current + release の C4 モデルエントリ一覧を返す。
 * 返却形状: Array<{ tag: string; repoName: string | null }>
 *
 * 拡張機能の /api/c4/releases と互換。web アプリは Supabase を使用する。
 */

export async function GET(): Promise<NextResponse> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json([]);
  }

  try {
    const store = new SupabaseC4ModelStore(supabaseUrl, supabaseKey);
    const entries = await fetchC4ModelEntries(store);
    return NextResponse.json(entries);
  } catch {
    return NextResponse.json([]);
  }
}
