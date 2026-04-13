// packages/web-app/src/lib/supabase-trail-reader.ts
//
// server-side から SupabaseTrailReader を生成するヘルパ。
// 各 /api/trail/* ルートで共通利用する。

import { SupabaseTrailReader } from '@anytime-markdown/trail-viewer/supabase';
import { resolveSupabaseEnv } from './supabase-env';

export function createTrailReader(): SupabaseTrailReader | null {
  const env = resolveSupabaseEnv();
  if (!env) return null;
  return new SupabaseTrailReader(env.url, env.anonKey);
}
