# GFM (GitHub Flavored Markdown) フォーマット仕様

更新日: 2026-03-06
出典: [GitHub Flavored Markdown Spec](https://github.github.com/gfm/)

GFM は [CommonMark](https://spec.commonmark.org/) の厳密なスーパーセットであり、テーブル・取り消し線・タスクリスト・拡張オートリンク・Disallowed Raw HTML を追加した仕様である。

---

## 1. 基礎知識 (Section 2: Preliminaries)

### 1.1 文字と行 (Section 2.1)

> "A character is a Unicode code point."

> "A line is a sequence of zero or more characters other than newline (U+000A) or carriage return (U+000D), followed by a line ending or by the end of file."

> "A line ending is a newline (U+000A), a carriage return (U+000D) not followed by a newline, or a carriage return and a following newline."

> "A line containing no characters, or a line containing only spaces (U+0020) or tabs (U+0009), is called a blank line."

### 1.2 タブ (Section 2.2)

> "Tabs in lines are not expanded to spaces. However, in contexts where whitespace helps to define block structure, tabs behave as if they were replaced by spaces with a tab stop of 4 characters."

### 1.3 安全でない文字 (Section 2.3)

> "For security reasons, the Unicode character U+0000 must be replaced with the REPLACEMENT CHARACTER (U+FFFD)."

---

## 2. ブロック構造 (Section 4: Leaf blocks)

### 2.1 水平線 (Section 4.1, Examples 13-31)

> "A line consisting of 0-3 spaces of indentation, followed by a sequence of three or more matching `-`, `_`, or `*` characters."

- 文字は統一必須（混在不可）
- 文字間にスペース・タブ許可
- 4スペースインデントはコードブロックになる

### 2.2 ATX 見出し (Section 4.2, Examples 32-49)

> "String of characters between opening sequence of 1-6 unescaped `#` characters and optional closing sequence."

```markdown
# 見出し1
## 見出し2
### 見出し3
#### 見出し4
##### 見出し5
###### 見出し6
```

- `#` の直後に空白または行末が必須（`#5` は見出しではない: Example 34）
- 末尾の `#` は任意。前にスペースが必須、後にスペースのみ許可
- 末尾 `#` の数は開始と一致しなくてよい
- 0-3スペースのインデント許可
- 空の見出し許可（Example 49）

### 2.3 フェンスコードブロック (Section 4.5, Examples 89-117)

> "A code fence is a sequence of at least three consecutive backtick characters (`` ` ``) or tildes (`~`)."

- 開始フェンス: 3個以上の `` ` `` または `~`、最大3スペースインデント
- 終了フェンス: 開始と同じ文字、開始以上の個数、最大3スペースインデント
- 終了フェンスの後にはスペースのみ許可
- インフォ文字列: 開始フェンスのみに付与可能
- バッククォートフェンスのインフォ文字列にバッククォート不可（Example 115）。チルダフェンスは可
- 開始フェンスが N スペースインデントの場合、内容行から最大 N スペースを除去（Examples 101-103）
- 閉じられなかったフェンスはドキュメント/コンテナの末尾で閉じる

### 2.4 HTML ブロック (Section 4.6)

7種類の開始条件:

| 種類 | 開始パターン | 終了条件 |
| --- | --- | --- |
| 1 | `<script>`, `<pre>`, `<style>`（大文字小文字不問） | 対応する終了タグ |
| 2 | `<!--` | `-->` |
| 3 | `<?` | `?>` |
| 4 | `<!` + 大文字 | `>` |
| 5 | `<![CDATA[` | `]]>` |
| 6 | ブロックレベルタグ（`<div>`, `<table>`, `<p>`, `<h1>`-`<h6>`, `<ul>`, `<ol>`, `<li>` 等） | 次の空行 |
| 7 | 完全な開タグまたは閉タグ単独（段落の割り込み不可） | 次の空行 |

### 2.5 リンク参照定義 (Section 4.7)

```markdown
[ラベル]: URL "タイトル"
```

- レンダリングされないが、リンク・画像の参照先として使用される
- ラベルは大文字小文字を区別しない

### 2.6 段落 (Section 4.8)

> "Sequence of non-blank lines that cannot be interpreted as other kinds of blocks."

### 2.7 空行 (Section 4.9)

> "Line containing no characters, or only spaces/tabs."

- ブロック要素間の区切り
- loose/tight リストの判定に使用

---

## 3. コンテナブロック (Section 5: Container blocks)

### 3.1 ブロック引用 (Section 5.1)

> "A block quote marker consists of 0-3 spaces of initial indent, plus (a) the character `>` together with a following space, or (b) a single character `>` not followed by a space."

```markdown
> 引用テキスト
> 続き
```

- ネストサポート
- **遅延継続 (Lazy continuation)**: 段落の継続行では `>` を省略可能
- 2つのブロック引用を連続させるには空行が必要

### 3.2 リスト項目 (Section 5.2)

**箇条書きマーカー**:

> "A bullet list marker is a `-`, `+`, or `*` character."

**順序付きマーカー**:

> "An ordered list marker is a sequence of 1-9 arabic digits (0-9), followed by either a `.` character or a `)` character."

```markdown
- 箇条書き
+ 箇条書き
* 箇条書き

1. 番号付き
2) 番号付き
```

- 順序付きリストが段落を割り込む場合、開始番号は1でなければならない
- リスト項目の内容は W+N スペースでインデント（W=マーカー幅、N=後続スペース数、1<=N<=4）

### 3.3 タスクリスト項目 (GFM 拡張, Section 5.3, Example 279)

> "A task list item marker consists of a checkbox `[ ]` or `[x]` (case-insensitive), followed by one or more spaces."

```markdown
- [ ] 未完了タスク
- [x] 完了タスク
- [X] 完了タスク（大文字も可）
```

### 3.4 リスト (Section 5.4)

> "A list is a sequence of one or more list items of the same type."

**密なリスト (Tight)**:

> "A list is tight if it contains only list items with at most one paragraph each, and if no list items are separated by blank lines."

- 各項目は `<p>` で囲まれない

**緩いリスト (Loose)**:

> "A list is loose if any of its constituent list items are separated by blank lines, or if any of its constituent list items directly contain two block-level elements with a blank line between them."

- 各項目が `<p>` で囲まれる

---

## 4. インライン要素 (Section 6: Inlines)

### 4.1 バックスラッシュエスケープ (Section 6.1, Examples 296-305)

> "Any ASCII punctuation character may be backslash-escaped."

**ASCII 句読文字の完全リスト**:

```
! " # $ % & ' ( ) * + , - . / : ; < = > ? @ [ \ ] ^ _ ` { | } ~
```

- コードスパン内・コードブロック内ではリテラル扱い（エスケープ無効）
- その他のコンテキストでは有効

### 4.2 エンティティ・数値文字参照 (Section 6.2, Examples 306-327)

> "A valid HTML entity reference or numeric character reference can be used in place of the corresponding Unicode character."

| 種類 | 構文 | 例 |
| --- | --- | --- |
| HTML エンティティ | `&name;` | `&amp;` → `&`, `&lt;` → `<`, `&gt;` → `>` |
| 10進数値参照 | `&#decimal;` | `&#35;` → `#` |
| 16進数値参照 | `&#xhex;` | `&#x23;` → `#` |

