# Matrix Tab Implementation Plan

**Status: 完了 (2026-05-01)**

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** DSM / F-cMap / Cov / Heatmap を C4ViewerCore の分割パネルから独立させ、TrailViewerCore に新規 "Matrix" タブとして追加する。

**Architecture:**
- `MatrixPanel.tsx` を新規作成し、DSM/F-cMap/Cov/Heatmap の表示ロジックを完全に移植する。
- `TrailViewerCore.tsx` に Matrix タブ (index 5) を追加し、c4 prop がある場合のみ表示する（Graph タブは index 6 に繰り下がる）。
- `C4ViewerCore.tsx` から分割パネル UI を除去するが、Overlay 用の `filteredDsmMatrix` / `dsmLevel` は残す。

**Tech Stack:** React 19, MUI v7, TypeScript, trail-viewer ワークスペース

---

## 前提確認

| ファイル | 行数 | 備考 |
| --- | --- | --- |
| `packages/trail-viewer/src/c4/components/C4ViewerCore.tsx` | 2054 | 主要変更対象 |
| `packages/trail-viewer/src/components/TrailViewerCore.tsx` | 441 | タブ追加 |
| `packages/trail-viewer/src/c4/components/MatrixPanel.tsx` | 新規 | 新規作成 |
| `packages/trail-viewer/src/i18n/types.ts` / `en.ts` / `ja.ts` | 各 1行 | `viewer.matrix` キー追加 |

**検証コマンド:** `npx tsc --noEmit -p packages/trail-viewer/tsconfig.json`

---

## タスク 1: i18n キー追加

**Files:**
- Modify: `packages/trail-viewer/src/i18n/types.ts`
- Modify: `packages/trail-viewer/src/i18n/en.ts`
- Modify: `packages/trail-viewer/src/i18n/ja.ts`

**Step 1: types.ts に追加**

`'viewer.c4': string;` の直後に追記:

```typescript
'viewer.matrix': string;
```

**Step 2: en.ts に追加**

`'viewer.c4': 'C4 Model',` の直後に追記:

```typescript
'viewer.matrix': 'Matrix',
```

**Step 3: ja.ts に追加**

`'viewer.c4': 'モデル',` の直後に追記:

```typescript
'viewer.matrix': 'Matrix',
```

**Step 4: 型チェック**

```bash
npx tsc --noEmit -p packages/trail-viewer/tsconfig.json
```

Expected: エラーなし

**Step 5: Commit**

```bash
git add packages/trail-viewer/src/i18n/types.ts packages/trail-viewer/src/i18n/en.ts packages/trail-viewer/src/i18n/ja.ts
git commit -m "feat(trail-viewer/i18n): add viewer.matrix key"
```

---

## タスク 2: MatrixPanel.tsx 新規作成

**Files:**
- Create: `packages/trail-viewer/src/c4/components/MatrixPanel.tsx`

**Step 1: ファイルを作成**

