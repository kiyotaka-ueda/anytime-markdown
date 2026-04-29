// __non_webpack_require__ はwebpackグローバル。テスト環境ではsql-asm.jsを直接ロードするよう差し替え
const sqlAsmActual = require(require.resolve('sql.js/dist/sql-asm.js')); // eslint-disable-line @typescript-eslint/no-require-imports
(global as Record<string, unknown>).__non_webpack_require__ = (_path: string) => sqlAsmActual;

import { TrailDatabase } from '../TrailDatabase';
import { createTestTrailDatabase } from './support/createTestDb';

type SqlJsDb = {
  run: (sql: string, params?: ReadonlyArray<unknown>) => void;
};

const isoDaysAgo = (days: number): string =>
  new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

const insertSession = (db: TrailDatabase, sessionId: string, startTime: string): void => {
  const inner = (db as unknown as { db: SqlJsDb }).db;
  inner.run(
    `INSERT OR IGNORE INTO sessions (
       id, slug, project, repo_name, version, entrypoint, model, start_time, end_time,
       message_count, file_path, file_size, imported_at
     ) VALUES (?, ?, 'p', 'r', '0', '', '', ?, '', 0, '', 0, '')`,
    [sessionId, sessionId, startTime],
  );
};

const insertMessage = (
  db: TrailDatabase,
  uuid: string,
  sessionId: string,
  subagentType: string | null,
): void => {
  const inner = (db as unknown as { db: SqlJsDb }).db;
  inner.run(
    `INSERT OR IGNORE INTO messages (
       uuid, session_id, parent_uuid, type, timestamp, subagent_type
     ) VALUES (?, ?, NULL, 'assistant', '2026-04-29T00:00:00.000Z', ?)`,
    [uuid, sessionId, subagentType],
  );
};

const insertToolCall = (
  db: TrailDatabase,
  sessionId: string,
  uuid: string,
  callIndex: number,
  toolName: string,
  filePath: string | null,
): void => {
  const inner = (db as unknown as { db: SqlJsDb }).db;
  inner.run(
    `INSERT OR IGNORE INTO message_tool_calls (
       session_id, message_uuid, turn_index, call_index, tool_name, file_path,
       command, skill_name, model, is_sidechain, turn_exec_ms, has_thinking, is_error, error_type, timestamp
     ) VALUES (?, ?, 0, ?, ?, ?, NULL, NULL, NULL, 0, NULL, 0, 0, NULL, ?)`,
    [sessionId, uuid, callIndex, toolName, filePath, '2026-04-29T00:00:00.000Z'],
  );
};

