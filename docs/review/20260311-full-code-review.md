# anytime-markdown v0.3.0 フルコードレビュー

更新日: 2026-03-11

利用スキル: `code-review-checklist`（13セクション・72項目）, `requesting-code-review`\
参照資料: `code-review-checklist/SKILL.md`, `CLAUDE.md`

---


## レビュー種別

**全観点レビュー**（プロジェクト全体）


## サマリ

| 重要度 | 件数 |
| --- | --- |
| Critical | 1 |
| High | 6 |
| Medium | 15 |
| Low | 14 |
| Info | 6 |

---


## Critical


### C1. 依存パッケージ脆弱性: `tar` Symlink Path Traversal

- `npm audit` で high 1件検出（GHSA-9ppj-qmqm-q256）
- `tar` <= 7.5.10 に Symlink Path Traversal の脆弱性
- `npm audit fix` で修正可能

---


## High


### H1. テストカバレッジ不足: セキュリティ関連ロジック

重要なロジックにテストが未作成。

| ファイル | 内容 |
| --- | --- |
| `utils/sanitizeMarkdown.ts` | Markdown サニタイズ（セキュリティ上最重要） |
| `utils/commentHelpers.ts` | コメント処理 |
| `utils/frontmatterHelpers.ts` | Frontmatter 処理 |
| `utils/footnoteHelpers.ts` | 脚注処理 |
| `utils/admonitionHelpers.ts` | Admonition 処理 |

> hooks は 30 ファイル中 19 ファイルがテスト未作成。\
> コンポーネントは 38 ファイル中 33 ファイルがテスト未作成。


### H2. 外部通信タイムアウト未設定

| ファイル | 行 | 対象 |
| --- | --- | --- |
| `hooks/useDiagramCapture.ts` | 131 | PlantUML SVG fetch |
| `web-app/src/lib/s3Client.ts` | 33 | CDN fetch |

AbortController / タイムアウトがなく、ネットワーク遅延時にユーザーが永久に待たされる。


### H3. 500行超えファイル

| 行数 | ファイル |
| --- | --- |
| 640 | `components/EditorToolbar.tsx` |
| 620 | `components/MergeEditorPanel.tsx` |
| 524 | `components/InlineMergeView.tsx` |
| 490 | `web-app: docs/edit/CardAreaPanel.tsx` |
| 487 | `components/FullscreenDiffView.tsx` |


### H4. Props 過多: `EditorToolbar` / `EditorToolbarSection`

- `EditorToolbarProps`: 48 個の props（`hide*` 系だけで 10 個以上）
- `EditorToolbarSectionProps`: 46 個（ほぼ全てバケツリレー）
- オブジェクト引数への集約またはコンポジション分割が必要


### H5. DRY 違反: ソース→WYSIWYG 同期ロジックの3重複

`useSourceMode.ts` 内で `parseFrontmatter` → `parseCommentData` → `sanitizeMarkdown` → `setContent` → `initComments` → `saveContent` のシーケンスが以下3関数にほぼ同一で重複。

- `handleSwitchToWysiwyg` (L97-106)
- `handleSwitchToReview` (L117-128)
- `handleSwitchToReadonly` (L147-158)


### H6. `editor.storage` キャストの散在

- `editor.storage as unknown as Record<string, Record<string, unknown>>` が 8 箇所
- `editor.storage as unknown as MarkdownStorage` が 4 箇所
- 型安全なヘルパー関数で共通化すべき

---


## Medium


### M1. `useLayoutEditor` の useEffect クリーンアップ不足

`web-app/src/app/docs/edit/useLayoutEditor.ts:53-77` の `useEffect` 内 `Promise.all` にキャンセル処理がない。\
アンマウント後に `setCategories` 等が呼ばれる可能性。


### M2. 空の catch でエラー握りつぶし

37 箇所の空 catch のうち、以下はユーザー通知が必要。

| ファイル | 行 | 内容 |
| --- | --- | --- |
| `SlashCommandMenu.tsx` | 149 | コマンド実行失敗がサイレント |
| `useDiagramCapture.ts` | 141 | キャプチャ全体の失敗がサイレント |


### M3. マジックナンバー残存

| ファイル | 行 | 値 |
| --- | --- | --- |
| `EditorToolbarSection.tsx` | 117 | `zIndex: 9999` |
| `EditorToolbar.tsx` | 262 | `zIndex: 10` |
| `SearchReplaceBar.tsx` | 202 | `zIndex: 10` |
| `SourceSearchBar.tsx` | 117 | `zIndex: 10` |
| `EditorFooterOverlays.tsx` | 166 | `autoHideDuration={3000}` |
| `editorStyles.ts` | 26-27 | `editorHeight - 36`, `editorHeight - 4` |
| `hooks/useEditorFileOps.ts` | 309 | `delay = 300` |
| `hooks/useEditorHeight.ts` | 19 | `setTimeout(..., 100)` |
| `CommentPanel.tsx` | 135 | `width: 280` |


