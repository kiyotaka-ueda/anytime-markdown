# Anytime Trail

![VS Marketplace](https://img.shields.io/visual-studio-marketplace/v/anytime-trial.anytime-trail?label=VS%20Marketplace&logo=visual-studio-code)![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=anytime-trial_anytime-markdown&metric=alert_status)![Bugs](https://sonarcloud.io/api/project_badges/measure?project=anytime-trial_anytime-markdown&metric=bugs)![Code Smells](https://sonarcloud.io/api/project_badges/measure?project=anytime-trial_anytime-markdown&metric=code_smells)![Coverage](https://sonarcloud.io/api/project_badges/measure?project=anytime-trial_anytime-markdown&metric=coverage)![Duplicated Lines (%)](https://sonarcloud.io/api/project_badges/measure?project=anytime-trial_anytime-markdown&metric=duplicated_lines_density)

**コードを書きながら、アーキテクチャを見る。**

TypeScript プロジェクトを解析して C4 アーキテクチャ図と DSM（依存構造マトリクス）を自動生成。\
Claude Code のセッションログを可視化して、AI との作業履歴を分析。\
サイドバーの Note パネルでスクリーンショットを Claude Code と共有できます。


## Note — AI にスクリーンショットを見せる

サイドバー最上部の **Note** パネルで複数ページのノートを管理し、AI に視覚情報を共有できます。

**使い方:**

1. サイドバーの **Note** で `+` ボタンを押して新規ページを作成する
2. Anytime Markdown でノートを開き、スクリーンショットや表をクリップボードから貼り付ける
3. Claude Code で `/anytime-note バグを修正して` と指示する
4. AI がノートの画像を読み取り、作業を実行する

> Claude Code がインストールされている場合、最初のノート作成時に `/anytime-note` スキルが自動生成されます。

**ツールバーアクション**

| アイコン | 動作 |
| --- | --- |
| `+` | ノートページを追加 |
| book | `/anytime-note` スキルファイルを開く |
| trash | 全ノートページと画像を削除 |

> ノートファイルはこの拡張機能の VS Code グローバルストレージに保存されます。\
> スキルファイルは `~/.claude/skills/anytime-note/SKILL.md` に生成されます。


## C4 アーキテクチャ図 & DSM

1コマンドで TypeScript プロジェクト全体の構造を4段階の詳細度で可視化します。

| レベル | 見えるもの |
| --- | --- |
| L1 System Context | システム全体と外部との関係 |
| L2 Container | アプリ・API・DB などの構成要素 |
| L3 Component | パッケージ・モジュール間の依存 |
| L4 Code | ファイル単位のすべての依存関係 |

![C4 Mermaid ダイアグラムの例](images/c4-mermaid.png)

**ライブビューア** (`http://localhost:19841`)

- C4 グラフ、DSM マトリクス、要素ツリーの3ペイン構成
- L1〜L4 のレベル切替でドリルダウン
- DSM のクラスタリングで関連モジュールをグルーピング
- 循環依存を赤枠でハイライト
- VS Code での再解析・インポートが即座に反映（WebSocket）
- **F-C Map**: Feature-Component 対応マトリクスを表示（DSM パネル内で切り替え）
- **削除要素表示**: 解析で消失した要素に削除フラグを付与し、取り消し線と半透明で表示
- **ドキュメントリンク**: `c4Scope` フロントマターを持つ Markdown ファイルを C4 要素と紐付けてビューア内から開く
- **Claude アクティビティオーバーレイ**: Claude Code が編集中のファイルを C4 グラフ上にハイライト表示

**インポート / エクスポート**

- Mermaid C4 形式（`.mmd`）のインポートに対応
- JSON / Mermaid 形式でエクスポート可能


## Trail Viewer — Claude Code セッション分析

`http://localhost:19841` でブラウザビューアを起動し、Claude Code の作業ログを分析します。

**取り込み**

Claude Code が `~/.claude/` に書き出す JSONL ログを SQLite DB にインポート。\
サイドバーの **Database** パネルの SQLite 行のインラインボタンから手動インポートを実行できます。

**ビューア機能**

- セッション一覧（ブランチ・モデル・日時でフィルタ）
- Analytics タブ: モデル別・日別のコスト推定、ツール使用量統計、コミット統計
- Prompts タブ: Claude Code スキル・`settings.json` の内容を表示

**リモート同期**

ローカル SQLite のデータを Supabase または PostgreSQL に同期。\
複数開発者でのデータ統合やクラウドバックアップに活用できます。


## AI Memory

サイドバーの **Memory** パネルに、現在のプロジェクトの Claude Code メモリファイルが一覧表示されます。\
エントリをクリックすると Anytime Markdown で開いて編集できます。

> `~/.claude/projects/<project>/memory/` から読み込みます。\
> Claude Code がインストールされていない場合は非表示になります。


## カバレッジ統合

`anytimeTrail.coverage.path` に `coverage-final.json` のパスを設定すると、\
ファイル変更を自動検出してカバレッジデータを C4 ビューアに反映します。

- カバレッジスナップショットを変更ごとに保存（`coverage.historyLimit` で保存件数を設定）
- C4 ツリーの L4 ノードの右クリックメニューからカバレッジ付きテストを直接実行


## はじめかた

### 1. C4 解析を実行する

`Ctrl+Shift+P` → `C4: Analyze Code`

ブラウザタブが自動で開き、プロジェクトのアーキテクチャが表示されます。\
再解析時は既存タブをリアルタイム更新します（新タブは開きません）。

> Mermaid C4 ファイルをインポートする場合は `Anytime Trail: Import C4` を使用してください。

### 2. Trail Viewer を開く

**Dashboard** サイドバーパネルの **Open Trail Viewer** をクリック、または `Anytime Trail: Open Trail Viewer` コマンドを実行。\
ブラウザが `http://localhost:19841` で開きます。

JSONL セッションログをインポートするには、**Database** パネルの SQLite 行のインラインボタンをクリックします。

### 3. Claude Code フック（自動セットアップ）

拡張機能の起動時に、Claude Code フックが `~/.claude/settings.json` に自動登録されます。\
手動設定なしにリアルタイムのファイル編集状態トラッキングが有効になります。


## 設定一覧

| 設定キー | デフォルト | 説明 |
| --- | --- | --- |
| `anytimeTrail.trailServer.port` | `19841` | サーバーのポート番号 |
| `anytimeTrail.c4.analyzeExcludePatterns` | `[".worktrees", ...]` | C4 解析から除外するディレクトリ名パターン |
| `anytimeTrail.docsPath` | `""` | C4 ドキュメントリンク用ドキュメントディレクトリの絶対パス |
| `anytimeTrail.coverage.path` | `""` | `coverage-final.json` へのパス（ワークスペースルートからの相対パス） |
| `anytimeTrail.coverage.historyLimit` | `50` | カバレッジ履歴スナップショットの最大保存件数 |
| `anytimeTrail.test.e2eCommand` | `cd packages/web-app && npm run e2e` | E2E テスト実行コマンド（ターミナルで実行） |
| `anytimeTrail.test.coverageCommand` | `npx jest --coverage --maxWorkers=1` | カバレッジ付きテスト実行コマンド（ターミナルで実行） |
| `anytimeTrail.database.storagePath` | `""` | `trail.db` の保存先。絶対パスまたはワークスペースルートからの相対パス。空の場合は `.vscode/` |
| `anytimeTrail.claudeStatus.directory` | `""` | `claude-code-status.json` の保存先。空の場合は `.vscode/` |
| `anytimeTrail.remote.provider` | `none` | リモート DB プロバイダー（`none` / `supabase` / `postgres`） |
| `anytimeTrail.remote.supabaseUrl` | `""` | Supabase プロジェクト URL（例: `https://xxx.supabase.co`） |
| `anytimeTrail.remote.supabaseAnonKey` | `""` | Supabase anon キー |
| `anytimeTrail.remote.postgresUrl` | `""` | PostgreSQL 接続文字列（例: `postgres://user:pass@host:5432/db`） |


## ライセンス

[MIT](https://github.com/anytime-trial/anytime-markdown/blob/master/LICENSE)