```tsx
import type { C4Model, CoverageDiffMatrix, CoverageMatrix, DsmMatrix, FeatureMatrix, HeatmapMatrix } from '@anytime-markdown/trail-core/c4';
import { aggregateDsmToC4ComponentLevel, aggregateDsmToC4ContainerLevel, sortDsmMatrixByName } from '@anytime-markdown/trail-core/c4';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';
import Typography from '@mui/material/Typography';
import { useMemo, useState } from 'react';

import { useTrailI18n } from '../../i18n';
import { getC4Colors } from '../c4Theme';
import { useActivityHeatmap } from '../hooks/useActivityHeatmap';
import { CoverageCanvas } from './CoverageCanvas';
import { DsmCanvas } from './DsmCanvas';
import { FcMapCanvas } from './FcMapCanvas';
import { HeatmapCanvas } from './HeatmapCanvas';

export interface MatrixPanelProps {
  readonly dsmMatrix: DsmMatrix | null;
  readonly featureMatrix: FeatureMatrix | null;
  readonly coverageMatrix: CoverageMatrix | null;
  readonly coverageDiff: CoverageDiffMatrix | null;
  readonly c4Model: C4Model | null;
  readonly serverUrl?: string;
  readonly selectedRepo?: string;
  readonly isDark?: boolean;
}

export function MatrixPanel({
  dsmMatrix,
  featureMatrix,
  coverageMatrix,
  coverageDiff,
  c4Model,
  serverUrl,
  selectedRepo,
  isDark = false,
}: Readonly<MatrixPanelProps>) {
  const { t } = useTrailI18n();
  const colors = useMemo(() => getC4Colors(isDark), [isDark]);

  const [matrixView, setMatrixView] = useState<'dsm' | 'fcmap' | 'coverage' | 'heatmap'>('dsm');
  const [dsmLevel, setDsmLevel] = useState<'component' | 'package'>('component');
  const [dsmClustered, setDsmClustered] = useState(false);
  const [heatmapMode, setHeatmapMode] = useState<'session-file' | 'subagent-file'>('session-file');

  const heatmapEnabled = matrixView === 'heatmap';
  const { data: heatmapResponse } = useActivityHeatmap({
    enabled: heatmapEnabled,
    serverUrl,
    period: '30d',
    mode: heatmapMode,
    topK: 50,
    repoName: selectedRepo || undefined,
  });
  const heatmapMatrix = useMemo<HeatmapMatrix | null>(() => {
    if (!heatmapResponse) return null;
    return {
      rows: heatmapResponse.rows,
      columns: heatmapResponse.columns,
      cells: heatmapResponse.cells,
      maxValue: heatmapResponse.maxValue,
    };
  }, [heatmapResponse]);

  const filteredDsmMatrix = useMemo(() => {
    if (!dsmMatrix) return null;
    let m = dsmMatrix;
    if (c4Model) {
      m = dsmLevel === 'package'
        ? aggregateDsmToC4ContainerLevel(dsmMatrix, c4Model.elements)
        : aggregateDsmToC4ComponentLevel(dsmMatrix, c4Model.elements);
    }
    return sortDsmMatrixByName(m);
  }, [dsmMatrix, dsmLevel, c4Model]);

  const toolbarButtonSx = {
    textTransform: 'none' as const,
    color: colors.accent,
    borderColor: colors.border,
    fontSize: '0.75rem',
    '&:hover': { bgcolor: colors.hover },
    '&:focus-visible': { outline: `2px solid ${colors.accent}`, outlineOffset: '2px' },
    '&:disabled': { color: colors.textMuted },
  };
  const toolbarButtonActiveBg = colors.focus;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: colors.bg }}>
      {/* Toolbar */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1, py: 0.5, borderBottom: `1px solid ${colors.border}`, flexShrink: 0, flexWrap: 'wrap' }}>
        <ButtonGroup size="small">
          {(['dsm', 'fcmap', 'coverage', 'heatmap'] as const).map((view) => {
            const label = view === 'dsm' ? 'DSM' : view === 'fcmap' ? 'F-cMap' : view === 'coverage' ? 'Cov' : t('c4.viewToggle.heatmap');
            const isDisabled = (view === 'fcmap' && !featureMatrix) || (view === 'coverage' && !coverageMatrix);
            return (
              <Button
                key={view}
                size="small"
                disabled={isDisabled}
                aria-pressed={matrixView === view}
                aria-label={`Show ${label} matrix`}
                onClick={() => setMatrixView(view)}
                sx={{ ...toolbarButtonSx, ...(matrixView === view && { bgcolor: toolbarButtonActiveBg }) }}
              >
                {label}
              </Button>
            );
          })}
        </ButtonGroup>

        {matrixView === 'dsm' && (
          <>
            <ButtonGroup size="small">
              {(['component', 'package'] as const).map((level) => (
                <Button
                  key={level}
                  size="small"
                  aria-pressed={dsmLevel === level}
                  onClick={() => setDsmLevel(level)}
                  sx={{ ...toolbarButtonSx, ...(dsmLevel === level && { bgcolor: toolbarButtonActiveBg }) }}
                >
                  {level === 'component' ? 'Component' : 'Package'}
                </Button>
              ))}
            </ButtonGroup>
            <Button
              size="small"
              onClick={() => setDsmClustered(prev => !prev)}
              sx={{ ...toolbarButtonSx, ...(dsmClustered && { bgcolor: toolbarButtonActiveBg }) }}
            >
              Cluster
            </Button>
          </>
        )}

        {matrixView === 'heatmap' && (
          <ButtonGroup size="small" aria-label="Heatmap mode">
            {(['session-file', 'subagent-file'] as const).map((m) => {
              const label = m === 'session-file' ? t('c4.heatmap.modeSessionFile') : t('c4.heatmap.modeSubagentFile');
              return (
                <Button
                  key={m}
                  size="small"
                  aria-pressed={heatmapMode === m}
                  onClick={() => setHeatmapMode(m)}
                  sx={{ ...toolbarButtonSx, ...(heatmapMode === m && { bgcolor: toolbarButtonActiveBg }) }}
                >
                  {label}
                </Button>
              );
            })}
          </ButtonGroup>
        )}
      </Box>

      {/* Canvas */}
      <Box sx={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {matrixView === 'heatmap' ? (
          heatmapMatrix && heatmapMatrix.rows.length > 0 && heatmapMatrix.columns.length > 0 ? (
            <HeatmapCanvas
              matrix={heatmapMatrix}
              colorScale={isDark ? 'amber' : 'sumi'}
              isDark={isDark}
            />
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <Typography variant="body2" sx={{ color: colors.textSecondary }}>
                {heatmapEnabled ? t('c4.heatmap.empty') : t('c4.heatmap.loading')}
              </Typography>
            </Box>
          )
        ) : matrixView === 'coverage' && coverageMatrix && c4Model ? (
          <CoverageCanvas
            coverageMatrix={coverageMatrix}
            coverageDiff={coverageDiff}
            model={c4Model}
            isDark={isDark}
          />
        ) : matrixView === 'fcmap' && featureMatrix && c4Model ? (
          <FcMapCanvas
            featureMatrix={featureMatrix}
            model={c4Model}
            isDark={isDark}
          />
        ) : filteredDsmMatrix ? (
          <DsmCanvas
            matrix={filteredDsmMatrix}
            fullModel={c4Model ?? undefined}
            clustered={dsmClustered}
            isDark={isDark}
          />
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <Typography variant="body2" sx={{ color: colors.textSecondary }}>
              Import a C4 model to view DSM
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}
```