### M4. svgCache / urlCache のメモリ無制限成長

| ファイル | 行 | 内容 |
| --- | --- | --- |
| `hooks/useMermaidRender.ts` | 52 | `svgCache` (Map) が無制限に成長 |
| `hooks/usePlantUmlRender.ts` | 9 | `urlCache` も同様 |

LRU キャッシュや最大サイズ制限が望ましい。


### M5. `any` 型の使用

`useSourceMode.ts` L104, L124, L154 で `(editor.commands as any).initComments(comments)` が 3 箇所。\
TipTap の Commands 型拡張で解消可能。


### M6. `package.json` のバージョンが `^` 指定

CLAUDE.md のポリシー「バージョンは exact 固定を優先」に反し、`dependencies` / `devDependencies` の全てが `^` prefix を使用。


### M7. `handleExportPdf` が136行の巨大関数

`hooks/useEditorFileOps.ts:200-336`\
折りたたみ展開、Mermaid 再レンダリング、PlantUML 差し替え、印刷、復元を 1 関数で全て処理。\
単一責任違反。


### M8. `useEditorConfig` の click ハンドラが230行超

`hooks/useEditorConfig.ts:116-268`\
見出しジャンプ、チェックボックス操作、ブロックメニュー表示等のUI操作が密結合。


### M9. `MergeRightBubbleMenu` の aria-label 欠落

- 全 IconButton に `aria-label` がない（Tooltip の title のみ）
- Paper に `role="toolbar"` がない
- キーボードナビゲーション（ArrowLeft/Right）が未実装

> `EditorBubbleMenu` には全て実装済みのため、不整合。


### M10. `prefers-reduced-motion` 未対応箇所

| ファイル | 行 | 内容 |
| --- | --- | --- |
| `headingStyles.ts` | 23 | `transition: "opacity 0.15s"` |
| `blockStyles.ts` | 102 | `animation: "blink-caret 1s step-end infinite"` |
| `MergeEditorPanel.tsx` | 29 | `transition: "opacity 0.15s"` |
| `LandingBody.tsx` | 236 | `transition` |
| `CardAreaPanel.tsx` | 48 | `transition: 'opacity 0.15s'` |


### M11. `FrontmatterBlock` のキーボード操作不備

L57 の折り畳みトグルが `onClick` のみ。\
`onKeyDown`（Enter/Space）なし、`tabIndex` なし。\
キーボードユーザーが操作できない。


### M12. `headingFoldExtension` と見出し操作のインデックス不整合リスク

`headingFoldExtension.ts:104-110`\
見出しが追加/削除されると `foldedIndices` がずれる。\
ドキュメント変更とコマンド発行のタイミングにギャップがある。


### M13. `searchReplaceExtension` の二重状態管理

`searchReplaceExtension.ts:87-99, 296-329`\
`results`, `currentIndex` 等が TipTap Storage に保存され、Plugin State 内の `DecorationSet` とは別管理。\
Storage と Decoration の不整合リスク。


### M14. `reviewModeExtension` と `commentExtension` の連携がレースコンディションに脆弱

`useSourceMode.ts:174-183`\
`executeInReviewMode` で `enabled = false` → 操作 → `queueMicrotask` で `enabled = true` に戻す。\
この間に別の dispatch が入ると一時的にレビューモードが無効になる。


### M15. `useFloatingToolbar` に isDestroyed チェックなし

`hooks/useFloatingToolbar.ts:36-40`\
`editor.on("selectionUpdate", update)` のコールバック内でエディタ破棄後に呼ばれると例外の可能性。

---


## Low


### L1. `console.error` のグローバル上書き

`MarkdownEditorPage.tsx:5-16` でモジュールトップレベルで `console.error` をグローバルに上書き。\
他モジュールのエラーログにも影響する。


### L2. テストファイルの `console.log` 残存

`__tests__/entityRoundTrip.test.ts` に多数の `console.log` が残存。\
テストノイズになる。


### L3. `global-error.tsx` がライトモード固定

`backgroundColor: '#fafafa'`, `color: '#333'` でダークモードユーザーにフラッシュする。


### L4. i18n: aria-label の英語固定

| ファイル | 内容 |
| --- | --- |
| `FullPageLoader.tsx` | `ariaLabel = 'Loading'` |
| `LandingHeader.tsx` | `"Main navigation"`, `"Language"`, `"Menu"` 等 |
| `SiteFooter.tsx` | `"Footer navigation"` |
| `layout.tsx` | `"Skip to content"` |
| `markdown/page.tsx` | `"Loading editor"` |


### L5. `SourceSearchBar` に `aria-live` 未設定

