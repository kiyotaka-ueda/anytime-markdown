import * as fs from 'node:fs';
import * as path from 'node:path';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export interface TraceFileMeta {
  name: string;
  url: string;
  mtime: string;
}

function getTraceDir(): string | null {
  if (process.env['TRACE_OUTPUT_DIR']) {
    return process.env['TRACE_OUTPUT_DIR'];
  }
  const cwd = process.cwd();
  const candidate = path.join(cwd, '.vscode', 'trace');
  return candidate;
}

export async function GET(): Promise<NextResponse> {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json([], { status: 200 });
  }

  const traceDir = getTraceDir();
  if (!traceDir || !fs.existsSync(traceDir)) {
    return NextResponse.json([]);
  }

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
  } catch {
    return NextResponse.json([]);
  }
}
