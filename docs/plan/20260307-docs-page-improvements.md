# /docs ページ改善計画

## 意図

ドキュメント公開ページ (/docs) の UX を向上させる。
管理性・視認性・ナビゲーションの改善を6項目で実施。

## 変更対象ファイル

- `packages/web-app/src/app/docs/SitesBody.tsx` — 公開ページ（1,2,4,5,6）
- `packages/web-app/src/app/docs/edit/EditBody.tsx` — 編集ページ（4,6）
- `packages/web-app/src/app/api/sites/layout/route.ts` — API（4 スキーマ変更不要、JSON に siteDescription 追加）
- `packages/web-app/src/app/components/SiteFooter.tsx` — フッター（3）
- `packages/editor-core/src/i18n/ja.json` — 日本語（3,4,5,6）
- `packages/editor-core/src/i18n/en.json` — 英語（3,4,5,6）

## タスク

### Task 1: 戻るリンク削除

SitesBody.tsx から「← ホーム」リンク（ArrowBackIcon + backToHome）を削除。
import の ArrowBackIcon も除去。

### Task 2: サムネイル未設定時の頭文字アバター

SitesBody.tsx で `card.thumbnail` が空の場合、MUI の Avatar を使い
タイトルの頭文字を表示。背景色は `#e8a012`（ランディングのアクセント色）。
CardMedia の代わりに高さ 160px の Box + 中央配置 Avatar で統一感を出す。

### Task 3: フッターに編集リンク追加

SiteFooter.tsx に `/docs/edit` へのリンクを追加。
i18n キー `docsEditPage` を ja/en に追加。

### Task 4: サイト説明テキスト

layout JSON に `siteDescription` フィールドを追加（トップレベル）。
- EditBody.tsx: ページ上部にサイト説明の入力欄を追加
- SitesBody.tsx: タイトル下にサイト説明を表示（未設定時は非表示）
- API: スキーマ変更不要（JSON をそのまま保存・返却するため）
- i18n キー `siteDescription` を ja/en に追加

### Task 5: 空状態の改善

SitesBody.tsx でカード0件の場合:
- DescriptionIcon を大きく表示
- 「まだドキュメントが登録されていません」テキスト
- i18n キー `docsEmptyHint` を ja/en に追加

### Task 6: タグ機能

LayoutCard に `tags: string[]` フィールドを追加。
- EditBody.tsx: カード編集ダイアログにタグ入力欄追加（カンマ区切り）
- SitesBody.tsx: カードにタグ Chip を表示 + 上部にタグフィルタ（Chip 選択式）
- i18n キー `sitesCardTags`, `sitesFilterAll` を ja/en に追加
