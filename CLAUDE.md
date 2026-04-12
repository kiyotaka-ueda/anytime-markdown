# anytime-markdown プロジェクト固有ルール

更新日: 2026-04-12

`~/.claude/CLAUDE.md` のグローバル規約に加え、本リポジトリ固有の運用ルールをここに記載する。

## Supabase

### スキーマ変更

- **マイグレーションファイルを新規追加しない**。`supabase/migrations/001_schema.sql` を直接編集する。
- 理由: 本プロジェクトでは Supabase のテーブルを毎回すべて削除してから再作成する運用のため、連番マイグレーションの履歴管理は不要。
- 新規テーブル・カラム追加時は `001_schema.sql` の適切な位置に追記する。関連テーブルはコメントで役割を明記する。

### 同期方式

- 拡張機能 (`SyncService`) から Supabase への同期は **洗い替え（wash-away）方式** を原則とする。
- 具体的には「対象テーブルを DELETE → ローカル DB の全行を upsert」の順で実行する。
- 差分同期（追加/更新/削除の判定）は行わない。一貫性を優先し、毎回すべて置き換える。
- 例: `current_graphs` → `trail_current_c4_models` の同期は `clearCurrentC4Models()` 後に全行 `upsertCurrentC4Model()` を呼ぶ。