**Step 2: 型チェック**

```bash
npx tsc --noEmit -p packages/trail-viewer/tsconfig.json
```

Expected: エラーなし

**Step 3: Commit**

```bash
git add packages/trail-viewer/src/c4/components/MatrixPanel.tsx
git commit -m "feat(trail-viewer/c4): add MatrixPanel component with DSM/F-cMap/Cov/Heatmap"
```

---

## タスク 3: TrailViewerCore に Matrix タブを追加

**Files:**
- Modify: `packages/trail-viewer/src/components/TrailViewerCore.tsx`

**Step 1: MatrixPanel を import**

既存の C4ViewerCore import の近くに追加:

```typescript
import { MatrixPanel } from '../c4/components/MatrixPanel';
```

**Step 2: Tab を追加**

既存の `{c4 && <Tab id="trail-tab-4" .../>}` の直後に追加:

```tsx
{c4 && <Tab id="trail-tab-5" aria-controls="trail-panel-5" label={t('viewer.matrix')} />}
```

Graph タブの ID も更新（`trail-tab-5` → `trail-tab-6`、`trail-panel-5` → `trail-panel-6`）:

```tsx
{codeGraph && <Tab id="trail-tab-6" aria-controls="trail-panel-6" label="Graph" />}
```

**Step 3: Matrix タブパネルを追加**