describe('TrailDatabase.fetchTemporalCoupling (granularity=subagentType)', () => {
  let db: TrailDatabase;

  beforeEach(async () => {
    db = await createTestTrailDatabase();
  });

  afterEach(() => {
    db.close();
  });

  it('returns subagentType-grain pairs from message_tool_calls', () => {
    insertSession(db, 's1', isoDaysAgo(1));
    insertMessage(db, 'm1', 's1', 'Explore');
    insertToolCall(db, 's1', 'm1', 0, 'Edit', 'src/auth.ts');
    insertToolCall(db, 's1', 'm1', 1, 'Edit', 'src/login.ts');

    insertSession(db, 's2', isoDaysAgo(2));
    insertMessage(db, 'm2', 's2', 'code-reviewer');
    insertToolCall(db, 's2', 'm2', 0, 'Write', 'src/auth.ts');
    insertToolCall(db, 's2', 'm2', 1, 'Edit', 'src/login.ts');

    const edges = db.fetchTemporalCoupling({
      repoName: 'r',
      windowDays: 30,
      minChangeCount: 1,
      jaccardThreshold: 0,
      topK: 50,
      granularity: 'subagentType',
    });

    expect(edges).toHaveLength(1);
    expect(edges[0]).toMatchObject({
      source: 'src/auth.ts',
      target: 'src/login.ts',
      coChangeCount: 2,
      jaccard: 1.0,
    });
  });

  it('skips rows whose message has NULL subagent_type', () => {
    insertSession(db, 's1', isoDaysAgo(1));
    insertMessage(db, 'm-null', 's1', null);
    insertToolCall(db, 's1', 'm-null', 0, 'Edit', 'src/x.ts');
    insertToolCall(db, 's1', 'm-null', 1, 'Edit', 'src/y.ts');

    insertMessage(db, 'm-explore', 's1', 'Explore');
    insertToolCall(db, 's1', 'm-explore', 2, 'Edit', 'src/a.ts');
    insertToolCall(db, 's1', 'm-explore', 3, 'Edit', 'src/b.ts');

    const edges = db.fetchTemporalCoupling({
      repoName: 'r',
      windowDays: 30,
      minChangeCount: 1,
      jaccardThreshold: 0,
      topK: 50,
      granularity: 'subagentType',
    });

    expect(edges).toHaveLength(1);
    expect(edges[0]).toMatchObject({ source: 'src/a.ts', target: 'src/b.ts' });
  });

  it('aggregates files across multiple sessions sharing the same subagent_type', () => {
    insertSession(db, 's1', isoDaysAgo(1));
    insertMessage(db, 'm1', 's1', 'Explore');
    insertToolCall(db, 's1', 'm1', 0, 'Edit', 'src/a.ts');
    insertToolCall(db, 's1', 'm1', 1, 'Edit', 'src/b.ts');

    insertSession(db, 's2', isoDaysAgo(2));
    insertMessage(db, 'm2', 's2', 'Explore');
    insertToolCall(db, 's2', 'm2', 0, 'Edit', 'src/a.ts');
    insertToolCall(db, 's2', 'm2', 1, 'Edit', 'src/b.ts');

    const edges = db.fetchTemporalCoupling({
      repoName: 'r',
      windowDays: 30,
      minChangeCount: 1,
      jaccardThreshold: 0,
      topK: 50,
      granularity: 'subagentType',
    });

    expect(edges).toHaveLength(1);
    // Both sessions belong to the same subagent_type → 1 group → coChangeCount=1
    expect(edges[0].coChangeCount).toBe(1);
  });

  it('respects window via sessions.start_time', () => {
    insertSession(db, 's1', isoDaysAgo(1));
    insertMessage(db, 'm1', 's1', 'Explore');
    insertToolCall(db, 's1', 'm1', 0, 'Edit', 'src/a.ts');
    insertToolCall(db, 's1', 'm1', 1, 'Edit', 'src/b.ts');

    insertSession(db, 's2', isoDaysAgo(120));
    insertMessage(db, 'm2', 's2', 'Plan');
    insertToolCall(db, 's2', 'm2', 0, 'Edit', 'src/c.ts');
    insertToolCall(db, 's2', 'm2', 1, 'Edit', 'src/d.ts');

    const edges = db.fetchTemporalCoupling({
      repoName: 'r',
      windowDays: 30,
      minChangeCount: 1,
      jaccardThreshold: 0,
      topK: 50,
      granularity: 'subagentType',
    });

    expect(edges).toHaveLength(1);
    expect(edges[0]).toMatchObject({ source: 'src/a.ts', target: 'src/b.ts' });
  });

  it('uses default minChangeCount=2 / jaccardThreshold=0.3 when omitted', () => {
    // 1 つの subagent_type のみで a/b ペアが 1 回だけ → minChangeCount=2 で除外される
    insertSession(db, 's1', isoDaysAgo(1));
    insertMessage(db, 'm1', 's1', 'Explore');
    insertToolCall(db, 's1', 'm1', 0, 'Edit', 'src/a.ts');
    insertToolCall(db, 's1', 'm1', 1, 'Edit', 'src/b.ts');

    const edges = db.fetchTemporalCoupling({
      repoName: 'r',
      windowDays: 30,
      topK: 50,
      granularity: 'subagentType',
    });

    expect(edges).toEqual([]);
  });
});
