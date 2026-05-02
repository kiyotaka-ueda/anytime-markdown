---
title: current_coverage テーブル追加（リリース非依存の最新カバレッジ保存）
date: 2026-05-02
status: completed
---

## 目的

現在 `release_coverage` テーブルは `release_tag` を主キー要素として `releases(tag) ON DELETE CASCADE` で外部キー制約されており、リリースタグが付いていない時点のカバレッジを保存できない。\
リリース未作成のリポジトリや、最新コミットでのカバレッジを参照したいユースケース（C4 ビュー上での coverage オーバーレイの「リリース未付与」状態）に対応するため、リポジトリ単位で最新カバレッジを保持する `current_coverage` テーブルを新設する。

既存の current 系テーブル（`current_graphs`）と同じく、リポジトリ単位で 1 セットを上書きで保持する設計に揃える。\
`release_coverage` は履歴蓄積、`current_coverage` は最新スナップショットと役割を分離する。


## 委任ルール

このプランの実装タスクは Codex（`codex:codex-rescue` subagent）に委任する。\
詳細は `~/.claude/rules/codex-delegation.md` に従う。


### 委任しない作業

- ブランチ作成・worktree 操作 → Claude が実施
- コミット（3 点確認込み）・push・PR 作成 → Claude が実施
- 破壊的操作（リリース・force push 等）→ Claude が実施


## 設計方針


### 新規テーブル

```sql
CREATE TABLE IF NOT EXISTS current_coverage (
  repo_name          TEXT    NOT NULL,
  package            TEXT    NOT NULL,
  file_path          TEXT    NOT NULL,
  lines_total        INTEGER NOT NULL DEFAULT 0,
  lines_covered      INTEGER NOT NULL DEFAULT 0,
  lines_pct          REAL    NOT NULL DEFAULT 0,
  statements_total   INTEGER NOT NULL DEFAULT 0,
  statements_covered INTEGER NOT NULL DEFAULT 0,
  statements_pct     REAL    NOT NULL DEFAULT 0,
  functions_total    INTEGER NOT NULL DEFAULT 0,
  functions_covered  INTEGER NOT NULL DEFAULT 0,
  functions_pct      REAL    NOT NULL DEFAULT 0,
  branches_total     INTEGER NOT NULL DEFAULT 0,
  branches_covered   INTEGER NOT NULL DEFAULT 0,
  branches_pct       REAL    NOT NULL DEFAULT 0,
  updated_at         TEXT    NOT NULL DEFAULT '',
  PRIMARY KEY (repo_name, package, file_path)
);
CREATE INDEX IF NOT EXISTS idx_current_coverage_repo ON current_coverage(repo_name);
```

- `release_coverage` から `release_tag` 列を `repo_name` + `updated_at` に置き換え、外部キー制約を外した形。
- `(repo_name, package, file_path)` を主キーにし、リポジトリ単位で最新値のみを保持する。


### 書き込み戦略（洗い替え）

`current_coverage` はリポジトリ単位で最新値のみを保持するため、洗い替え（wash-away）方式を採用する。

1. 対象 `repo_name` の行を `DELETE` する。
2. `<gitRoot>/packages/*/coverage/coverage-summary.json` を全パッケージ走査して `INSERT` する。
3. `updated_at` には現在時刻（ISO 8601 UTC）を入れる。

これは既存 `importCoverage` のロジックを、リリース非依存に書き直したもの。\
`releases` テーブルの状態に依存しない（最新タグを引かなくてよい）。


### 呼び出し経路

`TrailDatabase.importAll` の `importCoverage` 直後に `importCurrentCoverage(gitRoot, repoName)` を呼び、両方とも更新する。

- `releases` がある: `release_coverage`（最新タグ）+ `current_coverage`（リポ単位）両方を書く。
- `releases` がない: `current_coverage` のみ書かれ、`release_coverage` は no-op。


### 読み取り経路

`TrailDataServer` の `/api/c4/coverage` で、`releases` の最新タグが存在しない／`release_coverage` が空の場合に `current_coverage` を二段目フォールバックとして使う。

優先順位: `release_coverage(latestTag)` → `current_coverage(repoName)` → `coverage-final.json` 直読み。


## 影響範囲

