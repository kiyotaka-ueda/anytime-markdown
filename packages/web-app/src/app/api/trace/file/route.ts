import * as fs from 'node:fs';
import * as path from 'node:path';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function getTraceDir(): string {
  if (process.env['TRACE_OUTPUT_DIR']) {
    return process.env['TRACE_OUTPUT_DIR'];
  }
  return path.join(process.cwd(), '.vscode', 'trace');
}

export async function GET(request: Request): Promise<NextResponse> {
  if (process.env.NODE_ENV === 'production') {
    return new NextResponse('Not available in production', { status: 403 });
  }

  const url = new URL(request.url);
  const name = url.searchParams.get('name');
  if (!name || name.includes('..') || name.includes('/') || !name.endsWith('.json')) {
    return new NextResponse('Invalid file name', { status: 400 });
  }

  const traceDir = getTraceDir();
  const filePath = path.join(traceDir, name);

  if (!fs.existsSync(filePath)) {
    return new NextResponse('File not found', { status: 404 });
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return new NextResponse(content, {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new NextResponse('Failed to read file', { status: 500 });
  }
}