C4 tabpanel (`activeTab !== 4`) の直後に追加:

```tsx
{c4 && (
  <Box
    role="tabpanel"
    id="trail-panel-5"
    aria-labelledby="trail-tab-5"
    sx={{ display: activeTab !== 5 ? 'none' : 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}
  >
    <MatrixPanel
      dsmMatrix={c4.dsmMatrix}
      featureMatrix={c4.featureMatrix}
      coverageMatrix={c4.coverageMatrix}
      coverageDiff={c4.coverageDiff}
      c4Model={c4.c4Model}
      serverUrl={c4.serverUrl}
      selectedRepo={c4.selectedRepo}
      isDark={isDark}
    />
  </Box>
)}
```

**Step 4: Graph タブパネルの index を更新**

```tsx
// Before
sx={{ display: activeTab !== 5 ? 'none' : 'flex', ... }}
// After
sx={{ display: activeTab !== 6 ? 'none' : 'flex', ... }}
```

また、Graph タブパネルの ID も更新:
- `id="trail-panel-5"` → `id="trail-panel-6"`
- `aria-labelledby="trail-tab-5"` → `aria-labelledby="trail-tab-6"`

**Step 5: 型チェック**

```bash
npx tsc --noEmit -p packages/trail-viewer/tsconfig.json
```

Expected: エラーなし

**Step 6: Commit**

```bash
git add packages/trail-viewer/src/components/TrailViewerCore.tsx
git commit -m "feat(trail-viewer/ui): add Matrix tab with DSM/F-cMap/Cov/Heatmap"
```

---

## タスク 4: C4ViewerCore から分割パネル UI を除去

**Files:**
- Modify: `packages/trail-viewer/src/c4/components/C4ViewerCore.tsx`

### 変更スコープ

**残す（Overlay 機能で必要）:**
- `dsmLevel` state（handleLevelChange で自動設定、filteredDsmMatrix に使用）
- `filteredDsmMatrix` memoized 計算（Overlay colorMap と selectedElementInfo に使用）
- `filterDsmMatrix`, `aggregateDsm*`, `sortDsmMatrixByName` imports

**削除するもの:**
- `showDsm` / `showC4` state と setter
- `matrixView` state
- `dsmClustered` state
- `heatmapMode` state
- `heatmapEnabled` / `heatmapResponse` / `heatmapMatrix`（`useActivityHeatmap` 呼び出し）
- `splitRatio` state と `handleSplitDrag` callback
- Toolbar の C4 ボタン・DSM/FcMap/Cov/Heatmap ButtonGroup・Cluster ボタン・Heatmap mode ButtonGroup
- Drag separator（`role="separator"` の Box）
- `{showDsm && (...)` のマトリクスキャンバスセクション全体
- `CoverageCanvas`, `DsmCanvas`, `FcMapCanvas`, `HeatmapCanvas` import
- `useActivityHeatmap` import
- `HeatmapMatrix` type import（trail-core から）

**変更する既存コード:**

1. `{showC4 && (<Box sx={{ flex: showDsm ? splitRatio : 1, ... }}>`
   → `<Box sx={{ flex: showFlow ? splitRatio : 1, ... }}>` （showC4 条件なし、always render）

2. `{showC4 && showDsm && (<Box role="separator" aria-label="Resize C4 graph and DSM matrix" ...)}`
   → `{showFlow && (<Box role="separator" aria-label="Resize C4 graph and flow" ...)}`

3. Flow Box の flex: `flex: showC4 ? 1 - splitRatio : 1`
   → `flex: 1 - splitRatio` （showC4 は常に true なので定数化）

4. コメント `{/* 既存コンテンツ (C4Graph / Separator / DSM) */}`
   → `{/* C4 Graph */}`

**Step 1: import から削除するもの**

```typescript
// 削除
import { useActivityHeatmap } from '../hooks/useActivityHeatmap';
import { CoverageCanvas } from './CoverageCanvas';
import { DsmCanvas } from './DsmCanvas';
import { FcMapCanvas } from './FcMapCanvas';
import { HeatmapCanvas } from './HeatmapCanvas';
```

