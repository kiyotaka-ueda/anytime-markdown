# モード変換テスト項目一覧

更新日: 2026-03-06 テスト総数: 33 テスト（modeConversion.test.ts）

---

## モード変換の仕様

### 概要

ソースモード（生 Markdown）と WYSIWYG モード（ProseMirror エディタ）間の変換処理。ユーザーがモードを切り替えても、Markdown の内容・書式・改行数が変わらないことを保証する。

### データフロー

```
ソースモード → sanitizeMarkdown → preserveBlankLines → ProseMirror (WYSIWYG) → tiptap-markdown serializer → getMarkdownFromEditor (restoreBlankLines) → ソースモード
```

| フェーズ | 関数 | 定義ファイル | 処理内容 |
| --- | --- | --- | --- |
| 1. 入力サニタイズ | `sanitizeMarkdown` | `sanitizeMarkdown.ts` | 危険な HTML タグを DOMPurify で除去。許可タグ（`<mark>`, `<kbd>`, `<details>` 等）は保持。コードブロック内は処理対象外。Math・脚注・コメントの前処理も実行。 |
| 2. 入力前処理 | `preserveBlankLines` | `sanitizeMarkdown.ts` | ProseMirror が正規化で失う改行情報を不可視マーカーで記録。連続空行 → ZWSP マーカー段落、tight transition → ZWNJ マーカー。 |
| 3. WYSIWYG 編集 | ProseMirror + tiptap-markdown | （外部ライブラリ） | ブロック間を常に `\n\n` に正規化。連続空行は1つに圧縮。 |
| 4. 出力取得 | `getMarkdownFromEditor` | `types.ts` | tiptap-markdown シリアライザから Markdown を取得。`restoreBlankLines` → `postprocessMathBlock` → コメントデータ付加の順に後処理。 |
| 5. 出力後処理 | `restoreBlankLines` | `sanitizeMarkdown.ts` | ZWNJ + `\n\n` → `\n`（tight transition 復元）、ZWSP 段落 → 空行（連続空行復元）。マーカーを全除去して元の改行数に戻す。 |

### 保証する不変条件

- **改行数の保持**: 元の Markdown の改行数が変換後も維持される（増えない・減らない）
- **HTML 安全性**: `<script>`, `<iframe>` 等の危険タグは除去される
- **許可タグの保持**: `<mark>`, `<kbd>`, `<sub>`, `<sup>`, `<u>`, `<br>`, `<hr>`, `<details>`, `<summary>` は除去されない
- **コードブロックの不可侵**: コードフェンス内の内容は一切変更されない
- **インラインコードの不可侵**: バッククォートで囲まれた内容は一切変更されない
- **Markdown 記法の保持**: `>`, `**`, `*`, `~~` 等の記法がサニタイズで壊れない

---

## 1. sanitizeMarkdown（24件）

ソースモードの Markdown を WYSIWYG エディタに渡す前に HTML をサニタイズする。コードブロック内はそのまま保持し、コードブロック外のみ DOMPurify で処理する。許可タグ（`<mark>`, `<kbd>`, `<details>` 等）は残し、`<script>`, `<div>` 等は除去。Math・脚注・コメントの前処理もここで行う。

### 1-1. コードブロック保護（7件）

| # | テスト名 | 検証内容 | IN | OUT（期待値） |
| --- | --- | --- | --- | --- |
| 1 | コードブロック内のHTMLタグを保持する | コードフェンス内の `<div>` が除去されない | コードブロック html 内に `<div class="foo">bar</div>` | IN と同一 |
| 2 | コードブロック内の > < & 文字を保持する | コードフェンス内の比較演算子がエスケープされない | コードブロック js 内に `if (a > 0 && b < 1)` | IN と同一 |
| 3 | 空行を含むコードブロックを正常に処理する | コードフェンス内の空行が消えない | コードブロック mermaid 内に空行あり | IN と同一 |
| 4 | 複数のコードブロックを正常に処理する | 2つのコードブロック間テキストが保持される | js + python の2つのコードブロックと間のテキスト | IN と同一 |
| 5 | コードブロック前後の改行を保持する | フェンス前後の `\n\n` が消えない | テキスト + コードブロック + テキスト | IN と同一 |
| 6 | コードブロック間のテキスト部の改行を保持する | フェンス間の段落改行が消えない | コードブロック + paragraph + コードブロック | IN と同一 |
| 7 | 改行のみの部分はそのまま保持する | `\n\n\n\n` がそのまま返る | `aaa\n\n\n\nbbb` | IN と同一 |

