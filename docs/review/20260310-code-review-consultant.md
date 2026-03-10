# anytime-markdown v0.3.0 CodeReview Consultant レポート

更新日: 2026-03-10

---


## 議事次第（コード概要）

**プロジェクトの目的**: ブラウザ・VSCode・モバイルで動作する WYSIWYG Markdown エディタ。

**成果物構成（モノレポ・4パッケージ）**:

| パッケージ | 役割 | ファイル数 | バージョン |
| --- | --- | --- | --- |
| `editor-core` | エディタエンジン（TipTap/ProseMirror） | 164 | 0.3.0 |
| `web-app` | Next.js Web アプリ + ランディングページ | 48 | **0.2.5** |
| `vscode-extension` | VS Code 拡張機能 | 11 | 0.3.0 |
| `mobile-app` | モバイル対応（未活発） | - | **0.2.1** |

**リソース**: ソースコード約 32,000 行、依存パッケージ計 94 個。


## 部門報告（モジュール分析）


### editor-core（中核エンジン）

全体の 80% を占める最重要部門。

- TipTap 拡張: Mermaid/PlantUML 図、KaTeX 数式、HTML プレビュー、テーブル、コードブロック
- 差分比較・マージ機能（`InlineMergeView`, `MergeEditorPanel`）
- コメント・アウトライン・検索置換
- Markdown シリアライズ/デシリアライズ（round-trip fidelity）


### web-app（フロントエンド）

Netlify での静的配信。

- Next.js App Router、SEO メタタグ、JSON-LD
- ヘルプページ、Features ページ


### vscode-extension（配信チャネル）

Marketplace 公開済み。

- WebView 内に `editor-core` を埋め込み
- TreeView コメントパネル、ファイル I/O 連携


## リスク管理（問題点の指摘）


### 高リスク

| # | カテゴリ | 詳細 |
| --- | --- | --- |
| 1 | 巨大ファイル | `MarkdownEditorPage.tsx`（869 行）、`EditorToolbar.tsx`（647 行）、`MergeEditorPanel.tsx`（620 行）が 500 行超。\\変更時の影響範囲が大きく、レビュー負荷が高い |
| 2 | バージョン不整合 | root/editor-core/vscode-ext は 0.3.0 だが、`web-app` は 0.2.5、`mobile-app` は 0.2.1。\`version:sync\` が全パッケージに適用されていない |
| 3 | テストカバレッジ不足 | ソース 115 ファイルに対しテスト 37 ファイル（カバレッジ率約 32%）。\\特に UI 系コンポーネント（toolbar, merge, diagram）のテストが薄い |


### 中リスク

| # | カテゴリ | 詳細 |
| --- | --- | --- |
| 4 | vscode-test アーティファクト | `.vscode-test/` に 4 バージョン分の VSCode バイナリが蓄積。\\リポジトリの肥大化原因 |
| 5 | mobile-app の放置 | バージョン 0.2.1 で停滞。\\メンテナンスされないパッケージがモノレポに残ると、依存関係の脆弱性リスクが蓄積する |
| 6 | editorStyles.ts（431 行） | スタイル定義が 1 ファイルに集中。\\テーマ変更やダークモード対応時の変更コストが高い |


### 低リスク

| # | カテゴリ | 詳細 |
| --- | --- | --- |
| 7 | PlantUML 外部依存 | plantuml.com への外部通信。\\サービス停止時にダイアグラム描画が不能になる |
| 8 | 依存パッケージ数 | editor-core 26 個、web-app 38 個、vscode-ext 30 個。\\中規模だが、定期的な audit が必要 |


## 改善提案（最適化案）


### 短期（ROI 高・即実行可能）

| # | 提案 | 対象 | 効果 |
| --- | --- | --- | --- |
| A | バージョン同期の修正 | `web-app`, `mobile-app` | `version:sync` スクリプトの対象に `web-app` を含める。\`mobile-app\` は方針決定（維持 or アーカイブ） |
| B | `.vscode-test` を `.gitignore` に追加 | `vscode-extension` | リポジトリサイズの大幅削減 |
| C | `MarkdownEditorPage` の分割 | `editor-core` | 869 行 → 目標 400 行以下。\\hooks 抽出・パネル系サブコンポーネント分離 |


### 中期（次スプリント候補）

| # | 提案 | 対象 | 効果 |
| --- | --- | --- | --- |
| D | `EditorToolbar` の分割 | `editor-core`（647 行） | `ToolbarButtonGroup`, `ModeToggle`, `FileOpsBar` に分離 |
| E | UI コンポーネントテストの拡充 | `editor-core` | Mermaid/PlantUML/Table/Merge のインタラクションテスト追加。\\カバレッジ率 32% → 50% 目標 |
| F | `editorStyles` のテーマ構造化 | `editor-core` | トークンベースのスタイル分離（colors, spacing, typography） |


### 長期（アーキテクチャ改善）

| # | 提案 | 効果 |
| --- | --- | --- |
| G | PlantUML のフォールバック | ローカルレンダリング対応でオフライン動作を実現 |
| H | `mobile-app` の方針決定 | 維持するなら `editor-core` との連携を再構築、不要ならアーカイブして依存リスクを排除 |


## 総合評価

| 観点 | 評価 | コメント |
| --- | --- | --- |
| ビジネス要件との整合性 | **A** | Mermaid/PlantUML/KaTeX/diff/merge と多機能。\\設計書作成ツールとしての価値が高い |
| 運用・保守のしやすさ | **B-** | 巨大ファイル 3 件が保守性を下げている。\\テストカバレッジ 32% は不安材料 |
| チーム開発での協調性 | **B+** | モノレポ構成、Conventional Commits、Git Flow が整備済み。\\CI/CD も自動化 |
| 技術的負債の蓄積度 | **B** | 過去のリファクタリング（3 コンポーネント分割済み）で改善傾向。\\残存負債は上記 3 ファイル |

> 機能面は競合優位。\
> 保守性の改善（巨大ファイル分割・テスト拡充）に投資すると、開発速度の維持とバグ率低下で ROI が高い。