trail-core の import から `HeatmapMatrix` を削除（他の型は残す）。

**Step 2: state 削除（行 265-336 周辺）**

削除する state 宣言:
```typescript
const [showC4, setShowC4] = useState(true);          // 削除
const [showDsm, setShowDsm] = useState(false);       // 削除
const [matrixView, setMatrixView] = useState(...);   // 削除
const [heatmapMode, setHeatmapMode] = useState(...); // 削除
const [dsmClustered, setDsmClustered] = useState(false); // 削除
const [splitRatio, setSplitRatio] = useState(0.5);   // 削除
```

残す:
```typescript
const [dsmLevel, setDsmLevel] = useState<'component' | 'package'>('component'); // 残す（Overlay用）
```

**Step 3: useActivityHeatmap 呼び出しを削除**

行 285-302 の `heatmapEnabled` / `heatmapResponse` / `heatmapMatrix` ブロックを削除。

**Step 4: handleSplitDrag を削除**

行 967-990 の `handleSplitDrag` callback を削除。

**Step 5: ツールバーを整理（行 1073-1125 周辺）**

削除:
- 行 1073: C4 Button（`aria-label="Toggle C4 graph"`）
- 行 1074-1102: DSM/FcMap/Cov/Heatmap ButtonGroup
- 行 1103-1105: Cluster Button の条件付きレンダリング
- 行 1107-1125: Heatmap mode ButtonGroup の条件付きレンダリング

**Step 6: レイアウト変更（行 1258-2014 周辺）**

1. C4 Graph Box の条件と flex を更新:
   ```tsx
   // Before
   {showC4 && (
     <Box sx={{ flex: showDsm ? splitRatio : 1, ... }}>
   // After
   <Box sx={{ flex: showFlow ? splitRatio : 1, ... }}>
   ```

2. Separator を更新:
   ```tsx
   // Before
   {showC4 && showDsm && (
     <Box role="separator" aria-label="Resize C4 graph and DSM matrix" .../>
   )}
   // After
   {showFlow && (
     <Box role="separator" aria-label="Resize C4 graph and flow" .../>
   )}
   ```

3. Flow Box の flex 更新:
   ```tsx
   // Before
   <Box sx={{ flex: showC4 ? 1 - splitRatio : 1, ... }}>
   // After
   <Box sx={{ flex: 1 - splitRatio, ... }}>
   ```

4. DSM マトリクスセクションを削除（行 1972-2014）:
   ```tsx
   // 削除
   {showDsm && (
     <Box sx={{ flex: showC4 ? 1 - splitRatio : 1, ... }}>
       ...HeatmapCanvas / CoverageCanvas / FcMapCanvas / DsmCanvas...
     </Box>
   )}
   ```

**Step 7: 型チェック**

```bash
npx tsc --noEmit -p packages/trail-viewer/tsconfig.json
```

Expected: エラーなし

**Step 8: git diff で変更スコープ確認**

```bash
git diff --stat HEAD
```

変更対象: `C4ViewerCore.tsx` のみ（意図外ファイルがないか確認）

**Step 9: Commit**

```bash
git add packages/trail-viewer/src/c4/components/C4ViewerCore.tsx
git commit -m "refactor(trail-viewer/c4): remove matrix split panel from C4ViewerCore"
```

---

## 最終確認

```bash
npx tsc --noEmit -p packages/trail-viewer/tsconfig.json
git diff --stat develop
```

変更ファイル一覧:
- `packages/trail-viewer/src/i18n/types.ts`
- `packages/trail-viewer/src/i18n/en.ts`
- `packages/trail-viewer/src/i18n/ja.ts`
- `packages/trail-viewer/src/c4/components/MatrixPanel.tsx`（新規）
- `packages/trail-viewer/src/components/TrailViewerCore.tsx`
- `packages/trail-viewer/src/c4/components/C4ViewerCore.tsx`
