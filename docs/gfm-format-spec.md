# GFM (GitHub Flavored Markdown) フォーマット仕様

更新日: 2026-03-06
出典: [GitHub Flavored Markdown Spec](https://github.github.com/gfm/)

GFM は [CommonMark](https://spec.commonmark.org/) の厳密なスーパーセットである。本文書は anytime-markdown エディタの出力に関係する構文のみを抽出したものである。

---

## 1. ATX 見出し (Section 4.2, Examples 32-49)

```markdown
# 見出し1
## 見出し2
### 見出し3
```

- `#` を1～6個使用（7個以上は見出しではない）
- `#` の直後に空白または行末が必須（`#5` は見出しではない）
- 末尾の `#` は任意。前にスペースが必須

## 2. フェンスコードブロック (Section 4.5, Examples 89-117)

> "A code fence is a sequence of at least three consecutive backtick characters (`` ` ``) or tildes (`~`)."

- 開始フェンス: 3個以上の `` ` `` または `~`
- 終了フェンス: 開始と同じ文字、開始以上の個数
- インフォ文字列（言語指定）は開始フェンスのみ
- バッククォートフェンスのインフォ文字列にバッククォート不可（チルダフェンスは可）
- 開始フェンスが N スペースインデントの場合、内容行から最大 N スペースを除去
- 閉じられなかったフェンスはドキュメント末尾で閉じる

## 3. テーブル (GFM 拡張, Section 4.10, Examples 198-205)

### 3.1 基本構造

```markdown
| ヘッダ1 | ヘッダ2 | ヘッダ3 |
| --- | --- | --- |
| データ1 | データ2 | データ3 |
```

ヘッダ行 + セパレータ行 + 0個以上のデータ行で構成。

### 3.2 セパレータ行（delimiter row）

> "The delimiter row consists of cells whose only content are hyphens (`-`), and optionally, a leading or trailing colon (`:`), or both, to indicate left, right, or center alignment respectively."

| 構文 | 配置 |
| --- | --- |
| `---` | デフォルト（左） |
| `:---` | 左寄せ |
| `---:` | 右寄せ |
| `:---:` | 中央寄せ |

### 3.3 セル内のルール

- セル内容の前後の空白はトリムされる
- セル内でパイプを使う場合は `\|` でエスケープ
- セル内ではインライン要素が解析される（コードスパン、強調等）
- ブロック要素は使用不可

### 3.4 セル数の不一致

- ヘッダ行とセパレータ行のセル数が不一致 → テーブルと認識されない (Example 203)
- データ行がヘッダより少ない → 空セルで補充
- データ行がヘッダより多い → 超過分は無視

### 3.5 具体例

**Example 200**: セル内のパイプエスケープ

```markdown
| f\|oo  |
| ------ |
| b `\|` az |
| b **\|** im |
```

## 4. コードスパン (Section 6.3, Examples 328-349)

> "A backtick string is a string of one or more backtick characters (`` ` ``) that is neither preceded nor followed by a backtick. A code span begins with a backtick string and ends with a backtick string of equal length."

### 4.1 基本ルール

- 開始と終了で**同じ数**のバッククォートを使用
- 開始デリミタと同じ数のバッククォート文字列が最初に見つかった位置で閉じる
- バックスラッシュエスケープは効かない（内容はリテラル）
- 改行はスペースに変換される

### 4.2 先頭・末尾スペースの扱い

> "If the resulting string both begins AND ends with a space character, but does not consist entirely of space characters, a single space character is removed from the front and back."

- 先頭と末尾の**両方**がスペースで、かつスペースのみではない → 各1文字除去
- 片方だけスペース → 除去しない
- スペースのみ → 除去しない

### 4.3 バッククォート数の決定方法

内容に含まれるバッククォートの連続と衝突しない最小数を選ぶ。

| 内容 | 必要なデリミタ数 | 記法 |
| --- | --- | --- |
| バッククォートなし | 1個 | `` `code` `` |
| 単独の `` ` `` あり | 2個 | ``` `` foo`bar `` ``` |
| `` `` `` あり、単独 `` ` `` なし | 1個 | `` ` foo``bar ` `` |

## 5. リスト (Section 5.2-5.4)

**箇条書き**: `-`, `+`, `*`
**順序付き**: `1.` または `1)`（最大9桁）

**密なリスト (Tight)**: 項目間に空行なし → `<p>` で囲まれない
**緩いリスト (Loose)**: 項目間に空行あり → 各項目が `<p>` で囲まれる

## 6. 強調・太字 (Section 6.4)

```markdown
*強調*
**太字**
***太字強調***
```

- `*` は単語内部でも使用可能
- `_` は単語内部では強調に使えない（`foo_bar_baz` は強調にならない）

## 7. リンク・画像 (Section 6.6-6.7)

```markdown
[テキスト](URL "タイトル")
![代替テキスト](URL "タイトル")
```

## 8. バックスラッシュエスケープ (Section 6.1, Examples 296-305)

> "Any ASCII punctuation character may be backslash-escaped."

```
! " # $ % & ' ( ) * + , - . / : ; < = > ? @ [ \ ] ^ _ ` { | } ~
```

| コンテキスト | エスケープ |
| --- | --- |
| 通常テキスト | 有効 |
| コードスパン内 | **無効**（リテラル扱い） |
| コードブロック内 | **無効**（リテラル扱い） |

## 9. エンティティ参照 (Section 6.2, Examples 306-327)

> "Entity and numeric character references are not recognized in code blocks or code spans."

| 種類 | 構文 | 例 |
| --- | --- | --- |
| HTML エンティティ | `&name;` | `&amp;` → `&`, `&lt;` → `<`, `&gt;` → `>` |
| 10進数値参照 | `&#decimal;` | `&#35;` → `#` |
| 16進数値参照 | `&#xhex;` | `&#x23;` → `#` |

| コンテキスト | 展開 |
| --- | --- |
| 通常テキスト | される |
| コードスパン内 | **されない** |
| コードブロック内 | **されない** |

## 10. 改行 (Section 6.12-6.13)

| 種類 | 構文 | 出力 |
| --- | --- | --- |
| ハードブレーク | 行末に2スペース以上、または `\` | `<br />` |
| ソフトブレーク | 通常の改行 | スペースに変換 |

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
