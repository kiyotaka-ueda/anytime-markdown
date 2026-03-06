# ビューモード追加 実装計画

## Status: COMPLETED

## Context

WYSIWYG / Source の2モードに「Viewer」モードを追加。
ビューモードは編集不可の閲覧専用モードで、コメント追加のみ許可し、図・表の全画面表示は可能だが編集は不可。

## 設計方針

既存の `useSourceMode.ts` に `viewMode: boolean` を追加する独立フラグ方式。
- `sourceMode: boolean` は変更なし（既存40箇所以上の参照に影響しない）
- Tiptap の `editor.setEditable(false)` でビューモード時に編集不可
- コメント追加時は一時的に `editable: true` にして `executeInViewMode` で実行

## 変更ファイル一覧（10ファイル）

| # | ファイル | 変更内容 | Status |
|---|---------|---------|--------|
| 1 | `hooks/useSourceMode.ts` | viewMode state, handleSwitchToView, executeInViewMode | DONE |
| 2 | `i18n/en.json`, `i18n/ja.json` | viewer, switchedToViewer キー追加 | DONE |
| 3 | `components/EditorToolbar.tsx` | 3ボタン ToggleGroup, ビュー時 disabled 制御 | DONE |
| 4 | `MarkdownEditorPage.tsx` | viewMode 統合, BubbleMenu/SlashCommand 制御 | DONE |
| 5 | `components/EditorBubbleMenu.tsx` | ビュー時コメントボタンのみ表示 | DONE |
| 6 | `hooks/useEditorShortcuts.ts` | 3モード循環 (WYSIWYG→Source→Viewer→WYSIWYG) | DONE |
| 7 | `components/DiagramFullscreenDialog.tsx` | readOnly prop, textarea readOnly | DONE |
| 8 | `components/codeblock/DiagramBlock.tsx` | ドラッグ/削除/サンプル/リサイズ非表示, readOnly 連携 | DONE |
| 9 | `TableNodeView.tsx` | ドラッグ/行列操作/削除 非表示 | DONE |
| 10 | `ImageNodeView.tsx` | ドラッグ/編集/削除/リサイズハンドル非表示 | DONE |

## 検証結果

- `npx tsc --noEmit`: PASS
- `npm test`: 40 suites, 523 tests, all PASS
