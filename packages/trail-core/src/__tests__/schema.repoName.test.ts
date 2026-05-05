import {
  CREATE_SESSION_COMMITS,
  CREATE_COMMIT_FILES,
  CREATE_SESSION_COMMIT_RESOLUTIONS,
  CREATE_INDEXES,
} from '../domain/schema';

describe('schema repoName columns', () => {
  it('CREATE_SESSION_COMMITS DDL includes repo_name column', () => {
    expect(CREATE_SESSION_COMMITS).toMatch(/repo_name\s+TEXT\s+NOT\s+NULL\s+DEFAULT\s+''/);
  });

  it('CREATE_COMMIT_FILES DDL includes repo_name column', () => {
    expect(CREATE_COMMIT_FILES).toMatch(/repo_name\s+TEXT\s+NOT\s+NULL\s+DEFAULT\s+''/);
  });

  it('CREATE_SESSION_COMMIT_RESOLUTIONS DDL is exported with composite PK', () => {
    expect(CREATE_SESSION_COMMIT_RESOLUTIONS).toMatch(/CREATE TABLE IF NOT EXISTS session_commit_resolutions/);
    expect(CREATE_SESSION_COMMIT_RESOLUTIONS).toMatch(/session_id\s+TEXT\s+NOT\s+NULL/);
    expect(CREATE_SESSION_COMMIT_RESOLUTIONS).toMatch(/repo_name\s+TEXT\s+NOT\s+NULL/);
    expect(CREATE_SESSION_COMMIT_RESOLUTIONS).toMatch(/resolved_at\s+TEXT\s+NOT\s+NULL/);
    expect(CREATE_SESSION_COMMIT_RESOLUTIONS).toMatch(/PRIMARY KEY\s*\(\s*session_id\s*,\s*repo_name\s*\)/);
  });

  it('CREATE_INDEXES contains repo_name based indexes for commit tables', () => {
    const joined = CREATE_INDEXES.join('\n');
    expect(joined).toMatch(/CREATE INDEX IF NOT EXISTS idx_session_commits_repo ON session_commits\(repo_name, committed_at\)/);
    expect(joined).toMatch(/CREATE INDEX IF NOT EXISTS idx_session_commits_repo_hash ON session_commits\(repo_name, commit_hash\)/);
    expect(joined).toMatch(/CREATE INDEX IF NOT EXISTS idx_commit_files_repo ON commit_files\(repo_name, file_path\)/);
    expect(joined).toMatch(/CREATE INDEX IF NOT EXISTS idx_commit_files_repo_hash ON commit_files\(repo_name, commit_hash\)/);
  });
});
