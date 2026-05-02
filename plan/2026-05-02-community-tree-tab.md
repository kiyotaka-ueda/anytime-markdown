# Community Tree Tab Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 要素パネルに「Layer（既存）」と「Community（新規）」のタブを追加し、Community タブでは C3 コミュニティを起点に Container → Component → Code の階層ツリーを表示する。

**Architecture:** `trail-core` に `buildCommunityTree` ユーティリティを追加し、`C4ElementTree` にタブ UI を追加する。コミュニティノードは合成ノード（type='community'）として `C4TreeNode` の型を拡張する。Community タブは `showCommunity && currentLevel === 3` のときのみ利用可能。

**Tech Stack:** React, MUI (Tabs, Tab), TypeScript, trail-core, trail-viewer

---

## 作業ブランチ

```bash
git -C /anytime-markdown checkout -b feature/community-tree-tab develop
```

---

## Task 1: C4TreeNode 型に 'community' を追加

**Files:**
- Modify: `packages/trail-core/src/c4/types.ts`

**Step 1: 型を拡張する**

`C4TreeNode.type` の union に `'community'` を追加し、コミュニティノード用のオプショナルフィールドを追加する。

```typescript
export interface C4TreeNode {
  readonly id: string;
  readonly name: string;
  readonly type: C4ElementType | 'boundary' | 'community';
  readonly external?: boolean;
  readonly technology?: string;
  readonly description?: string;
  readonly deleted?: boolean;
  readonly serviceType?: string;
  readonly communityId?: number;   // type === 'community' のとき設定
  readonly nodeCount?: number;     // type === 'community' のとき: 属するノード数
  readonly children: readonly C4TreeNode[];
}
```

**Step 2: 型チェック**

```bash
npx tsc --noEmit -p packages/trail-core/tsconfig.json 2>&1 | head -20
```

Expected: エラーなし（または 'community' 型の switch 漏れのみ）

**Step 3: コミット**

```bash
git add packages/trail-core/src/c4/types.ts
git commit -m "feat(trail-core/c4): add 'community' type to C4TreeNode"
```

---

## Task 2: buildCommunityTree を trail-core に作成

**Files:**
- Create: `packages/trail-core/src/c4/view/buildCommunityTree.ts`
- Modify: `packages/trail-core/src/c4/index.ts`

**Step 1: buildCommunityTree.ts を作成する**

