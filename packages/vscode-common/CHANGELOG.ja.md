# 変更履歴

`@anytime-markdown/vscode-common` に対するすべての重要な変更をこのファイルに記録します。

フォーマットは [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) に基づいています。

## [Unreleased]

## [0.1.2] - 2026-05-04

### 追加

- `TimelineProvider` を `vscode-history-extension` から移植し共有化
- JST 日付整形用 `jstDateString` ヘルパーを抽出

### 修正

- 今日の統計計算の効率を改善

## [0.1.1] - 2026-04-18

### 追加

- エージェントマップ対応のマルチファイル `ClaudeStatusWatcher`
- ブランチフィールド付きセッション ID ベースのステータスファイル管理
- マルチエージェント追跡用 `AgentInfo` 型
- Write イベント時に `plannedEdits` を書き込むプランファイルフック
- `ClaudeStatusWatcher` に `getPlannedEdits()` を追加
- `ClaudeStatus` に `plannedEdits` フィールドを追加
- セッション編集履歴を `claude-code-status.json` に永続化

### 修正

- TS2352 解決のため `ClaudeStatus` キャストを `unknown` 経由に修正
- Claude フックコマンドの `jq` を `node` に置き換え

## [0.1.0] - 2026-04-13

### 追加

- 初回リリース: VS Code 拡張向け `ClaudeStatusWatcher`
