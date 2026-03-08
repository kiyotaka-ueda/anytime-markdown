# モード別機能一覧

更新日: 2026-03-08


## 1. モード概要

| モード | `editable` | 用途 |
| --- | --- | --- |
| Readonly | `false` | 完全な閲覧専用 |
| Review | `false` | レビュー・フィードバック用 |
| WYSIWYG | `true` | 通常のリッチテキスト編集 |
| Source | `true` | 生 Markdown の直接編集 |


## 2. 機能一覧

凡例: o = 利用可 / x = 利用不可 / △ = 条件付き


### 2.1 ファイル操作

| 機能 | Readonly | Review | WYSIWYG | Source | 備考 |
| --- | :---: | :---: | :---: | :---: | --- |
| 新規作成 | x | x | o | o | |
| ファイルを開く | o | o | o | o | `supportsDirectAccess` 時のみ表示 |
| 保存 | o | o | o | o | `supportsDirectAccess` 時のみ表示 |
| 名前を付けて保存 | o | o | o | o | `supportsDirectAccess` 時のみ表示 |
| アップロード | x | x | o | o | `supportsDirectAccess` でない場合に表示 |
| ダウンロード | o | o | o | o | `supportsDirectAccess` でない場合に表示 |
| PDF エクスポート | o | o | o | x | 比較モード中も不可 |


### 2.2 編集操作

| 機能 | Readonly | Review | WYSIWYG | Source | 備考 |
| --- | :---: | :---: | :---: | :---: | --- |
| テキスト入力・編集 | x | x | o | o | `editor.setEditable()` で制御 |
| 元に戻す / やり直し | x | x | o | o | |
| テンプレート・挿入 | x | x | o | o | ダイアグラムコード内では不可 |
| スラッシュコマンド | x | x | o | o | `editable` 状態に依存 |


### 2.3 テキスト書式（バブルメニュー）

| 機能 | Readonly | Review | WYSIWYG | Source | 備考 |
| --- | :---: | :---: | :---: | :---: | --- |
| バブルメニュー表示 | x | △ | o | x | Source はバブルメニュー非表示 |
| 太字・斜体・取消線等 | x | x | o | x | |
| リンク挿入 | x | x | o | x | |
| コメント追加 | x | o | o | x | Review は `executeInReviewMode` 経由 |


### 2.4 表示・ビュー

| 機能 | Readonly | Review | WYSIWYG | Source | 備考 |
| --- | :---: | :---: | :---: | :---: | --- |
| 折りたたみ / 展開 | x | x | o | x | |
| アウトラインパネル | o | o | o | x | 比較モード中は不可 |
| コメントパネル | o | o | o | x | 比較モード中は不可 |
| ステータスバー | o | o | o | o | Source ではカーソル行列を表示 |


### 2.5 比較モード

| 機能 | Readonly | Review | WYSIWYG | Source | 備考 |
| --- | :---: | :---: | :---: | :---: | --- |
| 通常 / 比較 切替 | x | x | o | o | デスクトップのみ表示 |
| 比較ファイル読込 | x | x | o | o | 比較モード中のみ表示 |
| 比較ファイル保存 | x | x | o | o | 比較モード中のみ表示 |


### 2.6 インタラクション

| 機能 | Readonly | Review | WYSIWYG | Source | 備考 |
| --- | :---: | :---: | :---: | :---: | --- |
| チェックボックス操作 | x | o | o | o | Readonly は CSS `pointer-events: none` |
| 見出しドラッグ並替 | x | x | o | x | アウトラインパネル内 |
| アウトライン項目削除 | x | x | o | x | アウトラインパネル内 |
| キーボードスクロール | o | o | x | x | Readonly/Review で `tabIndex=0` 付与 |


## 3. モード切替の制御

各モードは排他的で、`localStorage` に状態を保持する。

- `markdown-editor-source-mode`
- `markdown-editor-review-mode`
- `markdown-editor-readonly-mode`

モード切替時の動作:

- Source → WYSIWYG: `parseCommentData` + `sanitizeMarkdown` で同期
- WYSIWYG → Readonly/Review: `editor.setEditable(false)` を呼出
- Readonly/Review → WYSIWYG: `editor.setEditable(true)` を呼出
- Review モードでのコメント追加: `executeInReviewMode()` で一時的に `editable` を有効化