```typescript
import type { C4Model, C4TreeNode } from '../types';
import type { CodeGraph, CommunitySummary } from '../../codeGraph';
import type { CommunityOverlayEntry } from '../computeCommunityOverlay';

export interface CommunityTreeInput {
  readonly c4Model: C4Model;
  readonly communityOverlay: ReadonlyMap<string, CommunityOverlayEntry>;
  readonly communities: Record<number, string>;
  readonly communitySummaries?: Record<number, CommunitySummary>;
}

export function buildCommunityTree(input: CommunityTreeInput): C4TreeNode[] {
  const { c4Model, communityOverlay, communities, communitySummaries } = input;
  const elements = c4Model.elements;

  // elementId → element のマップ
  const elementById = new Map(elements.map(el => [el.id, el]));

  // コミュニティ番号 → そのコミュニティが dominant な component 要素IDのリスト
  const componentsByCommunity = new Map<number, string[]>();
  for (const [elementId, entry] of communityOverlay) {
    const cid = entry.dominantCommunity;
    const list = componentsByCommunity.get(cid);
    if (list) {
      list.push(elementId);
    } else {
      componentsByCommunity.set(cid, [elementId]);
    }
  }

  if (componentsByCommunity.size === 0) return [];

  // コミュニティ番号昇順でソート
  const sortedCommunityIds = [...componentsByCommunity.keys()].sort((a, b) => a - b);

  const result: C4TreeNode[] = [];

  for (const cid of sortedCommunityIds) {
    const componentIds = componentsByCommunity.get(cid)!;
    const summary = communitySummaries?.[cid];
    const label = communities[cid];
    const communityName = summary?.name ?? label ?? `#${cid}`;

    // container → component[] のグルーピング
    const componentsByContainer = new Map<string | undefined, string[]>();
    for (const compId of componentIds) {
      const el = elementById.get(compId);
      const parentId = el?.boundaryId;
      const list = componentsByContainer.get(parentId);
      if (list) {
        list.push(compId);
      } else {
        componentsByContainer.set(parentId, [compId]);
      }
    }

    // container ノードを構築
    const containerNodes: C4TreeNode[] = [];
    for (const [containerId, compIds] of componentsByContainer) {
      const containerEl = containerId ? elementById.get(containerId) : undefined;

      // component ノード（+ その配下の code 要素）
      const componentNodes: C4TreeNode[] = compIds
        .map(compId => {
          const compEl = elementById.get(compId);
          if (!compEl) return null;
          // code 要素（直接の子のみ）
          const codeChildren: C4TreeNode[] = elements
            .filter(el => el.boundaryId === compId && el.type === 'code')
            .sort((a, b) => a.name.localeCompare(b.name))
            .map(el => ({
              id: el.id,
              name: el.name,
              type: el.type,
              children: [],
            }));
          return {
            id: compEl.id,
            name: compEl.name,
            type: compEl.type,
            ...(compEl.description ? { description: compEl.description } : {}),
            children: codeChildren,
          } satisfies C4TreeNode;
        })
        .filter((n): n is C4TreeNode => n !== null)
        .sort((a, b) => a.name.localeCompare(b.name));

      if (containerEl) {
        containerNodes.push({
          id: containerEl.id,
          name: containerEl.name,
          type: containerEl.type,
          ...(containerEl.technology ? { technology: containerEl.technology } : {}),
          ...(containerEl.serviceType ? { serviceType: containerEl.serviceType } : {}),
          children: componentNodes,
        });
      } else {
        // container なし（直接ルートに component を並べる）
        containerNodes.push(...componentNodes);
      }
    }

    containerNodes.sort((a, b) => a.name.localeCompare(b.name));

    // コミュニティノードの nodeCount = 全 component 数
    const nodeCount = componentIds.length;

    result.push({
      id: `community:${cid}`,
      name: communityName,
      type: 'community',
      communityId: cid,
      nodeCount,
      ...(summary?.summary ? { description: summary.summary } : {}),
      children: containerNodes,
    });
  }

  return result;
}
```

**Step 2: index.ts にエクスポートを追加する**

`packages/trail-core/src/c4/index.ts` に以下を追加:

```typescript
export { buildCommunityTree } from './view/buildCommunityTree';
export type { CommunityTreeInput } from './view/buildCommunityTree';
```

**Step 3: 型チェック**

```bash
npx tsc --noEmit -p packages/trail-core/tsconfig.json 2>&1 | head -20
```

Expected: エラーなし

**Step 4: コミット**

```bash
git add packages/trail-core/src/c4/view/buildCommunityTree.ts packages/trail-core/src/c4/index.ts
git commit -m "feat(trail-core/c4): add buildCommunityTree utility"
```

---

## Task 3: i18n キーを追加

**Files:**
- Modify: `packages/trail-viewer/src/i18n/ja.ts`
- Modify: `packages/trail-viewer/src/i18n/en.ts`

**Step 1: ja.ts に追加する**

`'c4.elementPanel.searchPlaceholder'` のエントリの近くに以下を追加:

```typescript
'c4.elementPanel.tabLayer': 'レイヤー',
'c4.elementPanel.tabCommunity': 'コミュニティ',
'c4.elementPanel.communityUnavailable': 'L3 でコミュニティ表示をONにすると利用可能',
```

**Step 2: en.ts に追加する**

```typescript
'c4.elementPanel.tabLayer': 'Layer',
'c4.elementPanel.tabCommunity': 'Community',
'c4.elementPanel.communityUnavailable': 'Enable Community at L3 to use this tab',
```

**Step 3: 型チェック**

```bash
npx tsc --noEmit -p packages/trail-viewer/tsconfig.json 2>&1 | head -20
```

Expected: エラーなし（TrailI18nKey 型が自動生成されている場合は更新を確認）

**Step 4: コミット**

```bash
git add packages/trail-viewer/src/i18n/ja.ts packages/trail-viewer/src/i18n/en.ts
git commit -m "feat(trail-viewer/i18n): add community tree tab keys"
```

---

## Task 4: C4ElementTree にタブ UI を追加

**Files:**
- Modify: `packages/trail-viewer/src/c4/components/C4ElementTree.tsx`

**Step 1: TypeIcon に 'community' ケースを追加する**

既存の `switch (type)` ブロックに追加:

```typescript
case 'community': return <HubIcon sx={sx} />;
```

import に `HubIcon` を追加（`@mui/icons-material/Hub`）。

**Step 2: C4ElementTreeProps に communityTree を追加する**

```typescript
export interface C4ElementTreeProps {
  // ...既存フィールド...
  readonly communityTree?: readonly C4TreeNode[];  // 追加
}
```

**Step 3: タブ状態を追加する**

`C4ElementTree` コンポーネント内に:

```typescript
const [activeTab, setActiveTab] = useState<0 | 1>(0);
const hasCommunityTree = (communityTree?.length ?? 0) > 0;
```

**Step 4: タブ UI を追加する**

検索ボックスの上（repoOptions セレクタの直下）にタブを追加:

```tsx
<Tabs
  value={activeTab}
  onChange={(_, v: number) => setActiveTab(v as 0 | 1)}
  variant="fullWidth"
  sx={{
    minHeight: 32,
    borderBottom: `1px solid ${colors.border}`,
    '& .MuiTab-root': { minHeight: 32, fontSize: '0.72rem', py: 0.5 },
  }}
