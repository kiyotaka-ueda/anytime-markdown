import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Database } from 'sql.js';

declare const __non_webpack_require__: NodeJS.Require | undefined;

type SqlJsModule = { Database: new (data?: Uint8Array | Buffer) => Database };
let cachedSqlJs: SqlJsModule | undefined;

async function loadSqlJs(): Promise<SqlJsModule> {
  if (cachedSqlJs) return cachedSqlJs;

  // 配布パッケージ (webpack バンドル) では同じ dist/ ディレクトリに sql-asm.js が
  // 配置される前提 (CopyWebpackPlugin) で __non_webpack_require__ で動的にロードする。
  // sql.js を webpack に取り込むとモジュールシステムが壊れるため。
  const sqlAsmPath = path.join(__dirname, 'sql-asm.js');
  if (typeof __non_webpack_require__ !== 'undefined' && fs.existsSync(sqlAsmPath)) {
    const initSqlJs = (__non_webpack_require__ as NodeJS.Require)(sqlAsmPath) as () => Promise<SqlJsModule>;
    cachedSqlJs = await initSqlJs();
    return cachedSqlJs;
  }

  // 開発・テスト時のフォールバック (jest / ts-node 等)
  const mod = await import('sql.js');
  const initSqlJs = ((mod as { default?: () => Promise<SqlJsModule> }).default ?? (mod as unknown as () => Promise<SqlJsModule>));
  cachedSqlJs = await (initSqlJs as () => Promise<SqlJsModule>)();
  return cachedSqlJs;
}

export interface OpenedDb {
  readonly db: Database;
  readonly path: string;
  readonly mode: 'readonly' | 'readwrite';
  /** 現在のメモリ DB をファイルに atomic 書き出し (tmp + rename)。readonly では throw */
  save(): void;
  /** メモリ上の Database を解放 */
  close(): void;
}

/**
 * trail.db を sql.js (WASM) のメモリ DB にロードして返す。
 *
 * - readonly: ロード後に書き込みは保存されない (save() で throw)
 * - readwrite: 呼び出し側で db を変更後 save() で atomic 書き出し
 */
export async function openTrailDb(dbPath: string, mode: 'readonly' | 'readwrite'): Promise<OpenedDb> {
  if (!fs.existsSync(dbPath)) {
    throw new Error(`trail.db not found: ${dbPath}`);
  }
  const SQL = await loadSqlJs();
  const buf = fs.readFileSync(dbPath);
  const db = new SQL.Database(buf);

  const save = (): void => {
    if (mode !== 'readwrite') {
      throw new Error('Cannot save: db opened in readonly mode');
    }
    const data = db.export();
    const tmpPath = `${dbPath}.tmp.${process.pid}.${Date.now()}`;
    fs.writeFileSync(tmpPath, Buffer.from(data));
    fs.renameSync(tmpPath, dbPath);
  };

  const close = (): void => {
    db.close();
  };

  return { db, path: dbPath, mode, save, close };
}
