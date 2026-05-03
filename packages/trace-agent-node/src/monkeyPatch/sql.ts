import { globalRecorder } from '../globalRecorder';

export function patchSql(): void {
    tryPatchPg();
    tryPatchMysql2();
    tryPatchBetterSqlite3();
}

function tryPatchPg(): void {
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const pg = require('pg') as { Client: { prototype: { query: (...args: unknown[]) => unknown } } };
        const original = pg.Client.prototype.query;
        pg.Client.prototype.query = function patchedQuery(this: unknown, ...args: unknown[]) {
            globalRecorder.io('__process__', 'L_pg', 'pg.query', { sql: String(args[0]).slice(0, 200) });
            return original.apply(this, args as Parameters<typeof original>);
        };
    } catch { /* pg not installed */ }
}

function tryPatchMysql2(): void {
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const mysql2 = require('mysql2') as { Connection: { prototype: { query: (...args: unknown[]) => unknown } } };
        const original = mysql2.Connection.prototype.query;
        mysql2.Connection.prototype.query = function patchedQuery(this: unknown, ...args: unknown[]) {
            globalRecorder.io('__process__', 'L_mysql2', 'mysql2.query', { sql: String(args[0]).slice(0, 200) });
            return original.apply(this, args as Parameters<typeof original>);
        };
    } catch { /* mysql2 not installed */ }
}

function tryPatchBetterSqlite3(): void {
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const BetterSqlite3 = require('better-sqlite3') as { prototype: { prepare: (sql: string) => unknown } };
        const original = BetterSqlite3.prototype.prepare;
        BetterSqlite3.prototype.prepare = function patchedPrepare(this: unknown, sql: string) {
            globalRecorder.io('__process__', 'L_sqlite3', 'sqlite3.prepare', { sql: sql.slice(0, 200) });
            return original.call(this, sql);
        };
    } catch { /* better-sqlite3 not installed */ }
}
