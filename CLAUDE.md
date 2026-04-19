# anytime-markdown プロジェクト固有ルール

更新日: 2026-04-20

`~/.claude/CLAUDE.md` のグローバル規約に加え、本リポジトリ固有の運用ルールをここに記載する。

## デザインシステム

UI / 画面コンポーネントの実装・修正時は、以下の仕様書を**必ず Read してから着手**する。

- `/Shared/anytime-markdown-docs/spec/12.design/design.md`

詳細な適用ルールは `~/.claude/rules/screen-design.md` を参照。\
本プロジェクトはダーク／ライト両モード対応のため、片方のみ実装することは禁止する。

## コードの共通化

本リポジトリは VS Code 拡張機能と Web アプリが同一機能を提供するケースが多い。実装の二重化を防ぐため、新機能・機能追加の着手前に以下を必ず実施する。

### 着手前の重複チェック

- 実装前に、関連キーワードで全パッケージを Grep し、既存実装の有無を確認する。対象は `packages/` 配下全体（VS Code 拡張・Web アプリ・共通パッケージ）。
- 類似実装が複数パッケージに存在する、または今回の変更で複数パッケージに同種のコードが生まれる場合、**実装を始める前に**以下のいずれかをユーザーに確認する:
  - 共通パッケージ（`editor-core` 等）へ抽出して両者から import する
  - どちらか片方に寄せて、もう片方は薄いラッパーにする
  - 意図的に分離したままにする（理由を明示）
- 確認なしに片側だけ実装・修正することは禁止する。片側のみ変更するとコードベース全体で機能の乖離が進行するため。

### 配置の原則

- VS Code 拡張と Web アプリの両方で使うロジック・UI は、原則として共通パッケージに配置する。
- プラットフォーム依存部分（VS Code API、Next.js ルーティング等）のみを各パッケージ側に残し、共通部分は薄いラッパーから呼び出す構造にする。
- ロジックは共通、表示層の差異はラッパーで吸収する。

### 指示の受け取り方

- 「X に機能を追加して」という指示を受けた際、その X が複数パッケージに存在する可能性がある場合は、実装前に「どのパッケージに追加するか」「共通化されているか」を確認する。指示をそのまま片側へのみ適用しない。

## C4 コード解析（trail-core）

### ProjectAnalyzer のファイルスコープ

`ProjectAnalyzer` は `tsconfig.json` の `include`/`exclude` を C4 解析スコープとして使用する。\
`tsc` のような import 追跡ではなく、`parseJsonConfigFileContent()` が返すファイル一覧を起点とするため、**import チェーンに乗らないファイル（webpack エントリーポイント等）は `include` に含まれなければ解析されない**。

### C2 エッジが生成されない場合の確認手順

C2（コンテナ間）のエッジが C4 ビューに表示されない場合、以下の順に確認する。

1. **ファイルが解析対象か確認する**

   ```bash
   sqlite3 ~/.claude/trail/trail.db \
     "SELECT graph_json FROM current_graphs WHERE repo_name='<repo>';" \
     | node -e "
       const d = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
       console.log(d.nodes.filter(n => n.id.includes('<package>')).length);
     "
   ```

   ノード数がゼロなら、そのパッケージのファイルが解析されていない。

2. **tsconfig の `include` を確認する**

   `include: ["src/**/*.ts"]` のように拡張子を明示したパターンは `.tsx` を取りこぼす。\
   `ProjectAnalyzer` は `*.ts` パターンを自動的に `*.tsx` へ拡張するが、`exclude` で除外されている場合はその限りでない。

3. **webpack エントリーポイントかどうか確認する**

   TypeScript の import チェーンに乗らずに webpack から直接参照されるファイルは、`include` に明示されなければ解析対象にならない。\
   この場合は対象パッケージの `tsconfig.json` の `include` を `src/**/*` に修正する。

### tsconfig.json の `include` 記述方針

解析対象パッケージの `tsconfig.json` は `include: ["src/**/*"]` を標準とする。\
拡張子を絞る場合（例: `*.ts` のみ）は C4 解析から除外される `.tsx` ファイルが生じないか確認する。

- **OK**: `["src/**/*"]` — `.ts`・`.tsx` を含む全ソースファイルが対象
- **要注意**: `["src/**/*.ts"]` — `.tsx` が除外される（`ProjectAnalyzer` が自動補完するが、意図的な除外と区別できない）

### L2（コンテナ間）エッジの生成メカニズム

`trailToC4()` が L3 の file-to-file エッジをパッケージ名で集約し、L2 エッジを自動生成する。\
L2 エッジが欠落している場合、原因は必ず L3 エッジの欠落（＝ファイルが解析対象外）にある。\
**L2 エッジを直接操作・手動追加しない**。L3 が正しく解析されれば L2 は自動導出される。

## Supabase

### Supabase スキーマ変更

- **Supabase のマイグレーションファイルを新規追加しない**。`supabase/migrations/001_schema.sql` を直接編集する。
- 理由: 本プロジェクトでは Supabase のテーブルを毎回すべて削除してから再作成する運用のため、連番マイグレーションの履歴管理は不要。
- Supabase の新規テーブル・カラム追加時は `001_schema.sql` の適切な位置に追記する。関連テーブルはコメントで役割を明記する。
- 本ルールは Supabase のみに適用される。ローカル SQLite（拡張機能の `trail.db`）のスキーマ変更では、既存データを保持するため `ALTER TABLE` やマイグレーション関数（例: `migrateCurrentGraphsSchema`）を使う。

### 同期方式

- 拡張機能 (`SyncService`) から Supabase への同期は **洗い替え（wash-away）方式** を原則とする。
- 具体的には「対象テーブルを DELETE → ローカル DB の全行を upsert」の順で実行する。
- 差分同期（追加/更新/削除の判定）は行わない。一貫性を優先し、毎回すべて置き換える。
- 例: `current_graphs` → `trail_current_c4_models` の同期は `clearCurrentC4Models()` 後に全行 `upsertCurrentC4Model()` を呼ぶ。
