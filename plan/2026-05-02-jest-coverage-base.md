---
title: Jest coverage 共通設定（jest.config.base.js）
date: 2026-05-02
status: pending
---

## 目的

現在 `coverageReporters` が各パッケージの `jest.config.*` に個別定義されており、
新規パッケージ作成のたびに手動追加が必要。
ルートに `jest.config.base.js` を置き、全パッケージがスプレッドで継承することで共通化する。

## 委任ルール

実装タスクは Codex（`codex:codex-rescue` subagent）に委任する。\
詳細は `~/.claude/rules/codex-delegation.md` に従う。

### 委任しない作業

- ブランチ作成・worktree 操作 → Claude が実施
- コミット（3 点確認込み）・push・PR 作成 → Claude が実施

## 変更方針

### jest.config.base.js（新規）

```js
/** @type {import('jest').Config} */
module.exports = {
  coverageReporters: ["json", "text", "lcov", "clover", "json-summary"],
  collectCoverage: true,
};
```

### 各パッケージの jest.config.js 修正パターン

- `...base` スプレッドを追加
- 既存の `coverageReporters` 行を削除（base に移動済みのため重複排除）
- パッケージ固有の設定（`testEnvironment`, `preset`, `transform`, `testMatch` 等）は維持

### TypeScript 設定ファイル（mcp-cms-remote/jest.config.ts）

```ts
import type { Config } from 'jest';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const base = require('../../jest.config.base') as Config;
const config: Config = { ...base, ... };
export default config;
```

## タスク

### タスク 1: jest.config.base.js 作成と全パッケージ設定更新

- **対象ファイル**:
    - `/anytime-markdown/jest.config.base.js`（新規）
    - `/anytime-markdown/packages/cms-core/jest.config.js`
    - `/anytime-markdown/packages/graph-core/jest.config.js`
    - `/anytime-markdown/packages/markdown-core/jest.config.js`
    - `/anytime-markdown/packages/mcp-cms-remote/jest.config.ts`
    - `/anytime-markdown/packages/mcp-cms/jest.config.js`
    - `/anytime-markdown/packages/mcp-graph/jest.config.js`
    - `/anytime-markdown/packages/mcp-markdown/jest.config.js`
    - `/anytime-markdown/packages/spreadsheet-core/jest.config.js`
    - `/anytime-markdown/packages/spreadsheet-viewer/jest.config.js`
    - `/anytime-markdown/packages/trail-core/jest.config.js`
    - `/anytime-markdown/packages/trail-viewer/jest.config.js`
    - `/anytime-markdown/packages/vscode-history-extension/jest.config.js`
    - `/anytime-markdown/packages/vscode-trail-extension/jest.config.js`
    - `/anytime-markdown/packages/web-app/jest.config.js`

- **変更禁止**: 上記以外のファイル（`package.json`, `tsconfig.json` 等）は変更しない

- **完了条件**:
    1. `/anytime-markdown/jest.config.base.js` が `coverageReporters` と `collectCoverage: true` を持つ
    2. 全 14 パッケージの `jest.config.*` が `...base` スプレッドを含む
    3. `coverageReporters` の重複定義がない（base 側のみに存在）
    4. 各パッケージ固有の設定（`testEnvironment`, `preset`, `transform`, `moduleNameMapper` 等）が維持されている
    5. `npx jest --config packages/trail-core/jest.config.js --maxWorkers=1` が通る

- **検証**: `npx jest --config packages/trail-core/jest.config.js --maxWorkers=1`

- **委任プロンプト**:

**前提**:
- `/anytime-markdown` はモノレポ。各パッケージが独立した `jest.config.*` を持つ
- 現在 `coverageReporters: ["json", "text", "lcov", "clover", "json-summary"]` が各パッケージに個別定義されている
- `collectCoverage` は設定されておらず、`npm test` だけでは coverage が出力されないパッケージがある

**方針**:
1. `/anytime-markdown/jest.config.base.js` を新規作成:

```js
/** @type {import('jest').Config} */
module.exports = {
  coverageReporters: ["json", "text", "lcov", "clover", "json-summary"],
  collectCoverage: true,
};
```

2. 各パッケージの `jest.config.*` を以下のパターンで修正する:

**CJS パッケージ（`jest.config.js`）の例（cms-core）:**

```js
const base = require('../../jest.config.base');
/** @type {import('jest').Config} */
module.exports = {
  ...base,
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
};
```

**TypeScript パッケージ（`jest.config.ts`）の例（mcp-cms-remote）:**

```ts
import type { Config } from 'jest';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const base = require('../../jest.config.base') as Config;
const config: Config = {
  ...base,
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  moduleNameMapper: {
    '^@anytime-markdown/cms-core$': '<rootDir>/../cms-core/src/index.ts',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
export default config;
```

3. 各パッケージの既存設定を **そのまま維持** しつつ `...base` を先頭に追加し、`coverageReporters` の重複行だけ削除する。`testEnvironment`, `preset`, `transform`, `testMatch`, `moduleNameMapper`, `setupFiles`, `maxWorkers`, `collectCoverageFrom` 等のパッケージ固有設定は変更しない

4. 変更対象の 14 パッケージの現在の設定は以下の通り（参考）:

```
cms-core:             preset:ts-jest, env:node, roots:src, testMatch:**/__tests__/**/*.test.ts
graph-core:           preset:ts-jest, env:node, roots:src, testMatch:**/__tests__/**/*.test.ts
markdown-core:        env:jsdom, setupFiles, transform, testMatch, moduleNameMapper, maxWorkers:2, collectCoverageFrom
mcp-cms-remote:       TypeScript config, preset:ts-jest, env:node, roots:src, moduleNameMapper
mcp-cms:              preset:ts-jest, env:node, roots:src, testMatch:**/__tests__/**/*.test.ts
mcp-graph:            preset:ts-jest, env:node, roots:src, testMatch:**/__tests__/**/*.test.ts
mcp-markdown:         preset:ts-jest, env:node, roots:src, testMatch:**/__tests__/**/*.test.ts
spreadsheet-core:     preset:ts-jest, env:node, roots:src, testMatch:**/__tests__/**/*.test.ts (coverageReporters既存)
spreadsheet-viewer:   env:jsdom, transform, testMatch, moduleNameMapper, maxWorkers:1 (coverageReporters未設定)
trail-core:           preset:ts-jest, env:node, roots:src, testMatch:**/__tests__/**/*.test.ts
trail-viewer:         env:node, transform, testMatch, maxWorkers:1 (coverageReporters未設定)
vscode-history-extension: preset:ts-jest, env:node, roots:src, testMatch, moduleNameMapper, maxWorkers:1, transform (coverageReporters未設定)
vscode-trail-extension:   preset:ts-jest, env:node, roots:src, testMatch, moduleNameMapper, maxWorkers:1, setupFiles, transform (coverageReporters未設定)
web-app:              env:jsdom, transform, testMatch, moduleNameMapper, maxWorkers:2, collectCoverageFrom
```

**TDD**: 設定ファイルのみの変更のためユニットテスト不要。既存テストが通ることで検証する

**検証**: `npx jest --config packages/trail-core/jest.config.js --maxWorkers=1` を実行し、全テスト通過を確認する

**NG リスト**:
- `package.json` の変更禁止
- `tsconfig.json` の変更禁止
- `collectCoverageFrom` は `markdown-core` と `web-app` の既存設定を維持（削除しない）
- `setupFiles` は `markdown-core` と `vscode-trail-extension` の既存設定を維持（削除しない）
- `vscode-trail-extension` の `jest.setup.ts` 参照を削除しない
- コミット・push を行わない