### 1-2. 許可タグ保持（7件）

| # | テスト名 | 検証内容 | IN | OUT（期待値） |
| --- | --- | --- | --- | --- |
| 8 | 許可タグ（details, mark等）を保持する | `<details>`, `<summary>` が残る | `<details><summary>Title</summary>` + content | `<details>` `<summary>` `</details>` 含む |
| 9 | `<mark>` テキスト `</mark>` を保持する | ハイライトタグ保持 | `これは<mark>重要</mark>です` | `<mark>重要</mark>` 含む |
| 10 | `<kbd>` テキスト `</kbd>` を保持する | キーボードタグ保持 | `<kbd>Ctrl+C</kbd>でコピー` | `<kbd>Ctrl+C</kbd>` 含む |
| 11 | `<sub>` テキスト `</sub>` を保持する | 下付きタグ保持 | `H<sub>2</sub>O` | `<sub>2</sub>` 含む |
| 12 | `<sup>` テキスト `</sup>` を保持する | 上付きタグ保持 | `x<sup>2</sup>+1` | `<sup>2</sup>` 含む |
| 13 | `<u>` テキスト `</u>` を保持する | 下線タグ保持 | `<u>下線テキスト</u>` | `<u>下線テキスト</u>` 含む |
| 14 | `<br>` `<hr>` を保持する | 改行・水平線タグ保持 | `行1<br>行2` / `上<hr>下` | `<br>` `<hr>` 含む |

### 1-3. 不許可タグ除去（2件）

| # | テスト名 | 検証内容 | IN | OUT（期待値） |
| --- | --- | --- | --- | --- |
| 15 | コードブロック外の不許可HTMLタグを除去しテキストを保持する | `<script>` 除去、テキスト保持 | `hello <script>alert(1)</script> world` | `<script>` なし、`hello` `world` 含む |
| 16 | 不許可タグ（`<div>`, `<span>`）を除去しテキストを保持する | タグ除去、テキスト保持 | `<div>ブロック</div><span>インライン</span>` | `<div>` `<span>` なし、テキスト含む |

### 1-4. コメント前処理（2件）

| # | テスト名 | 検証内容 | IN | OUT（期待値） |
| --- | --- | --- | --- | --- |
| 17 | コメントハイライト span が保護・復元される | `data-comment-id` 変換・復元 | `Hello <span data-comment-id="c1">world</span> end.` | `data-comment-id="c1"` 含む、`CMT` なし |
| 18 | コメントポイント span が保護・復元される | `data-comment-point` 変換・復元 | `Hello <span data-comment-point="c2"></span> end.` | `data-comment-point="c2"` 含む、`CMTP` なし |

### 1-5. Markdown 記法保持（2件）

| # | テスト名 | 検証内容 | IN | OUT（期待値） |
| --- | --- | --- | --- | --- |
| 19 | マークダウン記法をサニタイズで壊さない | `>`, `**` がエスケープされない | `> 引用テキスト\n\n**太字テキスト**` | `> 引用テキスト` `**太字テキスト**` 含む |
| 20 | テキスト前後の改行を DOMPurify が除去しない | 先頭・末尾の `\n\n` が保持される | `\n\nsome <b>text</b>\n\n` | 先頭・末尾 `\n\n`、`some text` 含む |

### 1-6. インラインコード保護（4件）

