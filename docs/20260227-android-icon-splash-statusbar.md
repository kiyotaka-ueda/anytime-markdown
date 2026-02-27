# Android アイコン・スプラッシュ + ステータスバーテーマ連動

## ステータス: 完了

## 意図（なぜ必要か）

Capacitor Android アプリのアイコン・スプラッシュがデフォルト（Android ロボット）のまま残っている。また `@capacitor/status-bar` はインストール済みだがテーマ連動が未実装で、ダーク/ライト切替時にステータスバーの色が変わらない。

## 選択理由

- **@capacitor/assets CLI**: 手動で各解像度の画像を用意する代わりに、ソース画像から全解像度を自動生成。保守性が高い
- **sharp による画像生成**: ImageMagick が環境にないため、Node.js 依存の sharp（Next.js 経由で既にインストール済み）を使用
- **Capacitor.isNativePlatform() による分岐**: Web では StatusBar API を呼ばず、ネイティブ環境でのみ動作させる

---

## A-1: アイコン・スプラッシュのカスタマイズ

### 方針

- ソース画像: `packages/web-app/public/help/camel_markdown.png`（ラクダ+M ロゴ）
- アイコン背景: 白 (#FFFFFF)
- スプラッシュ: アイコン中央配置 + 白背景（Android ネイティブ Theme.SplashScreen のまま、`@capacitor/splash-screen` は追加しない）

### アイコン生成方法

`@capacitor/assets` CLI を使用して `camel_markdown.png` から全解像度のアイコン・スプラッシュを自動生成する。

```
npx @capacitor/assets generate --android
```

入力要件: `assets/` ディレクトリに `icon-only.png`（1024x1024）、`icon-background.png`（同サイズ）、`splash.png`（2732x2732）、`splash-dark.png`（同サイズ）を配置。

### 変更ファイル

| # | ファイル | 変更 |
|---|---------|------|
| 1 | `packages/mobile-app/assets/icon-only.png` | **新規** ソース画像（1024x1024 リサイズ） |
| 2 | `packages/mobile-app/assets/icon-background.png` | **新規** 白単色 1024x1024 |
| 3 | `packages/mobile-app/assets/splash.png` | **新規** 白背景 2732x2732 + 中央アイコン |
| 4 | `packages/mobile-app/assets/splash-dark.png` | **新規** 黒背景 2732x2732 + 中央アイコン |
| 5 | `packages/mobile-app/android/app/src/main/res/mipmap-*/` | **自動更新** 各解像度アイコン |
| 6 | `packages/mobile-app/android/app/src/main/res/drawable*/splash.png` | **自動更新** 各解像度スプラッシュ |

### 実装ステップ

1. `packages/mobile-app/assets/` ディレクトリを作成
2. `camel_markdown.png` を sharp で 1024x1024 正方形にリサイズ → `icon-only.png`
3. 白単色 1024x1024 PNG を `icon-background.png` として生成
4. 白背景 2732x2732 + 中央にアイコンを `splash.png` として生成
5. 黒背景版を `splash-dark.png` として生成
6. `npx @capacitor/assets generate --android` を実行して各解像度の画像を自動生成
7. 生成結果を確認

---

## A-2: ステータスバー色のテーマ連動

### 方針

- ライトモード: 白背景 (#FFFFFF) + 黒文字（`Style.Light`）
- ダークモード: 黒背景 (#121212) + 白文字（`Style.Dark`）
- テーマ切替時に動的に変更
- Web では `Capacitor.isNativePlatform()` で分岐し、StatusBar API を呼ばない

### 変更ファイル

| # | ファイル | 変更 |
|---|---------|------|
| 1 | `packages/mobile-app/capacitor.config.ts` | `StatusBar` プラグイン設定にデフォルトスタイルと背景色を追加 |
| 2 | `packages/web-app/src/app/providers.tsx` | テーマ変更時に `StatusBar.setStyle()` / `StatusBar.setBackgroundColor()` を呼び出す |
| 3 | `packages/web-app/package.json` | `@capacitor/core`, `@capacitor/status-bar` を依存追加 |

### 実装ステップ

1. `capacitor.config.ts` の `StatusBar` 設定にデフォルト値を追加:
   ```ts
   StatusBar: {
     overlaysWebView: false,
     style: 'DARK',
     backgroundColor: '#121212',
   },
   ```

2. `packages/web-app/package.json` に `@capacitor/core`, `@capacitor/status-bar` を依存追加

3. `providers.tsx` に StatusBar 更新ロジックを追加:
   - `updateStatusBar()` 関数: `Capacitor.isNativePlatform()` でネイティブ環境判定後、スタイル・背景色を設定
   - `setThemeMode` を `useCallback` 化し、呼び出し時に `updateStatusBar()` を実行
   - 初期化時にも `useEffect` で現在テーマに合わせて StatusBar を設定

---

## 検証

| # | 検証項目 | 結果 |
|---|---------|------|
| 1 | `npx tsc --noEmit` 通過 | OK |
| 2 | `npm run build:static` 成功 | OK |
| 3 | `cd packages/mobile-app && npm run sync` 正常 | OK |
| 4 | Android でアイコンが camel_markdown に変わっていること | 要実機確認 |
| 5 | Android でスプラッシュがカスタム画像であること | 要実機確認 |
| 6 | ダーク/ライト切替時にステータスバーの色が連動すること | 要実機確認 |
