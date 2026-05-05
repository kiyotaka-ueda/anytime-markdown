# 変更履歴

"mcp-trail" パッケージの主な変更をこのファイルに記録します。

形式は [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) に基づいています。

## [Unreleased]

### 追加

- 読み取り系ツール（`get_c4_model` / `list_elements` / `list_groups` / `list_relationships` / `list_communities`）を SQLite 直アクセス化。Anytime Trail サイドバー未起動環境でも MCP ツールが動作する
- 書き込み系ツールに probe ベースの自動切替を追加。TrailDataServer 生存時は HTTP 経由、未起動時は SQLite 直書き（WAL モード + 指数バックオフリトライ）にフォールバック
- 環境変数 `TRAIL_DB_PATH` / `TRAIL_WORKSPACE_PATH` / `MCP_TRAIL_FORCE_DIRECT` を追加（CI / ヘッドレス用途）
- VS Code 拡張が mcp-trail サーバ起動時に `TRAIL_WORKSPACE_PATH` を渡すよう改修。ワークスペース配下の `.vscode/trail.db` を自動解決可能に

### 変更

- `analyze_*` 系（`analyze_current_code` / `analyze_release_code` / `analyze_all` / `get_analyze_status`）は引き続き TrailDataServer 必須。未起動時は明示的なエラーで誘導
- `better-sqlite3` 12.9.0 を native 依存として追加（webpack で外部化、VSIX 同梱の `node_modules` から実行時ロード）

## [0.10.0] - 2026-05-04

### 追加

- インメモリ DB 競合を回避するコミュニティ書き込みツール（`upsert_community_mappings`・`upsert_community_summaries`）
- 解析パイプライントリガーツールと HTTP API エンドポイントを追加

## [0.9.1] - 2026-05-02

### 変更

- モノレポのワークスペースに追加し、Jest カバレッジ設定を整備
