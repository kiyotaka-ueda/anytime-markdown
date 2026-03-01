# E2E テスト環境構築 設計書

## ステータス: 承認済み

## 目的
- リグレッション防止: 主要ユーザーフローが壊れていないことを継続的に検証
- CI に組み込んで自動実行

## アプローチ
**Playwright Test** を採用。Docker 内に Chromium 導入済みのため追加ブラウザインストール不要。

## インフラ構成

### ファイル配置
```
packages/web-app/
  playwright.config.ts       # Playwright 設定
  e2e/
    editor-basic.spec.ts     # 基本操作
    mode-switch.spec.ts      # モード切替
    toolbar.spec.ts          # ツールバー操作
    file-ops.spec.ts         # ファイル操作
    search-replace.spec.ts   # 検索/置換
    outline.spec.ts          # アウトライン
    settings.spec.ts         # 設定
    keyboard.spec.ts         # キーボードショートカット
  package.json               # @playwright/test 追加
```

### playwright.config.ts
- ブラウザ: Chromium のみ
- baseURL: `http://localhost:3000`
- webServer: `npm run dev`（自動起動）
- タイムアウト: テスト 30s、ナビゲーション 15s
- リトライ: CI=1、ローカル=0
- レポート: HTML

### .gitignore 追加
- `playwright-report/`
- `test-results/`

## テストシナリオ一覧

### editor-basic.spec.ts（基本操作）
1. ページ読み込み: タイトル、エディタ、ツールバーが表示
2. テキスト入力: エディタにテキストを入力して反映
3. 書式適用: Bold/Italic がツールバーから適用

### mode-switch.spec.ts（モード切替）
4. ソースモード切替: WYSIWYG → ソース → WYSIWYG でコンテンツ保持
5. マークダウン編集: ソースモードで編集し WYSIWYG に反映

### toolbar.spec.ts（ツールバー操作）
6. 見出し挿入: H1〜H3
7. リスト挿入: 箇条書き、番号付き、タスクリスト
8. コードブロック挿入
9. テーブル挿入
10. 図表メニュー: Mermaid/PlantUML メニューが開く

### file-ops.spec.ts（ファイル操作）
11. ダウンロード: .md ファイルがダウンロード
12. アップロード: .md ファイルをアップロードして表示
13. 新規作成: コンテンツがクリア

### search-replace.spec.ts（検索/置換）
14. 検索: テキスト検索してハイライト
15. 置換: テキスト置換して反映
16. 正規表現検索

### outline.spec.ts（アウトライン）
17. アウトライン表示: 見出し一覧が表示
18. 見出しクリック: 該当位置にスクロール
19. 折りたたみ: Fold All / Unfold All

### settings.spec.ts（設定）
20. テーマ切替: Dark/Light
21. 言語切替: en/ja
22. フォントサイズ変更

### keyboard.spec.ts（キーボードショートカット）
23. Ctrl+B: Bold
24. Ctrl+S: 保存
25. Ctrl+Z / Ctrl+Y: Undo/Redo

## 制約
- Chromium のみ（Firefox/WebKit は必要に応じて後で追加）
- File System Access API はテスト環境では使えないため FallbackFileSystemProvider でテスト
- Service Worker (PWA) のテストは対象外