| 種別 | パス |
| --- | --- |
| 新規 | `packages/trail-core/src/domain/schema/tables.ts` に `CREATE_CURRENT_COVERAGE` 定数を追加 |
| 新規 | `packages/trail-core/src/domain/schema/indexes.ts` に `idx_current_coverage_repo` を追加 |
| 新規 | `packages/trail-core/src/domain/model/task.ts` に `CurrentCoverageRow` 型を追加 |
| 修正 | `packages/vscode-trail-extension/src/trail/TrailDatabase.ts` に `createTables` での登録、`importCurrentCoverage`、`getCurrentCoverage` を追加し、`importAll` から呼び出す |
| 修正 | `packages/vscode-trail-extension/src/server/TrailDataServer.ts` の `/api/c4/coverage` フォールバックを拡張 |
| 新規 | `packages/vscode-trail-extension/src/trail/__tests__/TrailDatabase.currentCoverage.test.ts` |
| 修正 | `/Shared/anytime-markdown-docs/spec/40.trail-viewer/import-vs-analyze.ja.md` に `current_coverage` 行を追加 |


## タスク


### タスク 1: schema 定義と型追加（trail-core）

- **対象ファイル**:
    - `/anytime-markdown/packages/trail-core/src/domain/schema/tables.ts`
    - `/anytime-markdown/packages/trail-core/src/domain/schema/indexes.ts`
    - `/anytime-markdown/packages/trail-core/src/domain/model/task.ts`
- **変更禁止**:
    - 上記以外のファイル
    - 既存の `CREATE_RELEASE_COVERAGE` / `ReleaseCoverageRow` の定義
- **完了条件**:
    1. `tables.ts` に `CREATE_CURRENT_COVERAGE` 定数が追加され、上記設計方針の SQL と一致する
    2. `indexes.ts` の `CREATE_INDEXES` 配列または新規定数に `idx_current_coverage_repo` が含まれる
    3. `task.ts` に `CurrentCoverageRow` 型が追加され、`ReleaseCoverageRow` と同じカバレッジ列構成を持つ（`release_tag` の代わりに `repo_name` と `updated_at` を持つ）
    4. `npx tsc --noEmit -p packages/trail-core/tsconfig.json` が通る
- **検証**:
    - `npx tsc --noEmit -p packages/trail-core/tsconfig.json`
    - `npm run build --workspace=@anytime-markdown/trail-core`
- **委任プロンプト**:

    ```text
    packages/trail-core/src/domain/schema/tables.ts に CREATE_CURRENT_COVERAGE 定数を追加してください。
    内容は plan/2026-05-02-current-coverage-table.md の「設計方針 → 新規テーブル」と完全に一致させてください。

    指針:
    - 既存の CREATE_RELEASE_COVERAGE と同じ書式（バッククォート + テンプレート）に揃える
    - 列は repo_name, package, file_path, lines_*, statements_*, functions_*, branches_*, updated_at の順
    - 主キーは (repo_name, package, file_path)
    - releases への外部キー制約は付けないこと（current は履歴と独立）

    続いて packages/trail-core/src/domain/schema/indexes.ts に
    'CREATE INDEX IF NOT EXISTS idx_current_coverage_repo ON current_coverage(repo_name)'
    を追加してください。配置は CREATE_INDEXES 配列の末尾でも、
    新しい CREATE_CURRENT_INDEXES 配列でも構いませんが、export を維持してください。

    最後に packages/trail-core/src/domain/model/task.ts に CurrentCoverageRow 型を追加してください。
    ReleaseCoverageRow から release_tag を削除し、repo_name (string) と updated_at (string) を加えた構造とします。
    既存の ReleaseCoverageRow は変更しないこと。

    検証:
    - npx tsc --noEmit -p packages/trail-core/tsconfig.json
    - npm run build --workspace=@anytime-markdown/trail-core
    両方が通ること。
    NG: 既存の CREATE_RELEASE_COVERAGE / ReleaseCoverageRow を変更しないこと。
    ```


### タスク 2: TrailDatabase に importCurrentCoverage / getCurrentCoverage を追加

- **対象ファイル**:
    - `/anytime-markdown/packages/vscode-trail-extension/src/trail/TrailDatabase.ts`
    - `/anytime-markdown/packages/vscode-trail-extension/src/trail/__tests__/TrailDatabase.currentCoverage.test.ts`（新規）
- **変更禁止**:
    - `release_coverage` 系メソッド（`importCoverage` / `getCoverageByTag` / `getCoverageSummary`）の挙動変更
    - `importAll` の他フェーズ（commits / releases / sessions / message_tool_calls 等）
    - 他テストファイル