**適用範囲**:

> "Entity and numeric character references are not recognized in code blocks or code spans."

| コンテキスト | 展開 |
| --- | --- |
| 通常テキスト | される |
| コードスパン内 | **されない** |
| コードブロック内 | **されない** |
| URL 内 | される |
| リンクタイトル内 | される |

> "Entity and numeric character references cannot be used in place of symbols indicating structure in CommonMark documents."

### 4.3 コードスパン (Section 6.3, Examples 328-349)

> "A backtick string is a string of one or more backtick characters (`` ` ``) that is neither preceded nor followed by a backtick. A code span begins with a backtick string and ends with a backtick string of equal length."

**基本ルール**:

- 開始と終了で**同じ数**のバッククォートを使用
- 開始デリミタと同じ数のバッククォート文字列が最初に見つかった位置で閉じる
- バックスラッシュエスケープは効かない（内容はリテラル）
- 改行はスペースに変換される

**先頭・末尾スペースの扱い**:

> "If the resulting string both begins AND ends with a space character, but does not consist entirely of space characters, a single space character is removed from the front and back."

- 先頭と末尾の**両方**がスペースで、かつスペースのみではない → 各1文字除去
- 片方だけスペース → 除去しない
- スペースのみ → 除去しない

**バッククォート数の決定方法**:

内容に含まれるバッククォートの連続と衝突しない最小数を選ぶ。

