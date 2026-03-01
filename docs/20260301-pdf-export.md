# PDF エクスポート機能

**ステータス: 完了**
**日付: 2026-03-01**

## 概要

ツールバーからPDFエクスポートボタンをクリックすると、ブラウザの印刷ダイアログが開き、「PDFとして保存」でエディタコンテンツをPDF出力できる。

## 方針

`window.print()` + CSS `@media print` を採用。外部ライブラリ不要。

## 新規ファイル（1ファイル）

| ファイル | 説明 |
|---|---|
| `styles/printStyles.ts` | MUI GlobalStyles による `@media print` ルール |

## 変更ファイル（5ファイル）

| ファイル | 変更内容 |
|---|---|
| `hooks/useEditorFileOps.ts` | `handleExportPdf` ハンドラ追加 |
| `components/EditorToolbar.tsx` | PDF ボタン追加（デスクトップ + モバイル） |
| `MarkdownEditorPage.tsx` | `PrintStyles` 配置 + `onExportPdf` 接続 |
| `i18n/en.json` | `exportPdf` 翻訳キー追加 |
| `i18n/ja.json` | `exportPdf` 翻訳キー追加 |

## 設計判断

| 選択 | 理由 |
|------|------|
| `window.print()` | 依存追加なし、全ブラウザ対応、日本語確実 |
| `GlobalStyles` で `@media print` | エディタスタイルと分離 |
| ソース/比較モード時 disabled | WYSIWYG コンテンツのみが印刷対象 |
| `PictureAsPdfIcon` | MUI アイコン統一 |