- **完了条件**:
    1. `createTables()` 内で新規スキーマと新規インデックスが登録される
    2. `importCurrentCoverage(gitRoot: string, repoName: string): number` メソッドが追加され、洗い替え方式（`DELETE FROM current_coverage WHERE repo_name = ?` → `INSERT`）で動作する
    3. `getCurrentCoverage(repoName: string): CurrentCoverageRow[]` が追加される
    4. `importAll` の `importCoverage` の直後に `importCurrentCoverage(gitRoot, path.basename(gitRoot))` が呼び出される
    5. `importAll` の戻り値に `currentCoverageImported: number` が追加される（既存フィールドは破壊しない）
    6. TDD で書いたテストファイル `TrailDatabase.currentCoverage.test.ts` が通る。最低 3 ケース:
       - 最初の取り込みで該当パッケージの行が挿入されること
       - 2 回目の取り込みでファイル内容が変わったとき、古い行が DELETE され新しい行のみ残ること（洗い替え動作）
       - `coverage-summary.json` がないパッケージはスキップされること
    7. `npx jest packages/vscode-trail-extension/src/trail/__tests__/TrailDatabase.currentCoverage.test.ts --maxWorkers=1` が通る
- **検証**:
    - `npx jest packages/vscode-trail-extension/src/trail/__tests__/TrailDatabase.currentCoverage.test.ts --maxWorkers=1`
    - `npm run compile --workspace=@anytime-markdown/vscode-trail-extension`
