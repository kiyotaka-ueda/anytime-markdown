import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import initSqlJs, { type SqlJsStatic } from 'sql.js';
import { openTrailDb } from '../../sqlite/openDb';

describe('openTrailDb', () => {
  let tmpDir: string;
  let tmpDbPath: string;
  let SQL: SqlJsStatic;

  beforeAll(async () => {
    SQL = await initSqlJs();
  });

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-trail-test-'));
    tmpDbPath = path.join(tmpDir, 'test.db');
    // 事前に sql.js で DB ファイルを作成しておく
    const seed = new SQL.Database();
    seed.run('CREATE TABLE test (id INTEGER PRIMARY KEY)');
    fs.writeFileSync(tmpDbPath, Buffer.from(seed.export()));
    seed.close();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('readonly モードで開ける', async () => {
    const opened = await openTrailDb(tmpDbPath, 'readonly');
    expect(opened.db).toBeDefined();
    expect(opened.mode).toBe('readonly');
    // readonly なので save は throw する
    expect(() => opened.save()).toThrow(/readonly/);
    opened.close();
  });

  it('readwrite モードで開ける + save() でファイルが更新される', async () => {
    const opened = await openTrailDb(tmpDbPath, 'readwrite');
    expect(opened.db).toBeDefined();
    expect(opened.mode).toBe('readwrite');
    opened.db.run('INSERT INTO test (id) VALUES (1)');
    opened.save();
    opened.close();

    // 再度開いて反映を確認
    const reopened = await openTrailDb(tmpDbPath, 'readonly');
    const stmt = reopened.db.prepare('SELECT id FROM test');
    const rows: number[] = [];
    while (stmt.step()) rows.push(stmt.getAsObject().id as number);
    stmt.free();
    expect(rows).toEqual([1]);
    reopened.close();
  });

  it('save() は atomic（rename ベース）で実装されている', async () => {
    const opened = await openTrailDb(tmpDbPath, 'readwrite');
    opened.db.run('INSERT INTO test (id) VALUES (42)');
    opened.save();
    opened.close();

    // tmp ファイルが残っていないこと
    const remaining = fs.readdirSync(tmpDir).filter((f) => f.includes('.tmp.'));
    expect(remaining).toEqual([]);
  });

  it('存在しないパスで throw する', async () => {
    const nonExistentPath = path.join(tmpDir, 'does-not-exist.db');
    await expect(openTrailDb(nonExistentPath, 'readonly')).rejects.toThrow(/not found/);
  });
});
