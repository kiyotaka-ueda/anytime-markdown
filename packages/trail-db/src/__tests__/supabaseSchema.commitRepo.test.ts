import fs from 'node:fs';
import path from 'node:path';

const schemaPath = path.resolve(__dirname, '../../../../supabase/migrations/001_schema.sql');

describe('Supabase commit schema repository indexes', () => {
  const schema = fs.readFileSync(schemaPath, 'utf8');

  it('stores repository names on commit tables and uses repo-aware primary keys', () => {
    expect(schema).toMatch(/CREATE TABLE IF NOT EXISTS trail_session_commits \([\s\S]*repo_name TEXT NOT NULL DEFAULT ''[\s\S]*PRIMARY KEY \(session_id, repo_name, commit_hash\)/);
    expect(schema).toMatch(/CREATE TABLE IF NOT EXISTS trail_commit_files \([\s\S]*repo_name TEXT NOT NULL DEFAULT ''[\s\S]*PRIMARY KEY \(repo_name, commit_hash, file_path\)/);
  });

  it('indexes activity chart commit queries by committed_at and repo/hash', () => {
    expect(schema).toContain('CREATE INDEX IF NOT EXISTS idx_trail_session_commits_committed_at ON trail_session_commits(committed_at)');
    expect(schema).toContain('CREATE INDEX IF NOT EXISTS idx_trail_session_commits_repo_committed_at ON trail_session_commits(repo_name, committed_at)');
    expect(schema).toContain('CREATE INDEX IF NOT EXISTS idx_trail_session_commits_repo_hash ON trail_session_commits(repo_name, commit_hash)');
    expect(schema).toContain('CREATE INDEX IF NOT EXISTS idx_trail_commit_files_repo_hash ON trail_commit_files(repo_name, commit_hash)');
  });
});
