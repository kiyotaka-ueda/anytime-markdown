import Database from 'better-sqlite3';

export function openTrailDb(dbPath: string, mode: 'readonly' | 'readwrite'): Database.Database {
  const db = new Database(dbPath, {
    readonly: mode === 'readonly',
    fileMustExist: true,
  });
  if (mode === 'readwrite') {
    db.pragma('journal_mode = WAL');
    db.pragma('busy_timeout = 1000');
  }
  return db;
}
