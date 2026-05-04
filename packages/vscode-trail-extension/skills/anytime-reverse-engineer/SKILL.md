---
name: anytime-reverse-engineer
description: "Trail DB に保存済みのコードグラフ・コミュニティに対し、AI で name / summary を付与し、各コミュニティに属する C4 要素の role（primary / secondary / dependency）を判定して mappings_json に保存する後処理スキル。将来的にソースコードから設計書まで生成するリバースエンジニアリングパイプラインに発展させる。コードグラフ生成自体は VS Code 拡張 (Anytime Trail) 側で完了している前提。"
trigger: /anytime-reverse-engineer
---

# /anytime-reverse-engineer

VS Code 拡張機能 (Anytime Trail) の `Anytime Trail: コード解析` で Trail DB に保存されたコミュニティ群に対し、AI 後処理として以下を実施する。

- 各コミュニティに **`name`（3 語以内）と `summary`（1 文・60 文字以内）** を Haiku サブエージェント並列で生成
- 各コミュニティに属する C4 要素の役割（**primary / secondary / dependency**）を判定して `mappings_json` カラムへ保存

> [!IMPORTANT]
> 本スキル単体ではコードグラフを生成しない。実行前に Trail DB の `current_code_graphs` / `current_code_graph_communities` にグラフが保存されている必要がある。\
> 未保存の場合は **Step 0** で `mcp-trail` 経由（または VS Code コマンド）で生成する。


## 処理フロー


### Step 0: コード解析の起動（Trail DB が空の場合）

`current_code_graphs` が空、または最新コミット反映のため再解析が必要な場合に実行する。\
既に最新の解析結果が DB に保存済みなら省略可。

選択肢 A: `mcp-trail` 経由（推奨・skill 内で完結）

- ツール: `mcp__mcp-trail__analyze_current_code`
- 引数: `workspacePath`（解析対象の絶対パス、省略時は VS Code 拡張の現在ワークスペース） / `tsconfigPath`（特定の tsconfig 指定、省略時は最上位を自動選択）
- 戻り値: `{ repoName, fileCount, nodeCount, edgeCount, commitId, durationMs, warnings, progressLog }`
- 動作: VS Code 拡張内の TrailDataServer に `POST /api/analyze/current` を送り、`Anytime Trail: コード解析` と同じパイプラインを起動する。WebSocket 経由で進捗を購読し、完了時に progress ログ付きで返す。並行実行中は 409 で拒否される

選択肢 B: VS Code コマンド経由（GUI ユーザー向け）

- コマンドパレットで `Anytime Trail: コード解析` を実行する

> [!NOTE]
> `mcp-trail` 経由を使うには VS Code 拡張 (Anytime Trail) が稼働中である必要がある。\
> `get_analyze_status` ツールで現在の解析進行状態を確認できる（並行実行回避用）。


### Step 1: 前提値の解決

VS Code 設定から以下 2 値を取得する。

| 値 | 取得元設定キー | 既定値（未設定時） |
| --- | --- | --- |
| `trailDbPath` | `anytimeTrail.database.storagePath` | `${workspaceFolder}/.vscode/trail.db` |
| `repoName` | `anytimeTrail.workspace.path` の basename | ワークスペースフォルダ名 |

```bash
WS=$(pwd) node -e "
const fs = require('fs');
const path = require('path');
const ws = process.env.WS;
const stripJsonc = (s) => s.replace(/\/\*[\s\S]*?\*\//g,'').replace(/(^|[^:])\/\/[^\n]*/g,'\$1');

const settings = {};
const candidates = [
  path.join(ws, '.vscode/settings.json'),
  path.join(process.env.HOME || '', '.vscode-server/data/User/settings.json'),
  path.join(process.env.HOME || '', '.config/Code/User/settings.json'),
];
for (const f of candidates) {
  if (!fs.existsSync(f)) continue;
  try {
    Object.assign(settings, JSON.parse(stripJsonc(fs.readFileSync(f, 'utf8'))));
  } catch {}
}

const dbDir = settings['anytimeTrail.database.storagePath'] || '.vscode';
const trailDbPath = path.isAbsolute(dbDir)
  ? path.join(dbDir, 'trail.db')
  : path.join(ws, dbDir, 'trail.db');

const wsPath = settings['anytimeTrail.workspace.path'] || ws;
const repoName = path.basename(wsPath);

const cacheDir = path.join(ws, '.vscode');
const cachePath = path.join(cacheDir, '.community_summary_cache.json');

console.log(JSON.stringify({ trailDbPath, repoName, cachePath }, null, 2));
"
```


