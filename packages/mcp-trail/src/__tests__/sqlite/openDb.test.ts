import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { openTrailDb } from '../../sqlite/openDb';

describe('openTrailDb', () => {
  let tmpDir: string;
  let tmpDbPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-trail-test-'));
    tmpDbPath = path.join(tmpDir, 'test.db');
    // 事前に DB ファイルを作成しておく
    const seed = new Database(tmpDbPath);
    seed.exec('CREATE TABLE test (id INTEGER PRIMARY KEY)');
    seed.close();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('readonly モードで開ける', () => {
    const db = openTrailDb(tmpDbPath, 'readonly');
    expect(db).toBeDefined();
    // readonly なので書き込みは失敗するはず
    expect(() => db.exec('INSERT INTO test (id) VALUES (1)')).toThrow();
    db.close();
  });

  it('readwrite モードで開ける', () => {
    const db = openTrailDb(tmpDbPath, 'readwrite');
    expect(db).toBeDefined();
    expect(() => db.exec('INSERT INTO test (id) VALUES (1)')).not.toThrow();
    db.close();
  });

  it('readwrite モードで journal_mode が wal になる', () => {
    const db = openTrailDb(tmpDbPath, 'readwrite');
    const result = db.pragma('journal_mode') as Array<{ journal_mode: string }>;
    expect(result[0].journal_mode).toBe('wal');
    db.close();
  });

  it('存在しないパスで fileMustExist により throw する', () => {
    const nonExistentPath = path.join(tmpDir, 'does-not-exist.db');
    expect(() => openTrailDb(nonExistentPath, 'readonly')).toThrow();
  });

  it('存在しないパスを readwrite で開こうとしても fileMustExist により throw する', () => {
    const nonExistentPath = path.join(tmpDir, 'does-not-exist.db');
    expect(() => openTrailDb(nonExistentPath, 'readwrite')).toThrow();
  });
});
