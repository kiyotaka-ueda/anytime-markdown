# プラットフォーム別機能一覧

更新日: 2026-03-08


## 1. プラットフォーム概要

| プラットフォーム | 技術スタック | 配布形態 |
| --- | --- | --- |
| Web アプリ | Next.js 15 (PWA) | ブラウザアクセス |
| VS Code 拡張機能 | VS Code Webview API | Marketplace |
| Android アプリ | Capacitor + Web アプリ出力 | APK / Play Store |


## 2. 機能一覧

凡例: o = 利用可 / x = 利用不可 / △ = 条件付き


### 2.1 ファイル操作

| 機能 | Web | VS Code 拡張 | Android | 備考 |
| --- | :---: | :---: | :---: | --- |
| 新規作成 | o | x | o | VS Code は拡張側で管理 |
| ファイルを開く | △ | x | o | Web は File System Access API 対応ブラウザのみ |
| 上書き保存 | △ | x | o | Web は File System Access API 対応ブラウザのみ |
| 名前を付けて保存 | △ | x | o | Web は File System Access API 対応ブラウザのみ |
| アップロード（読込） | △ | x | △ | File System Access API 非対応時のフォールバック |
| ダウンロード（書出） | △ | x | △ | File System Access API 非対応時のフォールバック |
| PDF エクスポート | o | o | o | Source モード・比較モード中は不可 |

> Web アプリでは `supportsDirectAccess`（File System Access API）の有無により、「開く/保存」と「アップロード/ダウンロード」が排他的に表示される。\
> Android は `CapacitorFileSystemProvider` により常に `supportsDirectAccess = true`。


### 2.2 編集操作

| 機能 | Web | VS Code 拡張 | Android | 備考 |
| --- | :---: | :---: | :---: | --- |
| テキスト入力・編集 | o | o | o | |
| 元に戻す / やり直し | o | x | o | VS Code は自身の Undo/Redo を使用 |
| テンプレート・挿入 | o | o | o | |
| スラッシュコマンド | o | o | o | |
| バブルメニュー（書式） | o | o | o | |
| コメント追加 | o | o | o | |


### 2.3 モード切替

| 機能 | Web | VS Code 拡張 | Android | 備考 |
| --- | :---: | :---: | :---: | --- |
| WYSIWYG モード | o | o | o | |
| Source モード | o | o | o | |
| Review モード | o | o | o | |
| Readonly モード | △ | o | △ | Web/Android は環境変数 `NEXT_PUBLIC_SHOW_READONLY_MODE=1` で有効化 |


### 2.4 表示・ビュー

| 機能 | Web | VS Code 拡張 | Android | 備考 |
| --- | :---: | :---: | :---: | --- |
| 折りたたみ / 展開 | o | o | o | |
| アウトラインパネル | o | o | o | |
| コメントパネル | o | o | o | |
| ステータスバー | o | o | o | |
| 比較モード | o | o | o | デスクトップ幅のみ表示 |


### 2.5 設定・情報

| 機能 | Web | VS Code 拡張 | Android | 備考 |
| --- | :---: | :---: | :---: | --- |
| 設定パネル | o | x | o | VS Code は `hideSettings` |
| バージョン情報 | o | x | o | VS Code は `hideVersionInfo` |
| ヘルプ / 機能紹介リンク | o | x | o | VS Code は `hideHelp` |
| テーマ切替（ライト/ダーク） | o | △ | o | VS Code は拡張側のテーマに追従 |
| 言語切替 | o | o | o | |


### 2.6 プラットフォーム固有機能

| 機能 | Web | VS Code 拡張 | Android | 備考 |
| --- | :---: | :---: | :---: | --- |
| PWA（オフライン対応） | o | x | x | Service Worker による |
| VS Code コンテンツ同期 | x | o | x | `postMessage` で双方向同期 |
| VS Code リンク委譲 | x | o | x | Ctrl+Click で VS Code 側で開く |
| VS Code 外部変更検知 | x | o | x | エディタ外の変更を反映 |
| ソフトキーボード対応 | x | x | o | Capacitor Keyboard プラグイン |
| ステータスバーカスタマイズ | x | x | o | Capacitor StatusBar プラグイン |
| ネイティブファイルピッカー | x | x | o | `@capawesome/capacitor-file-picker` |


## 3. ファイルシステムプロバイダ

各プラットフォームのファイル I/O 実装:

| プロバイダ | 対象 | `supportsDirectAccess` | 実装方式 |
| --- | --- | :---: | --- |
| `WebFileSystemProvider` | Web（Chrome/Edge） | `true` | File System Access API |
| `FallbackFileSystemProvider` | Web（Firefox/Safari 等） | `false` | `<input type="file">` + Blob ダウンロード |
| `CapacitorFileSystemProvider` | Android | `true` | Capacitor FilePicker + Filesystem プラグイン |
| なし（VS Code 管理） | VS Code 拡張 | - | 拡張ホスト側でファイル操作 |


## 4. 主要な制御プロパティ

`MarkdownEditorPage` に渡されるプロパティの差異:

| プロパティ | Web | VS Code 拡張 | Android | 効果 |
| --- | :---: | :---: | :---: | --- |
| `hideFileOps` | - | `true` | - | ファイル操作ボタン非表示 |
| `hideUndoRedo` | - | `true` | - | Undo/Redo ボタン非表示 |
| `hideSettings` | - | `true` | - | 設定パネル非表示 |
| `hideHelp` | - | `true` | - | ヘルプ非表示 |
| `hideVersionInfo` | - | `true` | - | バージョン情報非表示 |
| `showReadonlyMode` | △ | `true` | △ | Readonly ボタン表示 |
| `fileSystemProvider` | o | - | o | ファイル I/O プロバイダ |
