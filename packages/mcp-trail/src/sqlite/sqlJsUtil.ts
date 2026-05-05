import type { Database } from 'sql.js';

type SqlJsParam = string | number | null | Uint8Array;

/** prepare + 全行取得 (better-sqlite3 の prepare().all() 相当) */
export function all<T = Record<string, unknown>>(db: Database, sql: string, params: ReadonlyArray<unknown> = []): T[] {
  const stmt = db.prepare(sql);
  try {
    if (params.length > 0) stmt.bind(params as SqlJsParam[]);
    const rows: T[] = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject() as T);
    }
    return rows;
  } finally {
    stmt.free();
  }
}

/** prepare + 単一行 (better-sqlite3 の prepare().get() 相当) */
export function get<T = Record<string, unknown>>(db: Database, sql: string, params: ReadonlyArray<unknown> = []): T | undefined {
  const stmt = db.prepare(sql);
  try {
    if (params.length > 0) stmt.bind(params as SqlJsParam[]);
    if (stmt.step()) return stmt.getAsObject() as T;
    return undefined;
  } finally {
    stmt.free();
  }
}

/** INSERT/UPDATE/DELETE を実行し、影響行数を返す (better-sqlite3 の prepare().run() 相当) */
export function run(db: Database, sql: string, params: ReadonlyArray<unknown> = []): { changes: number } {
  if (params.length > 0) {
    db.run(sql, params as SqlJsParam[]);
  } else {
    db.run(sql);
  }
  return { changes: db.getRowsModified() };
}