>
  <Tab label={t('c4.elementPanel.tabLayer')} value={0} />
  <Tab label={t('c4.elementPanel.tabCommunity')} value={1} />
</Tabs>
```

**Step 5: Community タブのコンテンツを実装する**

`activeTab === 0` のとき既存の検索+ツリー、`activeTab === 1` のとき community ツリーを表示:

- `activeTab === 1` かつ `hasCommunityTree` のとき: communityTree をレンダリング
- `activeTab === 1` かつ `!hasCommunityTree` のとき: `t('c4.elementPanel.communityUnavailable')` を表示

Community タブでは:
- 検索ボックスを共有（同じ `searchText` state で communityTree もフィルタ）
- `TreeNodeItem` を使って communityTree をレンダリング
- チェックボックス操作・Add ボタンは非表示（communityTree 側にはチェック対象なし）

**Step 6: filterTreeBySearch を communityTree にも適用する**

```typescript
const filteredCommunityTree = useMemo(
  () => communityTree ? filterTreeBySearch(communityTree, searchText) : [],
  [communityTree, searchText],
);
```

**Step 7: Community ツリーの expanded 初期状態を設定する**

```typescript
const [communityExpanded, setCommunityExpanded] = useState<ReadonlySet<string>>(() => {
  const ids = new Set<string>();
  for (const n of communityTree ?? []) ids.add(n.id);
  return ids;
});
```

communityTree が変わったとき（selectedRepo 変更等）に初期化:

```typescript
useEffect(() => {
  const ids = new Set<string>();
  for (const n of communityTree ?? []) ids.add(n.id);
  setCommunityExpanded(ids);
}, [communityTree]);
```

**Step 8: 型チェック**

```bash
npx tsc --noEmit -p packages/trail-viewer/tsconfig.json 2>&1 | head -30
```

Expected: エラーなし

**Step 9: コミット**

```bash
git add packages/trail-viewer/src/c4/components/C4ElementTree.tsx
git commit -m "feat(trail-viewer/c4): add Layer/Community tab to element panel"
```

---

## Task 5: C4ViewerCore で communityTree を構築して渡す

**Files:**
- Modify: `packages/trail-viewer/src/c4/components/C4ViewerCore.tsx`

**Step 1: buildCommunityTree のインポートを追加する**

```typescript
import { buildCommunityTree } from '@anytime-markdown/trail-core/c4';
```

**Step 2: communityTree の useMemo を追加する**

`communityOverlay` の `useMemo` の直後に追加:

```typescript
const communityTree = useMemo(() => {
  if (!communityOverlay || !codeGraph || !c4Model || currentLevel !== 3) return undefined;
  return buildCommunityTree({
    c4Model,
    communityOverlay,
    communities: codeGraph.communities,
    communitySummaries: codeGraph.communitySummaries,
  });
}, [communityOverlay, codeGraph, c4Model, currentLevel]);
```

**Step 3: C4ElementTree に communityTree を渡す**

```tsx
<C4ElementTree
  {/* ...既存 props... */}
  communityTree={communityTree}
/>
```

**Step 4: 型チェック**

```bash
npx tsc --noEmit -p packages/trail-viewer/tsconfig.json 2>&1 | head -30
```

Expected: エラーなし

**Step 5: コミット**

```bash
git add packages/trail-viewer/src/c4/components/C4ViewerCore.tsx
git commit -m "feat(trail-viewer/c4): build and pass communityTree to element panel"
```

---

## Task 6: ビルド検証・動作確認

**Step 1: web-app をビルドして型エラーがないことを確認する**

```bash
cd /anytime-markdown && npm run build --workspace=packages/web-app 2>&1 | tail -20
```

Expected: エラーなし

**Step 2: 動作確認項目**

Trail Viewer を開き、L3 でコミュニティ表示を ON にした状態で:

- [ ] 要素パネルに「レイヤー」「コミュニティ」タブが表示される
- [ ] 「レイヤー」タブは従来と同じツリーを表示する
- [ ] 「コミュニティ」タブで Community → Container → Component → Code の階層が表示される
- [ ] Community ノードをクリックで展開/折りたたみができる
- [ ] Component ノードをクリックするとグラフ上の要素が選択される
- [ ] 検索ボックスが両タブで機能する
- [ ] L1/L2/L4 でコミュニティ表示 OFF 時は Community タブが非活性メッセージを表示する
- [ ] ダーク/ライト両モードで見た目が壊れない

**Step 3: 最終コミット（必要に応じて修正後）**

---

## 完了条件

- `npx tsc --noEmit -p packages/trail-viewer/tsconfig.json` がエラーなし
- `npm run build --workspace=packages/web-app` がエラーなし
- 要素パネルにタブが追加され、Community タブが正しく機能する