| # | テスト名 | 検証内容 | IN | OUT（期待値） |
| --- | --- | --- | --- | --- |
| 21 | インラインコード内のHTMLタグがそのまま保持される | バッククォート内の `<script>` `<iframe>` が除去されない | リスト項目内に `` `<script>` `` `` `<iframe>` `` | `` `<script>` `` `` `<iframe>` `` 含む |
| 22 | 複数のインラインコードのHTMLタグがそのまま保持される | 複数のインラインコード内タグが保持される | `` `<div>` `` と `` `<span>` `` | `` `<div>` `` `` `<span>` `` 含む |
| 23 | ダブルバッククォートのインラインコードのHTMLタグがそのまま保持される | 2重バッククォート内のタグが保持される | ``` `` `<script>` `` ``` | `` `<script>` `` 含む |
| 24 | `<br>` `<hr>` テスト（#14）を分割 | `<hr>` タグ保持 | `上<hr>下` | `<hr>` 含む |

> 注: #14 は実装上 `<br>` と `<hr>` が別テストのため、実テスト数は24件。

---

## 2. getMarkdownFromEditor（2件）

WYSIWYG エディタから Markdown 文字列を取得する出口関数。tiptap-markdown シリアライザの出力に対し、`restoreBlankLines` で空行マーカーを復元し、`postprocessMathBlock` で math フェンスを `$$` 記法に変換し、コメントデータを末尾に付加する。

| # | テスト名 | 検証内容 | IN（モックシリアライザ出力） | OUT（期待値） |
| --- | --- | --- | --- | --- |
| 1 | シリアライザ出力の改行数をそのまま保持する | 画像→コードブロック間の `\n` が増えない | `![img](url)\n` + コードブロック js | `![img](url)\n` + コードフェンス開始 含む |
| 2 | 既に空行がある場合、そのまま保持する | 画像→コードブロック間の `\n\n` がそのまま | `![img](url)\n\n` + コードブロック js | `![img](url)\n\n` + コードフェンス開始 含む |

---

## 3. preserveBlankLines（5件）

エディタへの入力前処理。ProseMirror が圧縮・正規化する情報を ZWSP/ZWNJ マーカーで記録する。連続空行（`\n{3,}`）を ZWSP マーカー段落に変換し（空行圧縮対策）、ブロック間の tight transition（空行なし）を ZWNJ でマークする（`\n\n` 正規化対策）。

| # | テスト名 | 検証内容 | IN | OUT（期待値） |
| --- | --- | --- | --- | --- |
| 1 | 3つ以上の改行を ZWSP マーカー段落に変換する | `\n\n\n\n` → ZWSP 挿入 | `text1\n\n\n\ntext2` | `text1\n\n\u200B\n\n\u200B\n\ntext2` |
| 2 | 2つの改行（通常の段落区切り）はそのまま | `\n\n` が変更されない | `text1\n\ntext2` | IN と同一 |
| 3 | コードブロック内の連続改行は保持する | フェンス内部は非対象 | テキスト + コードブロック内に `\n\n\n\n` + テキスト | コードブロック内の `\n\n\n\n` がそのまま |
| 4 | 通常の入力をそのまま返す（改行数を変更しない） | 空行ありリスト等がそのまま | `テキスト\n\n- リスト` / `- 項目A\n\n1. 項目B` / `行1\n行2\n行3` | 各 IN と同一 |
| 5 | リスト前後の tight transition に ZWNJ マーカーを付与する | 空行なし→ZWNJ付与、空行あり→なし | `テキスト\n- リスト` / `# 見出し\n- リスト` / `- リスト\nテキスト` / `テキスト\n\n- リスト` | ZWNJ 付与 / ZWNJ 付与 / ZWNJ 付与 / IN と同一 |

---

## 4. restoreBlankLines（2件）

エディタからの出力後処理（`getMarkdownFromEditor` 内で呼ばれる）。`preserveBlankLines` が埋め込んだマーカーを除去し、元の改行数を復元する。

| # | テスト名 | 検証内容 | IN | OUT（期待値） |
| --- | --- | --- | --- | --- |
| 1 | ZWSP マーカーを除去して空行を復元する | ZWSP 段落 → 空行に戻る | `text1\n\n\u200B\n\n\u200B\n\ntext2` | `text1\n\n\n\ntext2` |
| 2 | ZWSP がなければそのまま返す | マーカーなしは変更なし | `text1\n\ntext2` | IN と同一 |
