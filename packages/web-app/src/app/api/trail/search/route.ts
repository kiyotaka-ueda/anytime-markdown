import { readdir, readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { NextResponse } from 'next/server';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SearchResult {
  readonly sessionId: string;
  readonly project: string;
  readonly snippet: string;
  readonly lineNumber: number;
}

/** Minimal shape for reading JSONL lines */
interface JsonlLine {
  readonly sessionId?: string;
  readonly message?: { readonly content?: string };
  readonly userContent?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROJECTS_DIR = join(homedir(), '.claude', 'projects');
const MAX_RESULTS = 50;
const SNIPPET_CONTEXT = 120;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function listProjectDirs(): Promise<string[] | null> {
  try {
    const entries = await readdir(PROJECTS_DIR, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return null;
  }
}

async function listJsonlFiles(projPath: string): Promise<string[]> {
  try {
    const entries = await readdir(projPath);
    return entries.filter((f) => f.endsWith('.jsonl'));
  } catch {
    return [];
  }
}

function safeParseJsonl(line: string): JsonlLine | null {
  try {
    return JSON.parse(line) as JsonlLine;
  } catch {
    return null;
  }
}

function buildSnippet(text: string, searchText: string): string {
  const idx = text.toLowerCase().indexOf(searchText);
  if (idx < 0) return text.slice(0, SNIPPET_CONTEXT);
  const start = Math.max(0, idx - SNIPPET_CONTEXT / 2);
  const end = Math.min(text.length, idx + searchText.length + SNIPPET_CONTEXT / 2);
  const head = start > 0 ? '...' : '';
  const tail = end < text.length ? '...' : '';
  return head + text.slice(start, end) + tail;
}

function extractSnippet(line: string, searchText: string): string {
  const raw = safeParseJsonl(line);
  if (!raw) return buildSnippet(line, searchText);
  const textSource =
    typeof raw.message?.content === 'string' ? raw.message.content : raw.userContent ?? line;
  return buildSnippet(textSource, searchText);
}

interface MatchContext {
  readonly searchText: string;
  readonly projectDir: string;
  readonly fallbackSessionId: string;
  readonly maxResults: number;
}

function matchLines(
  lines: readonly string[],
  ctx: MatchContext,
  results: SearchResult[],
): void {
  let sessionId = '';
  for (let i = 0; i < lines.length; i++) {
    if (results.length >= ctx.maxResults) break;
    const line = lines[i];
    if (line.trim() === '') continue;

    if (!sessionId) {
      const parsed = safeParseJsonl(line);
      if (!parsed) continue;
      if (parsed.sessionId) sessionId = parsed.sessionId;
    }

    if (!line.toLowerCase().includes(ctx.searchText)) continue;

    results.push({
      sessionId: sessionId || ctx.fallbackSessionId,
      project: ctx.projectDir,
      snippet: extractSnippet(line, ctx.searchText),
      lineNumber: i + 1,
    });
  }
}

async function searchFile(
  filePath: string,
  projectDir: string,
  fileBaseName: string,
  searchText: string,
  results: SearchResult[],
): Promise<void> {
  let content: string;
  try {
    content = await readFile(filePath, 'utf-8');
  } catch {
    return;
  }
  matchLines(content.split('\n'), {
    searchText,
    projectDir,
    fallbackSessionId: fileBaseName.replace('.jsonl', ''),
    maxResults: MAX_RESULTS,
  }, results);
}

async function searchProject(
  projDir: string,
  searchText: string,
  results: SearchResult[],
): Promise<void> {
  const projPath = join(PROJECTS_DIR, projDir);
  const files = await listJsonlFiles(projPath);
  for (const file of files) {
    if (results.length >= MAX_RESULTS) break;
    await searchFile(join(projPath, file), projDir, file, searchText, results);
  }
}

// ---------------------------------------------------------------------------
// GET handler
// ---------------------------------------------------------------------------

export async function GET(request: Request): Promise<NextResponse> {
  const q = new URL(request.url).searchParams.get('q');
  if (!q || q.trim() === '') {
    return NextResponse.json({ error: 'Query parameter "q" is required' }, { status: 400 });
  }

  const searchText = q.toLowerCase();
  const results: SearchResult[] = [];

  try {
    const projectDirs = await listProjectDirs();
    if (!projectDirs) return NextResponse.json([]);

    for (const projDir of projectDirs) {
      if (results.length >= MAX_RESULTS) break;
      await searchProject(projDir, searchText, results);
    }

    return NextResponse.json(results);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
