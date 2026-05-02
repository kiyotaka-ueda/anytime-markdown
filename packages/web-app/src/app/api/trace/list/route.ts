import * as fs from 'node:fs';
import * as path from 'node:path';
import { NextResponse } from 'next/server';

import { getTraceDir } from '../_utils';

export const dynamic = 'force-dynamic';

export interface TraceFileMeta {
  name: string;
  url: string;
  mtime: string;
}

export async function GET(): Promise<NextResponse> {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json([], { status: 200 });
  }

  const traceDir = getTraceDir();

  try {
    const files = fs.readdirSync(traceDir)
      .filter(f => f.endsWith('.json'))
      .map(f => {
        const fullPath = path.join(traceDir, f);
        const stat = fs.statSync(fullPath);
        return { name: f, mtime: stat.mtime.toISOString() };
      })
      .sort((a, b) => b.mtime.localeCompare(a.mtime));

    const result: TraceFileMeta[] = files.map(({ name, mtime }) => ({
      name,
      url: `/api/trace/file?name=${encodeURIComponent(name)}`,
      mtime,
    }));

    return NextResponse.json(result);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') return NextResponse.json([]);
    console.error(`[${new Date().toISOString()}] [ERROR] trace/list GET failed: ${traceDir}`, err);
    return NextResponse.json([]);
  }
}
