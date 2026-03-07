# Markdown ラウンドトリップ安定フォーマット仕様

更新日: 2026-03-06

---

## 概要

anytime-markdown エディタでソースモード → WYSIWYG モード → ソースモードの変換（ラウンドトリップ）を行うと、Markdown の一部が正規化される。本文書は、ラウンドトリップで変化しない「安定形式」のフォーマット仕様と、各正規化の発生源を定義する。

---

## 1. テーブルセパレータ行

### 安定形式

```markdown
| --- | --- | --- |
```

### 不安定形式（変換される）

```markdown
|---|---|---|
|---|---------|-----|
```

### 発生源

ProseMirror の tiptap-markdown シリアライザがテーブルをシリアライズする際、セパレータ行を `| --- |` 形式に正規化する。

- **規定元**: tiptap-markdown（外部ライブラリ）のテーブルシリアライザ
- **仕様**: CommonMark / GFM ではセパレータ行のハイフン数やスペースの有無は自由だが、tiptap-markdown は `| --- |` に統一する

---

## 2. テーブルセル内のバックスラッシュエスケープ除去

### 安定形式

```markdown
| 1. 項目 | #見出し | >引用 | +プラス | -マイナス | *アスタリスク |
```

### 不安定形式（変換される）

```markdown
| 1\. 項目 | \#見出し | \>引用 | \+プラス | \-マイナス | \*アスタリスク |
```

### 発生源

tiptap-markdown シリアライザが Markdown 特殊文字をエスケープするが、テーブルセル内ではエスケープ不要なため復元する。

- **規定元**: `types.ts` `getMarkdownFromEditor()` 内の後処理
- **コード**: `line.replace(/\\([.#>+\-*])/g, "$1")`

---

## 3. テーブルセル内の HTML エンティティデコード

### 安定形式

```markdown
| a > b | x < y |
```

### 不安定形式（変換される）

```markdown
| a &gt; b | x &lt; y |
```

### 発生源

ProseMirror がテーブルセル内のテキストノードで `>` `<` を HTML エンティティに変換する。

- **規定元**: `types.ts` `getMarkdownFromEditor()` 内の後処理
- **コード**: `line.replace(/&gt;/g, ">").replace(/&lt;/g, "<")`

---

## 4. テーブルセル内のコードスパンのバッククォート最小化

### 安定形式

内容に含まれるバッククォートの連続と衝突しない最小数のデリミタを使用する。

```markdown
| ` ```html ` |      ← 内容に ``` があるが単独の ` はないため、1個で十分
| `` a`b `` |        ← 内容に単独の ` があるため、2個必要
| ` a``b ` |         ← 内容に `` があるが単独の ` はないため、1個で十分
```

### 不安定形式（変換される）

```markdown
| ```` ```html ```` |  ← 4個 → 1個に最小化される
| `` a``b `` |        ← 2個 → 1個に最小化される
```

### 発生源

tiptap-markdown シリアライザがコードスパンのデリミタを増加させる場合があるため、テーブル行内のみ最小数に正規化する。

- **規定元**: `sanitizeMarkdown.ts` `normalizeCodeSpanDelimitersInLine()` 関数
- **呼出元**: `types.ts` `getMarkdownFromEditor()` 内のテーブル行後処理
- **仕様**: CommonMark Spec Section 6.1 — コードスパンのデリミタは開始と終了で同じ数のバッククォートを使用し、内容内のバッククォート連続と衝突しない数を選ぶ

---

## 5. コメント構文の前処理変換

### 安定形式

```markdown
<span data-comment-id="c1">テキスト</span>
<span data-comment-point="c2"></span>
```

### 不安定形式（変換される）

```markdown
<!-- comment-start:c1 -->テキスト<!-- comment-end:c1 -->
<!-- comment-point:c2 -->
```

### 発生源

`sanitizeMarkdown` のコメント前処理が HTML コメント形式を `<span>` 形式に変換する。ProseMirror はコメントノードを扱えないため、`<span>` に変換してマーク情報として保持する。

- **規定元**: `sanitizeMarkdown.ts` `preprocessComments()` 関数
- **変換方向**: 入力時に一方向変換（`<!-- -->` → `<span>`）。出力時にコメントデータは `getMarkdownFromEditor()` で末尾に付加される

---

## 6. 連続空行の保持（ZWSP マーカー）

### 安定形式

```markdown
text1


text2
```

3つ以上の連続改行はそのまま保持される。

### 発生源

ProseMirror はブロック間を `\n\n` に正規化し、連続空行を圧縮する。これを防ぐため、入力時に ZWSP マーカー段落を挿入し、出力時に復元する。

- **規定元**: `sanitizeMarkdown.ts` `preserveBlankLines()` / `restoreBlankLines()`

---

## 7. Tight transition の保持（ZWNJ マーカー）

### 安定形式

```markdown
テキスト
- リスト
```

空行なしでブロックが続く形式はそのまま保持される。

### 発生源

ProseMirror はブロック間に常に `\n\n` を挿入する。空行なしの tight transition を保持するため、入力時に ZWNJ マーカーを挿入し、出力時に復元する。

- **規定元**: `sanitizeMarkdown.ts` `preserveBlankLines()` / `restoreBlankLines()`

---

## 8. 末尾改行

### 安定形式

ファイル末尾に改行 `\n` が1つ付く。

### 発生源

ProseMirror / tiptap-markdown シリアライザが出力末尾に改行を付加する。

- **規定元**: tiptap-markdown（外部ライブラリ）のシリアライザ

---

## 9. インラインコード内の HTML タグ保護

### 安定形式

```markdown
`<script>` や `<div>` はそのまま保持される
```

### 発生源

`sanitizeMarkdown` がインラインコードをプレースホルダに置換してから DOMPurify を適用し、その後復元する。これにより、バッククォート内の HTML タグが除去されない。

- **規定元**: `sanitizeMarkdown.ts` のインラインコード抽出処理（線形スキャン）
- **仕様**: 任意の数のバッククォートに対応（CommonMark 準拠）

---

## 変換パイプラインと規定元の対応表

| # | 正規化内容 | 規定元 | ファイル | 変換方向 |
| --- | --- | --- | --- | --- |
| 1 | セパレータ行 `\| --- \|` | tiptap-markdown | 外部ライブラリ | 出力時 |
| 2 | エスケープ除去 `\.` → `.` | 自前後処理 | `types.ts:43` | 出力時 |
| 3 | エンティティデコード `&gt;` → `>` | 自前後処理 | `types.ts:44` | 出力時 |
| 4 | バッククォート最小化 | 自前後処理 | `sanitizeMarkdown.ts:321` | 出力時 |
| 5 | コメント構文変換 | 自前前処理 | `sanitizeMarkdown.ts` | 入力時 |
| 6 | 連続空行保持 | 自前前処理+後処理 | `sanitizeMarkdown.ts` | 入出力時 |
| 7 | Tight transition 保持 | 自前前処理+後処理 | `sanitizeMarkdown.ts` | 入出力時 |
| 8 | 末尾改行 | tiptap-markdown | 外部ライブラリ | 出力時 |
| 9 | インラインコード保護 | 自前前処理 | `sanitizeMarkdown.ts` | 入力時 |
