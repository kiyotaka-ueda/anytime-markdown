-- supabase/migrations/002_c4_multi_repo.sql
-- C4 モデルのリポジトリ別管理対応
--
-- 拡張機能のローカル DB と同様に、current（作業中スナップショット）をリポジトリ別に
-- 保持するため、trail_current_c4_models テーブルを新規追加する。
-- 既存の trail_c4_models はリリース版 C4 モデル（tag でキーイング）として継続利用する。

CREATE TABLE IF NOT EXISTS trail_current_c4_models (
    repo_name  TEXT PRIMARY KEY,
    commit_id  TEXT NOT NULL DEFAULT '',
    model_json TEXT NOT NULL,
    revision   TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT '',
    synced_at  TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE trail_current_c4_models IS
    'C4 モデルのワークスペース current（リポジトリ別）。拡張機能の current_graphs と対応。';
COMMENT ON COLUMN trail_current_c4_models.repo_name IS
    'git リポジトリ名（path.basename(gitRoot)）。trail_releases.repo_name と同じ規則で採番する。';
COMMENT ON COLUMN trail_current_c4_models.commit_id IS
    '解析時点の HEAD コミット ID（git rev-parse HEAD）';
