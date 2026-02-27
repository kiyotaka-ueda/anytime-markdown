# Capacitor Android アプリの作成

## 意図（なぜ必要か）

Webアプリ（Next.js）を Capacitor でラップし、Android アプリとしてビルドできるようにする。
アプリは完全にクライアントサイドで動作（バックエンドAPI不要、localStorageで状態管理）するため、静的HTML出力 + Capacitor WebView の構成が適している。

## 選択理由

- **Capacitor**: React Native等と比較して、既存のWebアプリをほぼそのまま再利用できる。WebView ベースのため追加のUI実装が不要
- **静的エクスポート**: Next.js の `output: 'export'` で完全な静的HTMLを生成し、Capacitor の WebView で表示。サーバーサイドレンダリング不要
- **環境変数による切り替え**: `CAPACITOR_BUILD=true` で静的エクスポートを有効化し、通常のWebビルドには影響なし

## 制約・前提

- **Application ID**: `com.anytimemarkdown.app`
- **配置**: `packages/mobile-app/`（新規パッケージ）
- **i18n 制限**: 静的エクスポートでは `cookies()` が使えないため、モバイルビルドではデフォルトロケール（ja）で静的HTML生成。言語切替のフルサポートは後続タスク
- **画像**: Next.js `Image` コンポーネント未使用（MUI `Box component="img"` のみ）→ 画像最適化設定不要

## 変更ファイル一覧（5ファイル変更 + 3ファイル新規）

### 新規作成

| # | ファイル | 内容 |
|---|---------|------|
| 1 | `packages/mobile-app/package.json` | Capacitor 依存関係・ビルドスクリプト |
| 2 | `packages/mobile-app/capacitor.config.ts` | Capacitor 設定（appId, webDir 等） |
| 3 | `packages/mobile-app/scripts/sync.sh` | Web 静的ビルド → Capacitor sync のワンコマンド化 |

### 既存ファイル変更

| # | ファイル | 変更内容 |
|---|---------|----------|
| 4 | `package.json`（ルート） | workspaces に `packages/mobile-app` 追加 |
| 5 | `packages/web-app/package.json` | `build:static` スクリプト追加 |
| 6 | `packages/web-app/next.config.js` | `CAPACITOR_BUILD` 時に `output: 'export'` + `trailingSlash: true` |
| 7 | `packages/web-app/src/i18n/request.ts` | `cookies()` を try-catch で安全化（静的エクスポート対応） |
| 8 | `packages/web-app/src/app/layout.tsx` | 静的エクスポート時の動的API回避（request.ts 側のフォールバックで対応） |

## 実装ステップ

### Step 1: ルート package.json にワークスペース追加

`package.json` の `workspaces` 配列に `"packages/mobile-app"` を追加。

### Step 2: Web アプリの静的エクスポート対応

**`packages/web-app/next.config.js`:**
- `CAPACITOR_BUILD=true` 環境変数で `output: 'export'` と `trailingSlash: true` を有効化
- 通常の Web ビルドには影響なし

**`packages/web-app/src/i18n/request.ts`:**
- `cookies()` 呼び出しを try-catch で囲む
- 静的エクスポートビルド時はデフォルトロケール（ja）にフォールバック

**`packages/web-app/src/app/layout.tsx`:**
- `CAPACITOR_BUILD` 時に `cookies()`/`getLocale()` 等の動的APIがエラーにならないよう、request.ts 側のフォールバックで対応

**`packages/web-app/package.json`:**
- `"build:static": "CAPACITOR_BUILD=true next build"` スクリプト追加

### Step 3: mobile-app パッケージ作成

**`packages/mobile-app/package.json`:**
- `@capacitor/core`, `@capacitor/cli`, `@capacitor/android` を依存関係に
- `@capacitor/status-bar`, `@capacitor/keyboard` プラグイン追加
- `sync`, `open`, `run` スクリプト定義

**`packages/mobile-app/capacitor.config.ts`:**
- `appId: 'com.anytimemarkdown.app'`
- `appName: 'Anytime Markdown'`
- `webDir: '../web-app/out'`（静的エクスポート出力先）
- `server.androidScheme: 'https'`
- Keyboard, StatusBar プラグイン設定

**`packages/mobile-app/scripts/sync.sh`:**
- web-app の `build:static` 実行 → `npx cap sync` を順次実行

### Step 4: Capacitor Android プラットフォーム初期化

```bash
cd packages/mobile-app
npm install
npx cap add android
```

### Step 5: アプリアイコン設定

- `public/help/camel_markdown.png` を Android adaptive icon 用にリサイズ
- `android/app/src/main/res/mipmap-*` を差し替え

## 検証

1. `npx tsc --noEmit` 通過
2. Web アプリ通常ビルド: `cd packages/web-app && npm run build` が引き続き動作
3. 静的エクスポート: `cd packages/web-app && npm run build:static` で `out/` 生成
4. Capacitor sync: `cd packages/mobile-app && npm run sync` 正常完了
5. Android プロジェクト: `packages/mobile-app/android/` が生成されていること

## 今後の課題（本タスク対象外）

- モバイルアプリでの言語切替（クライアントサイド i18n への移行が必要）
- SafeArea / ステータスバー色のテーマ連動
- Google Play ストア公開用の署名・メタデータ設定
- スプラッシュスクリーン設定
