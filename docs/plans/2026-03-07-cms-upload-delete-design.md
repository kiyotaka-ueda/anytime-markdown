# 簡易 CMS（アップロード・削除）実装計画

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** `/docs` 一覧ページに md ファイルのアップロード・削除機能を追加する。\
変更操作は Basic 認証で保護する。\

**Architecture:** Next.js Route Handler で S3 PutObject / DeleteObject を実行。\
認証は共通ヘルパーで `Authorization` ヘッダーを検証。\
UI は既存の `/docs` 一覧ページにボタンを追加。\

**Tech Stack:** Next.js 15 (App Router), AWS SDK v3, MUI 7, next-intl

---


## Task 1: Basic 認証ヘルパーの作成


### Files

- Create: `packages/web-app/src/lib/basicAuth.ts`
- Modify: `packages/web-app/.env.local.example`

### Step 1: 認証ヘルパーを作成

`packages/web-app/src/lib/basicAuth.ts`:

- `Authorization` ヘッダーから Basic 認証情報を抽出
- 環境変数 `CMS_BASIC_USER` / `CMS_BASIC_PASSWORD` と照合
- 認証失敗時は `401 Unauthorized` + `WWW-Authenticate: Basic` ヘッダーの `NextResponse` を返す
- 認証成功時は `null` を返す（呼び出し側で処理続行）


### Step 2: 環境変数テンプレートを更新

`.env.local.example` に以下を追加:

```
CMS_BASIC_USER=admin
CMS_BASIC_PASSWORD=
```


### Step 3: コミット

```bash
git add packages/web-app/src/lib/basicAuth.ts packages/web-app/.env.local.example
git commit -m "feat: Basic 認証ヘルパーを作成"
```

---


## Task 2: アップロード API の作成


### Files

- Create: `packages/web-app/src/app/api/docs/upload/route.ts`

### Step 1: Route Handler を作成

`POST /api/docs/upload`:

- Basic 認証を検証（認証ヘルパー使用）
- `multipart/form-data` からファイルを取得
- ファイル名が `.md` で終わることを検証
- `S3_DOCS_PREFIX + ファイル名` をキーとして `PutObjectCommand` で S3 にアップロード
- 成功時は `{ key, name }` を返す
- ファイル名にパストラバーサル文字（`..`）が含まれる場合は 400 エラー


### Step 2: コミット

```bash
git add packages/web-app/src/app/api/docs/upload/route.ts
git commit -m "feat: ファイルアップロード API を作成"
```

---


## Task 3: 削除 API の作成


### Files

- Create: `packages/web-app/src/app/api/docs/delete/route.ts`

### Step 1: Route Handler を作成

`DELETE /api/docs/delete?key=<S3-key>`:

- Basic 認証を検証（認証ヘルパー使用）
- `key` パラメータが `S3_DOCS_PREFIX` で始まり `.md` で終わることを検証
- パストラバーサル防止（`..` チェック）
- `DeleteObjectCommand` で S3 から削除
- 成功時は `{ deleted: true }` を返す


### Step 2: コミット

```bash
git add packages/web-app/src/app/api/docs/delete/route.ts
git commit -m "feat: ファイル削除 API を作成"
```

---


## Task 4: i18n キーの追加


### Files

- Modify: `packages/editor-core/src/i18n/ja.json`
- Modify: `packages/editor-core/src/i18n/en.json`

### Step 1: Landing セクションにキーを追加

```json
// ja.json
"docsUpload": "アップロード",
"docsDelete": "削除",
"docsDeleteConfirm": "このドキュメントを削除しますか？",
"docsUploadSuccess": "アップロードしました",
"docsDeleteSuccess": "削除しました",
"docsUploadError": "アップロードに失敗しました",
"docsDeleteError": "削除に失敗しました"
```

```json
// en.json
"docsUpload": "Upload",
"docsDelete": "Delete",
"docsDeleteConfirm": "Delete this document?",
"docsUploadSuccess": "Uploaded successfully",
"docsDeleteSuccess": "Deleted successfully",
"docsUploadError": "Failed to upload",
"docsDeleteError": "Failed to delete"
```


### Step 2: コミット

```bash
git add packages/editor-core/src/i18n/ja.json packages/editor-core/src/i18n/en.json
git commit -m "feat: CMS 操作用の i18n キーを追加"
```

---


## Task 5: `/docs` 一覧ページに UI を追加


### Files

- Modify: `packages/web-app/src/app/docs/DocsBody.tsx`

### Step 1: アップロードボタンを追加

- ページ上部（タイトル横）に「アップロード」ボタンを配置
- クリックで `<input type="file" accept=".md">` を発火
- ファイル選択後、`POST /api/docs/upload` に `FormData` で送信
- Basic 認証ダイアログはブラウザネイティブ（401 レスポンスで自動表示）
- 成功後にファイル一覧を再取得


### Step 2: 削除ボタンを追加

- 各ファイル行の右端に削除アイコンボタンを配置
- クリックで確認ダイアログ（`window.confirm` または MUI Dialog）
- 確認後、`DELETE /api/docs/delete?key=<key>` を送信
- 成功後にファイル一覧を再取得


### Step 3: スナックバーで結果表示

- アップロード・削除の成功/失敗を `Snackbar` + `Alert` で通知


### Step 4: コミット

```bash
git add packages/web-app/src/app/docs/DocsBody.tsx
git commit -m "feat: /docs にアップロード・削除 UI を追加"
```

---


## Task 6: 結合確認


### Step 1: ビルド確認

```bash
cd packages/web-app && npm run build
```


### Step 2: 動作確認

1. `/docs` でアップロードボタンをクリック → md ファイルを選択 → Basic 認証 → S3 にアップロード
2. アップロードしたファイルが一覧に表示される
3. 削除ボタンをクリック → 確認 → Basic 認証 → S3 から削除
4. 閲覧（一覧・ビューア）は認証なしで可能