### Step 2: コミュニティ要約（AI 命名）

`current_code_graph_communities` の各コミュニティに `name` + `summary` を生成して書き戻す。

**処理フロー**

1. **DB 読み込み**: `trailDbPath` を sql.js で開き、`current_code_graph_communities WHERE repo_name = ?` で命名前のコミュニティ一覧（`community_id` / `label`）を取得する。\
`current_code_graphs.graph_json` を `JSON.parse` して各コミュニティに属するノード ID を集約する。
2. **対象選別**: ノード数 3 以上のコミュニティのみ要約対象とし、残りは `label` のみで運用する。
3. **キャッシュ確認**: コミュニティ内ノード ID をソート + 連結 → SHA-256 でハッシュ化する。`cachePath` に同ハッシュのエントリがあれば再利用する。
4. **バッチ作成**: 未キャッシュのコミュニティを **10 件ずつ** に分割し、各バッチを 1 サブエージェントへ渡す。
5. **サブエージェント実行**: `model: haiku` で並列実行する（`free -h` の結果で 2〜3 並列を判定）。
6. **DB 書き込み**: 結果を sql.js で `current_code_graph_communities` テーブルへ `INSERT OR REPLACE`（既存の `label` は保持）し、`db.export()` で `trailDbPath` に書き戻す。
7. **キャッシュ更新**: 新規エントリを `cachePath` に書き戻す。

**サブエージェントへのプロンプト**

```text
以下のファイルクラスタ群から、各クラスタの簡潔な name と summary を JSON で返してください。

注意:
- 推測はファイル名・パス・パッケージ・現在のラベルからのみ行う（不明な場合は label をそのまま name に採用）
- name: 3 語以内、日本語の体言止め
- summary: 1 文・60 文字以内・体言止め

入力:
[
  {
    "communityId": 8,
    "currentLabel": "utils",
    "package": "markdown-core",
    "nodes": ["latexToExpr", "mermaidExpr", "mathParse"]
  },
  ...
]

出力（JSON のみ、説明文不要）:
{"summaries":[
  {"communityId":8,"name":"数式変換","summary":"Mermaid/LaTeX/MathJax の数式表現を AST に変換するユーティリティ群。"}
]}
```

**DB 書き込みスクリプト（Node.js）**

```javascript
// summaries: Array<{ communityId: number, name: string, summary: string }>

const sqlJs = require('sql.js');
const fs = require('fs');

async function writeSummariesToDb(trailDbPath, repoName, summaries) {
  const SQL = await sqlJs();
  const buf = fs.readFileSync(trailDbPath);
  const db = new SQL.Database(buf);

  for (const s of summaries) {
    const existing = db.exec(
      'SELECT label FROM current_code_graph_communities WHERE repo_name = ? AND community_id = ?',
      [repoName, s.communityId]
    );
    const existingLabel = existing[0]?.values?.[0]?.[0] ?? '';
    db.run(
      `INSERT OR REPLACE INTO current_code_graph_communities
         (repo_name, community_id, label, name, summary, generated_at, updated_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [repoName, s.communityId, existingLabel, s.name, s.summary]
    );
  }

  const data = db.export();
  fs.writeFileSync(trailDbPath, Buffer.from(data));
}
```


### Step 3: コミュニティ別 C4 要素 role 判定

Step 2 で命名済みのコミュニティを「フィーチャー」とみなし、各コミュニティに属する C4 component / code 要素の役割を AI で判定して同テーブルに保存する。

**処理フロー**

1. **DB から命名済みコミュニティを取得**: `current_code_graph_communities WHERE repo_name = ? AND name IS NOT NULL` で `community_id` / `name` を取得する。
2. **グラフノードをコミュニティ別に集約**: `current_code_graphs.graph_json` の `nodes` を参照し、各ノードの `community` / `package` / `id` から C4 component を導出する。

   ノード ID → C4 component への変換ルール:

   ```
   ノード id 例: "trail-core/src/coverage/aggregateCoverage"
   → package: "trail-core"
   → src 以降の第 1 ディレクトリ: "coverage"
   → C4 component: "pkg_trail-core/coverage"
   ```

   `src/` を含まない場合はコンテナレベル `pkg_{package}` にフォールバックする。

3. **バッチ作成**: コミュニティを **5 件ずつ** に分割し、各バッチを 1 サブエージェントへ渡す（`free -h` で 2〜3 並列）。
4. **サブエージェント実行**: `model: haiku` で role を判定する。
5. **DB 書き込み**: `mappings_json` カラムを `current_code_graph_communities` に追加（未存在時）し、各コミュニティ行を UPDATE する。

**role 判定基準**

| role | 基準 |
| --- | --- |
| `primary` | コア処理・アルゴリズム・UI コンポーネントを含む（主要実装） |
| `secondary` | 設定・ユーティリティ・型定義など補助的サポート |
| `dependency` | このコミュニティの機能を呼び出す側（ホスト・統合レイヤー・ラッパー） |

**サブエージェントへのプロンプト**

```text
以下のコミュニティ（フィーチャー）ごとに、各 C4 コンポーネントの role を JSON で返してください。