検索結果カウント表示に `aria-live` がない。\
`FsSearchBar`, `SearchReplaceBar` には実装済みのため不整合。


### L6. 色覚多様性: `StatusBar` の未保存インジケーター

`StatusBar.tsx:113-116`\
未保存変更をオレンジのドットのみで表示。\
色だけに依存した情報伝達。


### L7. `readonly` の未活用

interface のプロパティに `readonly` がほぼ使われていない。\
`HeadingItem`, `MdSerializerState`, `EditorSettings` 等。


### L8. 未使用 prop: `isInDiagramBlock`

`EditorToolbar.tsx:84,134` で `_isInDiagramBlock` にリネームされ未使用。\
prop 定義自体を削除すべき。


### L9. `plantuml-encoder` が静的インポート

`hooks/usePlantUmlRender.ts:2`\
`mermaid` や `katex` は動的インポートされているのに、`plantuml-encoder` は静的。\
サイズが小さいため優先度は低い。


### L10. `SlashCommandMenu` の `filteredItems` 未メモ化

`SlashCommandMenu.tsx:43`\
`filterSlashItems(slashCommandItems, query, t)` が毎レンダリングで再計算。\
`useMemo` で `[query, t]` に依存させるべき。


### L11. `useCodeBlockAutoCollapse` の `requestAnimationFrame` 依存

`hooks/useCodeBlockAutoCollapse.ts:33-39`\
`requestAnimationFrame` 遅延に頼ったループ防止は fragile。


### L12. `useEditorCommentNotifications` に `isDestroyed` チェックなし

`hooks/useEditorCommentNotifications.ts:29-56`\
デバウンス後（300ms）にエディタがすでに破棄されている可能性。


### L13. `index.ts` のワイルドカードパス exports

`package.json` L9: `"./src/*": "./src/*"`\
内部実装の変更が breaking change になるリスク。


### L14. CHANGELOG の欠如

`editor-core` と `web-app` に CHANGELOG なし。\
`vscode-extension/CHANGELOG.md` のみ存在。

---


## Info


### I1. `HTML_SANITIZE_CONFIG` に form/input 許可

`components/codeblock/types.ts:56`\
HTML プレビューブロック用。\
`action` 属性は禁止されているため送信先の指定は不可。\
低リスクだが認識しておく。


### I2. `computeBlockDiff` の LCS が O(n*m)

`extensions/diffHighlight.ts:99-141`\
通常のドキュメントサイズでは問題ないが、数千ブロックでは計算コストが高い。


### I3. `OutlinePanel` の `indexOf` が O(n^2) になり得る

`components/OutlinePanel.tsx:96-99`\
`headingOnlyIndices.indexOf(arrIdx)` がドラッグ操作時に各アイテムで呼ばれる。\
Map への変換で O(1) にできる。


### I4. ReDoS 対策は適切

`searchReplaceExtension.ts:25-26,44`\
`REDOS_RE` でバックトラッキングパターンを検出、`MAX_PATTERN_LENGTH=1000`、`MAX_MATCH_ITERATIONS=10000` で制限。


### I5. CSP 設定は適切

`web-app/src/middleware.ts` で nonce ベース CSP を実装。\
`style-src 'unsafe-inline'` は MUI 利用上やむを得ない。


### I6. `dangerouslySetInnerHTML` は全箇所 DOMPurify でサニタイズ済み

7 箇所すべてで適切にサニタイズされている。

---


## チェックリスト結果

### 基本原則 (General)

- [x] ハードコーディング: 定数化はほぼ完了。残存 9 箇所（M3）
- [x] 命名の適切さ: 規約遵守。問題なし
- [x] 早期リターン: 概ね良好
- [ ] 単一責任の原則: `handleExportPdf`（M7）、`useEditorConfig` click ハンドラ（M8）が違反
- [ ] 関数の引数: `EditorToolbarProps` 48 個（H4）
- [x] 適切な抽象度: 概ね良好

### TypeScript 型安全 (Type Safety)

- [ ] any の禁止: 3 箇所残存（M5）
- [x] 型推論の活用: 問題なし
- [ ] as の回避: 12 パターン以上（H6）
- [x] 非ヌルアサーション: 5 箇所、文脈上妥当
- [x] Union 型の網羅性: 問題なし
- [ ] readonly の活用: ほぼ未使用（L7）

### 機能・ロジック

- [x] 要件充足: 問題なし
- [x] エッジケース: 概ね良好
- [x] エラーハンドリング: 概ね良好
- [x] undo/redo: 問題なし
- [x] 冪等性: 概ね良好
- [x] 後方互換性: オプショナル props で維持

### セキュリティ