- **委任プロンプト**:

    ```text
    packages/vscode-trail-extension/src/trail/TrailDatabase.ts を修正します。
    前提: タスク 1 が完了し、CREATE_CURRENT_COVERAGE / CurrentCoverageRow / idx_current_coverage_repo が
    @anytime-markdown/trail-core から export されている。

    実装方針:
    1. createTables() の release_coverage 登録の直後で db.run(CREATE_CURRENT_COVERAGE) を呼ぶ
    2. CREATE_INDEXES への追加方法に応じて idx_current_coverage_repo もここで実行されるよう揃える
    3. importCoverage(gitRoot) と同じファイル走査ロジック（packages/*/coverage/coverage-summary.json）を持つ
       importCurrentCoverage(gitRoot: string, repoName: string): number を新設
       - 冒頭で `DELETE FROM current_coverage WHERE repo_name = ?` を実行して洗い替えする
       - INSERT 時に updated_at に new Date().toISOString() を入れる
       - 既存 importCoverage と異なり、releases テーブルの最新タグは参照しない
    4. importAll の `// Import coverage data ...` ブロック直後に
       importCurrentCoverage(gitRoot, path.basename(gitRoot)) を呼ぶ
       - try/catch で失敗を吸収し onProgress でログ
       - importAll の return オブジェクトに currentCoverageImported: number を追加（既存キーは破壊しない）
    5. getCurrentCoverage(repoName: string): CurrentCoverageRow[] を実装
       - getCoverageByTag と同じパターンで sql.js から行を取り出す

    TDD:
    - 先に packages/vscode-trail-extension/src/trail/__tests__/TrailDatabase.currentCoverage.test.ts を作成する
    - テストは TrailDatabase.activityHeatmap.test.ts と同じく __non_webpack_require__ の差し替え + createTestTrailDatabase() を使う
    - tmp ディレクトリに gitRoot 風のディレクトリ構造（packages/<pkg>/coverage/coverage-summary.json）を作って importCurrentCoverage を呼ぶ
    - ケース最低 3 つ:
      a) 初回投入で行が入ること
      b) 同じ repo_name で 2 回目の投入（内容変更）で古い行が消えて新しい行だけ残ること
      c) coverage-summary.json がないパッケージは skip され、件数 0 であること

    検証:
    - npx jest packages/vscode-trail-extension/src/trail/__tests__/TrailDatabase.currentCoverage.test.ts --maxWorkers=1
    - npm run compile --workspace=@anytime-markdown/vscode-trail-extension

    NG リスト:
    - release_coverage 系のメソッド・SQL を変更しないこと
    - importAll の他フェーズ（commits / sessions / messages / message_tool_calls / releases）に手を入れないこと
    - global add（git add . / -A）禁止
    ```


### タスク 3: TrailDataServer の coverage API に current_coverage フォールバックを追加

- **対象ファイル**:
    - `/anytime-markdown/packages/vscode-trail-extension/src/server/TrailDataServer.ts`
- **変更禁止**:
    - 他 API ハンドラー（`/api/sessions` / `/api/c4/*` 以外）
    - `aggregateCoverageFromDb` などの trail-core 関数（型変更しない）
- **完了条件**:
    1. `/api/c4/coverage` の処理で、最新リリースタグが取れない or `release_coverage` が空のとき `getCurrentCoverage(repoName)` を試す
    2. `getCurrentCoverage` の結果を `aggregateCoverageFromDb` に渡せるよう、`ReleaseCoverageRow` 互換に詰め直す（`release_tag` には `'__current__'` のような疑似値を入れる）。trail-core 側の関数シグネチャは変更しない
    3. 全フォールバックが空のときの既存挙動（`coverageMatrix: null` を返す）は変えない
    4. `npm run compile --workspace=@anytime-markdown/vscode-trail-extension` が通る
- **検証**:
    - `npm run compile --workspace=@anytime-markdown/vscode-trail-extension`
    - 既存テスト: `npx jest packages/vscode-trail-extension/src/server/__tests__ --maxWorkers=1`
- **委任プロンプト**:

    ```text
    packages/vscode-trail-extension/src/server/TrailDataServer.ts の handleC4CoverageEndpoint を拡張します。
    前提: タスク 2 で TrailDatabase.getCurrentCoverage(repoName) が利用可能になっている。

    実装方針:
    1. 現状のフロー: latestTag → release_coverage → coverage-final.json 直読み
    2. 新フロー:    latestTag → release_coverage → current_coverage → coverage-final.json 直読み
    3. current_coverage 経由のとき、aggregateCoverageFromDb の入力型 (ReleaseCoverageRow[]) に詰め替える
       - release_tag フィールドには '__current__' を入れる（aggregateCoverageFromDb は集計のみで release_tag を表示用に使わない想定）
       - updated_at は使わないので捨てる
    4. trail-core 側の aggregateCoverageFromDb / ReleaseCoverageRow 型は変更しないこと

    NG リスト:
    - 他 API ハンドラーへの変更
    - trail-core 側の型・関数を破壊する変更
    - aggregateCoverageFromDb のシグネチャ変更

    検証:
    - npm run compile --workspace=@anytime-markdown/vscode-trail-extension
    - npx jest packages/vscode-trail-extension/src/server/__tests__ --maxWorkers=1
    ```


### タスク 4: 設計書（import-vs-analyze.ja.md）に current_coverage を反映

- **対象ファイル**:
    - `/Shared/anytime-markdown-docs/spec/40.trail-viewer/import-vs-analyze.ja.md`
- **変更禁止**:
    - 同フォルダ内の他ドキュメント
    - frontmatter の title / date / type
- **完了条件**:
    1. 「2.3 主な書き込みテーブル」表に `current_coverage` 行が追加される（`importAll` ○ / `analyze` — / 入力データ: `<gitRoot>/packages/*/coverage/coverage-summary.json`）
    2. 「2.2 内部フェーズの違い」のフェーズ 7 に `current_coverage` も同タイミングで更新される旨を追記
    3. frontmatter の `updated` を `2026-05-02` で追加
    4. `bash ~/.claude/scripts/validate-markdown.sh /Shared/anytime-markdown-docs/spec/40.trail-viewer/import-vs-analyze.ja.md` が OK を返す
- **検証**:
    - `bash ~/.claude/scripts/validate-markdown.sh /Shared/anytime-markdown-docs/spec/40.trail-viewer/import-vs-analyze.ja.md`
- **委任プロンプト**: Claude が直接更新する（ドキュメント微修正なので Codex 委任不要）


## 進捗

- [x] タスク 1: schema 定義と型追加
- [x] タスク 2: TrailDatabase 拡張（importCurrentCoverage / getCurrentCoverage / importAll 統合 / TDD）
- [x] タスク 3: TrailDataServer の coverage API フォールバック
- [x] タスク 4: 設計書反映


## オープン課題

- Postgres / Supabase 同期: 現状 `release_coverage` も同期対象外のため、`current_coverage` も初期実装では同期しない方針で進める。同期が必要になった時点で別プランで追加する。
- マイグレーション: 既存 `trail.db` には `current_coverage` が存在しないが、`createTables()` の `CREATE TABLE IF NOT EXISTS` で次回起動時に自動作成される。`ALTER TABLE` は不要。
