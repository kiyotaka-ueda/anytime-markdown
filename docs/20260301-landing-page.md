# ランディングページ作成 + エディタを /markdown へ移動

## Status: COMPLETED

## 意図

一般ユーザー向けにアプリの価値を伝えるランディングページを `/` に設置し、エディタを `/markdown` に移動。

## 変更ファイル

| ファイル | 変更内容 |
|---------|---------|
| `packages/web-app/src/app/page.tsx` | ランディングページに置換（Server Component + metadata） |
| `packages/web-app/src/app/markdown/page.tsx` | **新規**: 既存エディタページを移動 |
| `packages/web-app/src/app/components/LandingPage.tsx` | **新規**: Client Component ラッパー（フォント初期化 + スクロールコンテナ） |
| `packages/web-app/src/app/components/LandingHeader.tsx` | **新規**: ヘッダー（ロゴ + EN/JA トグル + CTA）Client Component |
| `packages/web-app/src/app/components/LandingBody.tsx` | **新規**: ランディングページ本体（Hero + Features + Screenshot + Footer）Client Component |
| `packages/editor-core/src/i18n/en.json` | `Landing` セクションの翻訳キー追加 |
| `packages/editor-core/src/i18n/ja.json` | `Landing` セクションの翻訳キー追加 |

## 設計判断

- `getTranslations` のサーバーサイド設定が未構成のため、翻訳が必要なコンテンツは Client Component で実装
- page.tsx は Server Component（metadata export のため）、実コンテンツは LandingPage（Client Component）経由で描画
- Server Component が直接複数の Client Component を描画するとコンテキスト伝播に問題が生じるため、LandingPage.tsx で Client Component ツリーを統一
- globals.css の `overflow: hidden` 対策として、LandingPage.tsx で `height: 100vh; overflow: auto` の scroll container を設置
- Playfair Display フォント（next/font/google）は LandingPage.tsx で初期化し、LandingBody に prop で渡す
- MUI v7 の Grid（旧 Grid2 相当）で `size` prop を使用
- Playfair Display フォント（next/font/google）をヒーローセクションに使用
- アクセントカラー: `#e8a012`（ウォームアンバー）

## 検証結果

- `npx tsc --noEmit`: 通過
- `npx jest --passWithNoTests`: 28 suites / 338 tests 通過
- `npm run build`: 全ルート正常生成（`/`, `/markdown`, `/privacy`）
