# Readonly モード設計

## 概要

エディタに readonly モードを追加し、ツールバーで4モード切替を可能にする。

## モード定義

| モード | editable | チェックボックス | コメント操作 | 用途 |
|--------|----------|-----------------|-------------|------|
| readonly | false | 不可 | 不可 | 完全な読み取り専用表示 |
| review | false | 可 | 可 | レビュー・確認用 |
| edit | true | 可 | 可 | WYSIWYG 編集 |
| source | true | - | - | ソースコード編集 |

## ツールバー表示

```
[ Readonly | Review | Edit | Source ]   [ Normal | Compare ]
```

- readonly のアイコン: `LockIcon`
- 4モードは排他的

## チェックボックス制御

`onReadOnlyChecked: () => true` は静的設定のため、readonly モード時は CSS `pointer-events: none` + `opacity` でチェックボックスのクリックを無効化する。

## 変更ファイル

- `useSourceMode.ts` — `readonlyMode`, `handleSwitchToReadonly` 追加
- `MarkdownEditorPage.tsx` — readonlyMode の伝搬、チェックボックス無効化CSS
- `EditorToolbar.tsx` — Readonly ボタン追加（4モード切替）
- `EditorBubbleMenu.tsx` — readonlyMode 時コメント操作も無効化
- `useEditorShortcuts.ts` — readonlyMode 対応
- `i18n/en.json`, `ja.json` — `readonly`, `switchedToReadonly` キー追加
- `styles/editorStyles.ts` — readonlyMode 用チェックボックス無効化スタイル

## localStorage キー

`markdown-editor-readonly-mode` — デフォルト `false`