| 内容 | 必要なデリミタ数 | 記法 |
| --- | --- | --- |
| バッククォートなし | 1個 | `` `code` `` |
| 単独の `` ` `` あり | 2個 | ``` `` foo`bar `` ``` |
| `` `` `` あり、単独 `` ` `` なし | 1個 | `` ` foo``bar ` `` |
| `` ` `` と `` `` `` の両方あり | 3個 | ```` ``` foo``bar` ``` ```` |

### 4.4 強調・太字 (Section 6.4, Examples 350-391)

**デリミタラン**:

> "A left-flanking delimiter run is a sequence of one or more emphasis markers that is (1) not followed by Unicode whitespace, and either (2a) not followed by a punctuation character, or (2b) followed by a punctuation character and also preceded by Unicode whitespace or a punctuation character."

> "A right-flanking delimiter run is a sequence of one or more emphasis markers that is (1) not preceded by Unicode whitespace, and either (2a) not preceded by a punctuation character, or (2b) preceded by a punctuation character and also followed by Unicode whitespace or a punctuation character."

```markdown
*強調* または _強調_
**太字** または __太字__
***太字強調***
```

- `_` は単語内部では強調に使えない（`foo_bar_baz` は強調にならない）
- `*` は単語内部でも使用可能

### 4.5 取り消し線 (GFM 拡張, Section 6.5, Example 490)

> "GFM enables the strikethrough extension, where text wrapped with `~~` is rendered with a strikethrough."

```markdown
~~取り消し~~
```

### 4.6 リンク (Section 6.6, Examples 493-519)

```markdown
[テキスト](URL "タイトル")
[テキスト][参照ラベル]
```

- ラベルは大文字・小文字を区別しない
- リンク先は絶対URIまたはパス参照
- URL を `<>` で囲むことも可能
- タイトルはダブルクォート・シングルクォート・括弧で囲む
- タイトルとURLの間にはスペースが必要

### 4.7 画像 (Section 6.7, Examples 520-527)

> "Image syntax is exactly like link syntax, with one difference. Instead of link text, we have an image description."

```markdown
![代替テキスト](URL "タイトル")
```

### 4.8 オートリンク (Section 6.8-6.9, Examples 619-621)

```markdown
<https://example.com>
<user@example.com>
```

- GFM 拡張: `www.example.com` も自動リンク化（`<>` 不要）

### 4.9 Disallowed Raw HTML (GFM 拡張, Section 6.11, Examples 644-649)

> "GFM disables the following HTML tags: `<title>`, `<textarea>`, `<style>`, `<xmp>`, `<iframe>`, `<noembed>`, `<noframes>`, `<script>`, `<pre>`"

- これらのタグはフィルタリングされプレーンテキストとして出力される
- その他の raw HTML はそのまま通過

### 4.10 改行 (Section 6.12-6.13, Examples 651-657)

**ハードブレーク (Section 6.12)**:

> "A hard line break is a line ending (newline) preceded by two or more spaces or a backslash."

| 構文 | 出力 |
| --- | --- |
| 行末に2スペース以上 | `<br />` |
| 行末に `\` | `<br />` |

**ソフトブレーク (Section 6.13)**:

> "A soft line break is a line ending that is not a hard line break."

- 出力ではスペースに変換される

---

## 5. テーブル (GFM 拡張, Section 4.10, Examples 198-205)

### 5.1 基本構造

```markdown
| ヘッダ1 | ヘッダ2 | ヘッダ3 |
| --- | --- | --- |
| データ1 | データ2 | データ3 |
```

ヘッダ行 + セパレータ行（delimiter row）+ 0個以上のデータ行で構成。

### 5.2 セパレータ行（delimiter row）

> "The delimiter row consists of cells whose only content are hyphens (`-`), and optionally, a leading or trailing colon (`:`), or both, to indicate left, right, or center alignment respectively."

**配置指定**:

| 構文 | 配置 |
| --- | --- |
| `---` | デフォルト（左） |
| `:---` | 左寄せ |
| `---:` | 右寄せ |
| `:---:` | 中央寄せ |

- ハイフンは最低1個必要

### 5.3 セル内のルール

- 先頭・末尾のパイプ `|` は推奨だが任意
- セル内容の前後の空白はトリムされる
- セル内でパイプを使う場合は `\|` でエスケープ
- セル内ではインライン要素が解析される（コードスパン、強調等）
- ブロック要素は使用不可

### 5.4 セル数の不一致

- ヘッダ行とセパレータ行のセル数が一致しない → テーブルと認識されない (Example 203)
- データ行のセル数がヘッダより少ない → 空セルで補充 (Example 204)
- データ行のセル数がヘッダより多い → 超過分は無視

### 5.5 テーブルの終了

- 空行で終了
- 他のブロック要素（引用等）の開始で終了 (Example 201)

### 5.6 具体例

**Example 198**: 基本的なテーブル

```markdown
| foo | bar |
| --- | --- |
| baz | bim |
```

**Example 199**: 配置指定

```markdown
| abc | defghi |
| :-: | -----------: |
| bar | baz |
```

**Example 200**: セル内のパイプエスケープ

```markdown
| f\|oo  |
| ------ |
| b `\|` az |
| b **\|** im |
```

**Example 205**: ヘッダのみのテーブル（データ行なし）

```markdown
| abc |
| --- |
```

---

## 本仕様と anytime-markdown の関係

本エディタのラウンドトリップ処理で GFM 仕様が直接関係する箇所:

| GFM 仕様セクション | エディタの処理 | 参照 |
| --- | --- | --- |
| 6.3 コードスパン | バッククォート数の最小化（テーブル行内） | `sanitizeMarkdown.ts` `normalizeCodeSpanDelimitersInLine()` |
| 4.10 テーブル | セパレータ行の正規化、セル内エスケープ復元 | `types.ts` `getMarkdownFromEditor()` |
| 6.1 バックスラッシュエスケープ | テーブルセル内のエスケープ除去 | `types.ts` L43 |
| 6.2 エンティティ参照 | テーブルセル内の `&gt;` `&lt;` デコード | `types.ts` L44 |
| 4.5 フェンスコードブロック | コードブロック内容の保護 | `sanitizeMarkdown.ts` `splitByCodeBlocks()` |
| 6.11 Disallowed Raw HTML | 危険タグのフィルタリング | `sanitizeMarkdown.ts` DOMPurify 処理 |
