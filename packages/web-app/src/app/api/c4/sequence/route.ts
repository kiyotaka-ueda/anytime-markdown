import type { SequenceModel } from "@anytime-markdown/trace-core/c4Sequence";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { NO_STORE_HEADERS } from "../../../../lib/api-helpers";

/**
 * GET /api/c4/sequence?elementId=...
 *
 * trail-viewer の C4 Sequence 表示で使用するエンドポイント。
 * SequenceAnalyzer はソースコード AST 解析を必要とするため、
 * web-app（Supabase ベース、ソースファイル無し）では空モデルを返す。
 * 完全な機能は VS Code 拡張の同名エンドポイントで提供される。
 */
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const elementId = request.nextUrl.searchParams.get("elementId") ?? "";
  if (!elementId) {
    return NextResponse.json({ error: "elementId is required" }, { status: 400 });
  }

  const empty: SequenceModel = {
    version: 1,
    rootElementId: elementId,
    participants: [],
    root: { kind: 'sequence', steps: [] },
  };
  const response = NextResponse.json(empty);
  for (const [k, v] of Object.entries(NO_STORE_HEADERS)) {
    response.headers.set(k, v);
  }
  return response;
}
