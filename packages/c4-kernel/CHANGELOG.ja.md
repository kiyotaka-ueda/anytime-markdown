# 変更履歴

"c4-kernel" パッケージの主な変更をこのファイルに記録します。

形式は [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) に基づいています。

## [Unreleased]

## [0.0.1] - 2026-04-04

初回リリース。C4 ア���キテクチャモデルのパーサーおよびグラフドキュメント変換器。

### 追加

- Mermaid C4 図パーサ���（C4Context、C4Container、C4Component、C4Dynamic、C4Deployment）
- C4 モデルから graph-core 描画用 GraphDocument への変換
- C4 要素型: Person、System、SystemDb、SystemQueue、Container、ContainerDb、ContainerQueue、Component
- ラベルおよび技術アノテーション付き C4 リレーションシップ解析
- バウンダリ対応（System_Boundary��Container_Boundary、Boundary、Enterprise_Boundary）
