# コードレビュー: develop ブランチ全体

レビュー日: 2026-03-13\
対象: `packages/editor-core/src/` (master...develop 差分)\
利用スキル: `code-review-checklist`, `requesting-code-review`\
レビューエージェント: セキュリティ・型安全 / パフォーマンス・状態管理 / コード品質・アーキテクチャ


## レビュー種別

develop -> master マージ前の全観点レビュー。


## サマリ

| 重要度 | 件数 |
| --- | --- |
| Critical | 2 |
| Important | 8 |
| Minor | 9 |
| Info (良い点) | 8 |


## Critical (即修正必要)

### C1: `readFileAsText` に `onerror` / `reject` がない

- ファイル: `utils/fileReading.ts`
- カテゴリ: エラーハンドリング

`readFileAsText` は `new Promise((resolve) => { ... })` で `reject` を受け取らず、`reader.onerror` も未設定。
ファイル読み込み失敗時に Promise が永久 pending になり、呼び出し元の `.then()` が実行されない。

**修正方針**: `reject` を受け取り `reader.onerror` で reject する。
呼び出し元にも `.catch()` を追加する。

### C2: `notificationTimerRef` のアンマウント時クリーンアップ欠落

- ファイル: `hooks/useEditorFileOps.ts` (61行目付近)
- カテゴリ: メモリリーク

`notificationTimerRef` に `setTimeout` の戻り値が保存されるが、アンマウント時に `clearTimeout` する `useEffect` がない。
アンマウント後にタイマーが発火し、破棄済みコンポーネントの `setNotification` が呼ばれる。

**修正方針**: `useEffect(() => () => clearTimeout(notificationTimerRef.current), [])` を追加する。


## Important (次のステップ前に修正)

### I1: InlineMergeView の rAF キャンセル漏れ

- ファイル: `components/InlineMergeView.tsx` (178-188, 192-202, 226行目)
- カテゴリ: レースコンディション

`rightText` 変更時の `requestAnimationFrame` で `cancelAnimationFrame` していない。
高頻度変更時に古い rAF コールバックが残り、レースコンディションや無駄な処理が発生する。
モード切替同期 (192-202行目) と折りたたみ状態同期 (226行目) にも同様の問題がある。

**修正方針**: rAF の ID を保持し、クリーンアップ関数で `cancelAnimationFrame` する。

### I2: `handleExportPdf` の setTimeout 内で `isDestroyed` チェック欠落

- ファイル: `hooks/useEditorFileOps.ts`
- カテゴリ: ProseMirror 状態管理

PDF エクスポートの `setTimeout` コールバック内で折りたたみ復元のトランザクションを dispatch する際、`editor.isDestroyed` チェックがない。
エクスポート中にページ遷移すると例外が発生する可能性がある。

**修正方針**: 折りたたみ復元前に `editor.isDestroyed` チェックを追加する。

### I3: `handleImport` の `.catch()` 欠落

- ファイル: `hooks/useEditorFileOps.ts` (118-127行目)
- カテゴリ: エラーハンドリング

```typescript
readFileAsText(file).then(({ text }) => {
  // ...
});
```

`.catch()` がないため、`readFileAsText` が reject した場合に unhandled promise rejection になる。

**修正方針**: `.catch()` を追加し、ユーザーへのエラー通知を行う。

### I4: `useFileSystem` の `loadNativeHandle` 競合

- ファイル: `hooks/useFileSystem.ts` (19-28行目)
- カテゴリ: レースコンディション

`useEffect` 内の `loadNativeHandle()` が非同期で解決する間に、ユーザーが `openFile` や `setFileHandle` を呼んだ場合、古い IndexedDB のハンドルが後から上書きされる可能性がある。

**修正方針**: `let cancelled = false` フラグを使い、クリーンアップで `cancelled = true` に設定する。
StrictMode の二重実行にも対応できる。

### I5: `fileHandleStore.ts` の IndexedDB 接続リーク

- ファイル: `utils/fileHandleStore.ts`
- カテゴリ: メモリリーク

`saveNativeHandle`, `loadNativeHandle`, `clearNativeHandle` がそれぞれ `openDB()` を呼び、毎回新しい `IDBDatabase` 接続を開く。
`db.close()` がないため接続がリークする。

**修正方針**: モジュールレベルで DB 接続をキャッシュするか、使用後に `db.close()` を呼ぶ。

### I6: `[\s\S]*?` パターンの ReDoS リスク

- ファイル: `utils/sanitizeMarkdown.ts` (235, 241行目)
- カテゴリ: セキュリティ

```typescript
/<blockquote data-admonition-type="[^"]*">[\s\S]*?<\/blockquote>/g
/<span data-comment-id="[^"]*">[\s\S]*?<\/span>/g
```

83行目のコメントで「ReDoS を回避するため位置ベースの線形スキャンで分割する」と明記しつつ、235行目・241行目では `[\s\S]*?` を使用しており方針が矛盾している。
ファイルインポート経由で悪意あるコンテンツが流入する可能性がある。

**修正方針**: `[^<]*(?:<(?!\/blockquote>)[^<]*)*` のようなネスト非許容パターンに置き換えるか、`splitByCodeBlocks` と同様の線形スキャンに統一する。

### I7: `editor.storage` への二重キャスト

- ファイル: `utils/editorContentLoader.ts` (21-26行目)
- カテゴリ: 型安全

```typescript
(editor.storage as unknown as Record<string, unknown>)[TRAILING_NEWLINE_KEY] = value;
```

`as unknown as Record<string, unknown>` は型安全を完全に無視している。
`types.ts` に `getEditorStorage()` ヘルパーが存在するが使われていない。