role 判定基準:
- primary: コア処理・アルゴリズム・UI コンポーネントを含む主要実装
- secondary: 設定・ユーティリティ・型定義など補助的サポート
- dependency: このコミュニティの機能を呼び出す側（ホスト・統合レイヤー）

注意:
- 判定はコンポーネント名・ノードラベル・パッケージ名からのみ行う
- 1 コミュニティにつき primary は 1〜2 個を目安とする
- 除外: ノードラベルが packages / testUtils / __mocks__ / exports のコンポーネント

入力:
[
  {
    "communityId": 5,
    "communityName": "カバレッジ計算",
    "components": [
      { "elementId": "pkg_trail-core/coverage", "nodes": ["aggregateCoverage", "computeCoverageDiff"] },
      { "elementId": "pkg_trail-viewer/hooks", "nodes": ["useCoverage", "useCoverageDiff"] }
    ]
  },
  ...
]

出力（JSON のみ、説明文不要）:
{"mappings":[
  {"communityId":5,"elementId":"pkg_trail-core/coverage","elementType":"component","role":"primary"},
  {"communityId":5,"elementId":"pkg_trail-viewer/hooks","elementType":"component","role":"dependency"}
]}
```

**DB 書き込みスクリプト（Node.js）**

```javascript
// mappings: Array<{ communityId: number, elementId: string, elementType: string, role: string }>

const sqlJs = require('sql.js');
const fs = require('fs');

async function writeMappingsToDb(trailDbPath, repoName, mappings) {
  const SQL = await sqlJs();
  const buf = fs.readFileSync(trailDbPath);
  const db = new SQL.Database(buf);

  // mappings_json カラムを追加（初回のみ）
  const cols = db.exec("PRAGMA table_info(current_code_graph_communities)")[0]?.values ?? [];
  if (!cols.some(c => c[1] === 'mappings_json')) {
    db.run("ALTER TABLE current_code_graph_communities ADD COLUMN mappings_json TEXT");
  }

  // communityId ごとにグループ化して JSON 配列として保存
  const byId = new Map();
  for (const m of mappings) {
    if (!byId.has(m.communityId)) byId.set(m.communityId, []);
    byId.get(m.communityId).push({ elementId: m.elementId, elementType: m.elementType, role: m.role });
  }

  for (const [communityId, entries] of byId) {
    db.run(
      `UPDATE current_code_graph_communities
         SET mappings_json = ?, updated_at = datetime('now')
       WHERE repo_name = ? AND community_id = ?`,
      [JSON.stringify(entries), repoName, communityId]
    );
  }

  const data = db.export();
  fs.writeFileSync(trailDbPath, Buffer.from(data));
}
```

> [!NOTE]
> Step 2 の DB 書き込み後に実行すること（`name` が確定してから role 判定を行うため）。\
> 除外コンポーネント（`packages` / `testUtils` / `__mocks__` / `exports`）はノード集約時にフィルタする。\
> `sql.js` は対象ワークスペースの `node_modules/sql.js` から require する（例: `/anytime-markdown/node_modules/sql.js`）。`require('sql.js')` で解決できない場合は絶対パス指定する。


## 完了報告

実行後に以下をユーザーへ報告する。

- 要約生成したコミュニティ数（Step 2）
- role 判定したコミュニティ数 / mapping 件数（Step 3）
- スキップしたコミュニティ数の内訳（ノード数 3 未満 / キャッシュ命中）


## 出力先

| 保存先 | 内容 |
| --- | --- |
| `trail.db` の `current_code_graph_communities.name` / `summary` | コミュニティ名と要約（Step 2） |
| `trail.db` の `current_code_graph_communities.mappings_json` | C4 要素 role マッピング（Step 3） |
| `${workspaceFolder}/.vscode/.community_summary_cache.json` | コミュニティ要約のキャッシュ（再実行時の高速化用） |