- [x] XSS: DOMPurify で全箇所サニタイズ済み（I6）
- [x] ReDoS: 適切に対策済み（I4）
- [x] 外部通信: URL バリデーションあり
- [x] 機密情報: 露出なし
- [x] 入力バリデーション: 適切
- [ ] 依存パッケージ: `tar` に high 脆弱性（C1）
- [x] CORS / CSP: 適切（I5）

### エラーハンドリング (Error Handling)

- [ ] 例外処理: 2 箇所でユーザー通知なし（M2）
- [x] Promise の処理: 重大な欠落なし
- [x] エラーメッセージの質: 適切
- [x] グレースフルデグラデーション: 概ね良好
- [ ] エラーの握りつぶし: 37 箇所の空 catch（大半は localStorage で妥当、2 箇所要対応）

### 非同期・並行処理 (Async & Concurrency)

- [ ] レースコンディション: `executeInReviewMode` にリスク（M14）
- [ ] タイムアウト: 外部通信 2 箇所で未設定（H2）
- [ ] キャンセル処理: `useLayoutEditor` で欠落（M1）
- [x] 並列実行の制御: 問題なし
- [x] デッドロック/無限ループ: 問題なし

### パフォーマンスと保守性

- [ ] 不要な再レンダリング: `SlashCommandMenu` の `filteredItems`（L10）
- [x] 計算量: O(n*m) の LCS は許容範囲（I2）
- [ ] メモリリーク: svgCache / urlCache が無制限成長（M4）
- [x] バンドルサイズ: Mermaid/KaTeX は動的インポート済み
- [x] コメントの質: 概ね良好
- [x] パッケージの利用: 問題なし
- [x] キャッシュ戦略: 概ね良好
- [x] 遅延読み込み: InlineMergeView が dynamic で遅延読み込み済み

### コード品質 (Code Quality)

- [ ] マジックナンバー: 9 箇所残存（M3）
- [ ] 共通化 (DRY): 3 重複パターン（H5, H6）
- [ ] デバッグコード: テストに console.log 残存（L2）、本番に console.error 上書き（L1）
- [x] 副作用の管理: 概ね良好
- [ ] ファイルサイズ: 5 ファイルが 500 行超（H3）
- [x] 不変性: 概ね良好
- [x] 条件式の明確さ: 問題なし
- [ ] デッドコード: 未使用 prop `isInDiagramBlock`（L8）

### 依存関係・モジュール設計

- [x] 循環依存: 検出なし
- [ ] パッケージバージョン: `^` 指定（M6）
- [x] 不要な依存: 問題なし
- [ ] レイヤー違反: `useEditorConfig` にUI操作混在（M8）
- [ ] 公開インターフェース: ワイルドカード exports（L13）

### アクセシビリティ

- [ ] aria-label: `MergeRightBubbleMenu` 等で欠落（M9）
- [ ] キーボード操作: `FrontmatterBlock` トグル（M11）
- [ ] 色覚多様性: `StatusBar` 未保存インジケーター（L6）
- [ ] prefers-reduced-motion: 5 箇所未対応（M10）
- [ ] スクリーンリーダー: `SourceSearchBar` に aria-live なし（L5）
- [x] コントラスト比: 概ね WCAG AA 基準クリア

### UI/UX

- [ ] ダークモード: `global-error.tsx` がライト固定（L3）
- [x] レスポンシブ: 適切に対応
- [x] ローディング状態: 共通コンポーネントで対応
- [ ] i18n: aria-label の英語固定（L4）
- [x] エラー状態: Alert / Snackbar で表示
- [x] 空状態: アイコン + メッセージ表示
- [x] 操作フィードバック: Snackbar / aria-pressed で対応

### ドキュメント・テスト (Doc & Test)

- [x] JSDoc: 概ね良好
- [ ] ユニットテスト: hooks 19/30、utils 5/12 がテスト未作成（H1）
- [x] テストの独立性: 問題なし
- [x] 境界値テスト: 概ね良好
- [x] モックの適切さ: 概ね良好
- [ ] 変更履歴: CHANGELOG なし（L14）

### 状態管理（ProseMirror/TipTap 固有）

- [ ] Plugin 状態: `searchReplaceExtension` の二重管理（M13）
- [ ] DOM計測と状態更新: `headingFoldExtension` のインデックス不整合リスク（M12）
- [ ] エディタ破棄時: `useFloatingToolbar`（M15）、`useEditorCommentNotifications`（L12）に isDestroyed チェックなし
- [ ] 複数 Plugin 整合性: `reviewModeExtension` と `commentExtension` の連携にレースコンディション（M14）

---


## 優先対応推奨

1. **C1**: `npm audit fix` で `tar` 脆弱性を修正
2. **H1**: `sanitizeMarkdown.ts` のユニットテスト作成
3. **H2**: 外部通信にタイムアウト追加
4. **H5**: ソース→WYSIWYG 同期ロジックの共通化
5. **H6**: `editor.storage` アクセスのヘルパー関数作成
