import { createTestTrailDatabase } from './support/createTestDb';
import { noopDbLogger, type DbLogger } from '../DbLogger';

describe('TrailDatabase.runQuery (private SQL instrumentation helper)', () => {
  it('returns the value produced by the wrapped function', async () => {
    const db = await createTestTrailDatabase();
    const runQuery = (db as unknown as Record<string, (
      name: string,
      fn: () => unknown,
      getRowCount?: (r: unknown) => number,
    ) => unknown>).runQuery;
    expect(typeof runQuery).toBe('function');

    const result = runQuery.call(db, 'noop', () => 42);
    expect(result).toBe(42);
  });

  it('emits debugSql with name and durationMs (no rowCount when getRowCount is omitted)', async () => {
    const calls: unknown[] = [];
    const logger: DbLogger = { ...noopDbLogger, debugSql: (m: unknown) => { calls.push(m); } };
    const db = await createTestTrailDatabase(logger);
    const runQuery = (db as unknown as Record<string, (
      name: string,
      fn: () => unknown,
      getRowCount?: (r: unknown) => number,
    ) => unknown>).runQuery;

    runQuery.call(db, 'simpleQuery', () => 'value');

    expect(calls).toHaveLength(1);
    const meta = calls[0] as { name: string; durationMs: number; rowCount?: number };
    expect(meta.name).toBe('simpleQuery');
    expect(typeof meta.durationMs).toBe('number');
    expect(meta.durationMs).toBeGreaterThanOrEqual(0);
    expect(meta.rowCount).toBeUndefined();
  });

  it('includes rowCount when getRowCount is provided', async () => {
    const calls: unknown[] = [];
    const logger: DbLogger = { ...noopDbLogger, debugSql: (m: unknown) => { calls.push(m); } };
    const db = await createTestTrailDatabase(logger);
    const runQuery = (db as unknown as Record<string, (
      name: string,
      fn: () => readonly unknown[],
      getRowCount?: (r: readonly unknown[]) => number,
    ) => readonly unknown[]>).runQuery;

    const fakeRows = [{ a: 1 }, { a: 2 }, { a: 3 }];
    const result = runQuery.call(db, 'rowCountQuery', () => fakeRows, (r) => r.length);

    expect(result).toBe(fakeRows);
    const meta = calls[0] as { name: string; rowCount: number };
    expect(meta.rowCount).toBe(3);
  });

  it('still throws when wrapped function throws (no swallowing)', async () => {
    const calls: unknown[] = [];
    const logger: DbLogger = { ...noopDbLogger, debugSql: (m: unknown) => { calls.push(m); } };
    const db = await createTestTrailDatabase(logger);
    const runQuery = (db as unknown as Record<string, (name: string, fn: () => unknown) => unknown>).runQuery;

    expect(() => runQuery.call(db, 'failing', () => { throw new Error('bang'); })).toThrow('bang');
    // 失敗時はログ出力しない（成功時のみ計測）
    expect(calls).toHaveLength(0);
  });
});
