# anytime-markdown 機能ギャップ分析

## 比較対象: Typora, Obsidian, StackEdit, Mark Text, Notion, HackMD, Zettlr

---

## 不足機能一覧（優先度順）

### S: 非常に高い（ユーザーが頻繁に期待する基本機能）

| # | 機能 | 主な提供ツール | 実装難易度 |
|---|------|--------------|-----------|
| 1 | PDF エクスポート | Typora, Zettlr, StackEdit | 中 |
| 2 | HTML エクスポート | Typora, StackEdit, Mark Text | 低 |
| 3 | 数式（LaTeX/KaTeX）| Typora, Obsidian, StackEdit, HackMD | 中 |
| 4 | スラッシュコマンド（`/` メニュー）| Notion, Obsidian, HackMD | 中 |

### A: 高い（差別化・利便性向上に直結）

| # | 機能 | 主な提供ツール | 実装難易度 |
|---|------|--------------|-----------|
| 5 | フォーカスモード | Typora, Mark Text, Zettlr | 低 |
| 6 | タイプライターモード | Typora, Mark Text, Zettlr | 低 |
| 7 | ワードカウント/読了時間 | Typora, Obsidian, Zettlr | 低 |
| 8 | 脚注（Footnotes）| Typora, Obsidian, Zettlr, HackMD | 中 |
| 9 | 目次（TOC）自動生成 | Typora, Obsidian, Zettlr, HackMD | 中 |
| 10 | テーマ/CSSカスタマイズ | Typora, Obsidian, Mark Text | 中 |

### B: 中程度（あると便利だが必須ではない）

| # | 機能 | 主な提供ツール | 実装難易度 |
|---|------|--------------|-----------|
| 11 | DOCX エクスポート | Typora, Zettlr | 高 |
| 12 | 上付き/下付き文字 | Typora, HackMD | 低 |
| 13 | 絵文字ピッカー | Notion, Obsidian, HackMD | 中 |
| 14 | 文字色/背景色 | Notion, HackMD | 中 |
| 15 | テキスト配置（左/中央/右）| Typora, Notion | 低 |
| 16 | スペルチェック | Zettlr, Typora | 低〜中 |
| 17 | 自動保存 | Obsidian, Notion, Typora | 低 |
| 18 | ブロック D&D 並べ替え | Notion | 高 |
| 19 | コールアウト/アドモニション | Obsidian, HackMD | 中 |
| 20 | コマンドパレット | Obsidian | 中 |

### C: 低い（特定ニーズ向け）

| # | 機能 | 実装難易度 |
|---|------|-----------|
| 21 | 双方向リンク | 高 |
| 22 | グラフビュー | 高 |
| 23 | リアルタイム共同編集 | 高 |
| 24 | バージョン履歴 | 高 |
| 25 | 文献管理 | 高 |
| 26 | プレゼンテーションモード | 高 |
| 27 | 埋め込みブロック | 中 |
| 28 | タグ機能 | 中 |
| 29 | YAML フロントマター UI | 中 |

---

## 推奨実装順序

1. **即効性の高い低難易度**: HTML エクスポート、フォーカスモード、タイプライターモード、ワードカウント/読了時間、自動保存
2. **競合との差を埋める中難易度S**: PDF エクスポート、数式対応、スラッシュコマンド
3. **段階的に追加するA中難易度**: 脚注、TOC、テーマ、コールアウト
