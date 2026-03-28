# Anytime Markdown Editor

![VS Marketplace](https://img.shields.io/visual-studio-marketplace/v/anytime-trial.anytime-markdown?label=VS%20Marketplace&logo=visual-studio-code)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=anytime-trial_anytime-markdown&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=anytime-trial_anytime-markdown)
[![Bugs](https://sonarcloud.io/api/project_badges/measure?project=anytime-trial_anytime-markdown&metric=bugs)](https://sonarcloud.io/summary/new_code?id=anytime-trial_anytime-markdown)
[![Code Smells](https://sonarcloud.io/api/project_badges/measure?project=anytime-trial_anytime-markdown&metric=code_smells)](https://sonarcloud.io/summary/new_code?id=anytime-trial_anytime-markdown)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=anytime-trial_anytime-markdown&metric=coverage)](https://sonarcloud.io/summary/new_code?id=anytime-trial_anytime-markdown)
[![Duplicated Lines (%)](https://sonarcloud.io/api/project_badges/measure?project=anytime-trial_anytime-markdown&metric=duplicated_lines_density)](https://sonarcloud.io/summary/new_code?id=anytime-trial_anytime-markdown)

**AI が書いた Markdown を、コーディングしながらリッチにプレビュー — VS Code だけで完結。**

AI アシスタントは仕様書や設計書を Markdown で書いてくれますが、プレーンテキストでのレビューは読みにくく、外部ツールとの行き来で集中が途切れがちです。

Anytime Markdown なら、WYSIWYG エディタで Markdown をリッチに表示・編集でき、**AI との共同編集機能**でファイルの競合も防げます。


## 1. できること

- **WYSIWYG 編集** — テーブル・ダイアグラム（Mermaid / PlantUML）・数式（KaTeX）付きでリッチに編集
- **3つのモード** — WYSIWYG・ソース・レビューをワンクリックで切り替え
- **Agent Note** — 画像やスクリーンショットを AI ツールに共有
- **Claude Code 共同編集** — AI がファイル編集中にエディタを自動ロックし、競合を防止
- **スラッシュコマンド** — `/` で見出し・テーブル・ダイアグラム・数式などを素早く挿入


## 2. エディタモード

| モード | 内容 |
| --- | --- |
| **WYSIWYG** | 書式・ダイアグラム・テーブル付きのビジュアル編集 |
| **ソース** | 生の Markdown を直接編集 |
| **レビュー** | 読み取り専用。AI 出力のレビューに最適 |

ツールバーのトグルまたは `Ctrl+Alt+S`（Mac は `Cmd+Alt+S`）で切り替え。


## 3. Agent Note — AI にビジュアル情報を共有

サイドバーの **Agent Note** パネルから、画像・表・手書きメモなどの視覚情報を AI ツールに共有できます。

| 操作 | 説明 |
| --- | --- |
| **Edit Agent Note** | ノートファイルを WYSIWYG エディタで開く |
| **Copy Agent Note Path** | ファイルパスをクリップボードにコピー |
| **Clear Agent Note** | ノートと画像をすべて削除 |

- 画像はクリップボードから直接貼り付け可能
- Claude Code がインストールされている場合、`/anytime-note` スキルが自動生成され、ノートの内容をコンテキストとして AI に指示できる

**使用例:**

1. Agent Note にスクリーンショットや表を貼り付ける
2. Claude Code で `/anytime-note バグを修正して` と指示する
3. AI がノートの画像を読み取り、コンテキストに基づいて作業を実行する


## 4. Claude Code 共同編集 — AI 編集中の自動ロック

Claude Code（CLI）がファイルを編集中のとき、Anytime Markdown エディタを自動的にロックし、編集の競合を防ぎます。

**動作の流れ:**

1. Claude Code が `Edit` / `Write` ツールを実行すると、エディタが自動的に読み取り専用になる
2. エディタ上部に「Claude Code が編集中です」のオーバーレイバーが表示される
3. 編集完了から 3 秒後にロックが解除され、最新の内容が自動反映される

**特徴:**

- **自動セットアップ** — 拡張機能の初回起動時に Claude Code のフック設定を自動追加（`~/.claude/settings.json`）
- **連続編集対応** — 複数の Edit が連続する場合、最後の Edit から 3 秒後にまとめて解除
- **安全なフォールバック** — Claude Code がクラッシュした場合、30 秒後にタイムアウトで自動解除
- **ゼロ設定** — Claude Code がインストールされていれば、追加の設定は不要


## 5. スラッシュコマンド

`/` を入力して挿入: 見出し、リスト、テーブル、コードブロック、Mermaid / PlantUML ダイアグラム、数式（KaTeX）、HTML、目次、脚注、アドモニション、コメントなど。


## 6. 設定

| 設定 | デフォルト | 説明 |
| --- | --- | --- |
| `anytimeMarkdown.fontSize` | `0` | フォントサイズ（px）。0 = VS Code デフォルト |
| `anytimeMarkdown.editorMaxWidth` | `0` | エディタの最大幅（px）。0 = 制限なし |


## 7. はじめかた

`.md` / `.markdown` ファイルを開くと自動的に Anytime Markdown で表示されます。\
VS Code 標準エディタで開きたい場合は、右クリック → **「Open With...」** → **「Text Editor」** を選択。

VS Code 1.109.0 以上が必要です。


## 8. ライセンス

MIT