**修正方針**: `getEditorStorage()` を使用するか、`trailingNewline` を TipTap Extension の `storage` に正式に定義する。

### I8: `types.ts` に実行時ロジックが混在

- ファイル: `types.ts` (42-93行目)
- カテゴリ: モジュール設計

`getMarkdownFromEditor` 関数 (約50行) が型定義ファイルに存在し、5モジュールをインポートしている。
循環依存のリスクを高め、ファイル名から期待される内容と乖離している。

**修正方針**: `getMarkdownFromEditor` および関連ヘルパーを `utils/markdownSerializer.ts` 等に分離し、`types.ts` は純粋な型定義のみとする。


## Minor (後で対応可)

### M1: テスト `entityRoundTrip.test.ts` に `console.log` 15箇所残存

- ファイル: `__tests__/entityRoundTrip.test.ts`
- カテゴリ: コード品質

デバッグ用の `console.log("Input: ", md)` / `console.log("Output:", result)` が15箇所残存。
CI のテスト出力にノイズを追加する。

### M2: `useEditorConfig.ts` の click ハンドラが過大

- ファイル: `hooks/useEditorConfig.ts` (188-298行目)
- カテゴリ: 単一責任

`handleDOMEvents.click` ハンドラが1つのクロージャ内に4つの責務を持つ (約110行)。

- レビューモードのチェックボックス操作
- アンカーリンクのスクロール
- 見出しメニュー表示
- blockquote/リストのコンテキストメニュー

### M3: `console.error` グローバルモンキーパッチ

- ファイル: `MarkdownEditorPage.tsx` (5-16行目)
- カテゴリ: セキュリティ / 保守性

モジュールスコープで `console.error` をグローバルに上書きしている。
TipTap の flushSync 警告を抑制する目的だが、他モジュールからの正当なエラー報告も影響を受ける可能性がある。

### M4: デバウンス 300ms が定数化されていない

- ファイル: `hooks/useEditorConfig.ts` (323行目)
- カテゴリ: マジックナンバー

`setTimeout(() => { ... }, 300)` の 300ms が定数化されていない。
`useMarkdownEditor.ts` の `DEBOUNCE_MS = 500` と同様に命名定数にすべき。

### M5: `handleInsertTemplate` の rAF 内で `isDestroyed` チェックなし

- ファイル: `MarkdownEditorPage.tsx` (254-256行目)
- カテゴリ: ProseMirror 状態管理

ネストされた rAF 内で `editor.isDestroyed` チェックがない。
テンプレート挿入直後にページ遷移した場合に例外が発生する可能性がある。

### M6: `UseEditorConfigParams` の引数が12個

- ファイル: `hooks/useEditorConfig.ts` (32-44行目)
- カテゴリ: 基本原則

関連する Ref をグループ化 (`EditorRefs`, `CallbackRefs` 等) すると可読性が向上する。

### M7: cookie 設定に `SameSite=Lax` 未設定

- ファイル: 設定パネル内
- カテゴリ: セキュリティ

```typescript
document.cookie = `NEXT_LOCALE=${newLocale};path=/;max-age=31536000`;
```

`Secure` / `SameSite` 属性が未設定。
`newLocale` は列挙型からの選択値だが、`SameSite=Lax` は付与すべき。

### M8: `editorContentLoader.ts` の JSDoc が対象関数から離れている

- ファイル: `utils/editorContentLoader.ts` (15-16行目)
- カテゴリ: コード品質

`applyMarkdownToEditor` 用の JSDoc が関数定義 (30行目) から離れており、間に `TRAILING_NEWLINE_KEY`, `setTrailingNewline`, `getTrailingNewline` が挟まっている。

### M9: `handleDrop` の catch 内でエラー無視

- ファイル: `hooks/useEditorConfig.ts` (97行目)
- カテゴリ: エラーハンドリング

```typescript
.catch(() => { handleImportRef.current(mdFile); });
```

`getAsFileSystemHandle()` の失敗時にエラーを完全に無視してフォールバック処理のみ。
最低限 `console.warn` を入れるか、コメントで意図を明記すると良い。


## Info (良い点)

| # | 観点 | 内容 |
| --- | --- | --- |
| 1 | セキュリティ | `dangerouslySetInnerHTML` は全箇所で `DOMPurify.sanitize()` 経由。設定もスコープ別に適切。 |
| 2 | セキュリティ | `eval` / `Function()` の使用なし。 |
| 3 | 状態管理 | `isDestroyed` チェックが rAF 内で一貫して実装されている。 |
| 4 | 状態管理 | `reviewModeStorage` の enabled フラグ管理が一貫。try/catch の catch 内でも復元処理あり。 |
| 5 | メモリ管理 | イベントリスナーのクリーンアップが全体的に適切 (`addEventListener` / `editor.on()` に対応する解除あり)。 |
| 6 | 設計 | ref パターンによる stale closure 回避が正しい (`handleImportRef`, `onFileDragOverRef` 等)。 |
| 7 | 設計 | `readFileAsText` / `applyMarkdownToEditor` / `preprocessMarkdown` への共通化で重複ロジックが統一された。 |
| 8 | コード品質 | ハードコーディング色なし。定数が `constants/colors.ts` に集約済み。 |


## 修正優先度

1. **即対応**: C1, C2 (アプリの安定性に直結)
2. **次回開発時**: I1-I7 (品質向上、潜在バグ防止)
3. **構造改善**: I8, M2, M3, M6 (リファクタリング枠)
4. **軽微**: M1, M4, M5, M7-M9
