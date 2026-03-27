# Anytime Graph

![VS Marketplace](https://img.shields.io/visual-studio-marketplace/v/anytime-trial.anytime-graph?label=VS%20Marketplace&logo=visual-studio-code)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=anytime-trial_anytime-markdown&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=anytime-trial_anytime-markdown)
[![Bugs](https://sonarcloud.io/api/project_badges/measure?project=anytime-trial_anytime-markdown&metric=bugs)](https://sonarcloud.io/summary/new_code?id=anytime-trial_anytime-markdown)
[![Code Smells](https://sonarcloud.io/api/project_badges/measure?project=anytime-trial_anytime-markdown&metric=code_smells)](https://sonarcloud.io/summary/new_code?id=anytime-trial_anytime-markdown)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=anytime-trial_anytime-markdown&metric=coverage)](https://sonarcloud.io/summary/new_code?id=anytime-trial_anytime-markdown)
[![Duplicated Lines (%)](https://sonarcloud.io/api/project_badges/measure?project=anytime-trial_anytime-markdown&metric=duplicated_lines_density)](https://sonarcloud.io/summary/new_code?id=anytime-trial_anytime-markdown)

**VS Code 用グラフホワイトボードエディタ**

VS Code 内でノードグラフを直接作成・編集できます。`*.graph` ファイルを開くとビジュアルエディタが起動します。

## 機能

- ドラッグ&ドロップ対応のビジュアルノードグラフエディタ
- キャンバス上でノード、エッジ、ラベルを作成
- 物理ベースレイアウト（力指向グラフ、Fruchterman-Reingold アルゴリズム）
- 制約ベースの重なり除去（VPSC）
- 接続ノードの自動配置で見やすいレイアウトを実現
- `*.graph` ファイル用カスタムエディタ

## 使い方

1. 拡張機能をインストール
2. 新しいグラフを作成: **コマンドパレット** > `Anytime Graph: New Graph`
3. または任意の `*.graph` ファイルを開く

## ファイル形式

グラフは `*.graph` ファイルとして保存されます。プレーンな JSON 形式のため、バージョン管理に適しています。

## ライセンス

[MIT](https://github.com/anytime-trial/anytime-markdown/blob/master/LICENSE)
