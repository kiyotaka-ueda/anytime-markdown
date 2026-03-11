# EditorToolbar Props リファクタリング計画

> **Status:** COMPLETED (2026-03-11)

**Goal:** EditorToolbar(48 props) / EditorToolbarSection(57 props) の Props 過多を、オブジェクト集約で解消する

**Architecture:** 散在する個別 props を意味のあるグループ（visibility, fileOps, mode, merge）にオブジェクト化し、バケツリレーの可読性を改善する。EditorToolbarSection の中間変換ロジックはそのまま維持し、インターフェースのみ整理する。

**Tech Stack:** TypeScript, React, TipTap

---

## 影響ファイル一覧

| ファイル | 操作 |
|---|---|
| `packages/editor-core/src/types/toolbar.ts` | 新規作成（型定義） |
| `packages/editor-core/src/components/EditorToolbar.tsx` | 修正（interface → grouped props） |
| `packages/editor-core/src/components/EditorToolbarSection.tsx` | 修正（interface → grouped props） |
| `packages/editor-core/src/MarkdownEditorPage.tsx` | 修正（props 渡し方変更） |
| `packages/editor-core/src/__tests__/EditorToolbar.test.tsx` | 修正（createDefaultProps 更新） |
| `packages/editor-core/src/index.ts` | 修正（型 export 追加） |

---

## Phase 1: ToolbarVisibility — hide* props の集約

### Task 1: 型定義ファイルの作成

**Files:**
- Create: `packages/editor-core/src/types/toolbar.ts`

**Step 1: 型定義を作成**

```typescript
/** ツールバーの表示/非表示設定 */
export interface ToolbarVisibility {
  fileOps?: boolean;
  undoRedo?: boolean;
  moreMenu?: boolean;
  settings?: boolean;
  versionInfo?: boolean;
  modeToggle?: boolean;
  readonlyToggle?: boolean;
  outline?: boolean;
  comments?: boolean;
  templates?: boolean;
  foldAll?: boolean;
  toolbar?: boolean;   // EditorToolbarSection 専用
  help?: boolean;      // EditorToolbarSection 専用
}
```

**Step 2: ビルド確認**

Run: `cd packages/editor-core && npx tsc --noEmit 2>&1 | grep -v headingNumber`
Expected: エラーなし（新ファイルはまだ未参照）

**Step 3: コミット**

```
feat: ToolbarVisibility 型を追加
```

---

### Task 2: EditorToolbar に ToolbarVisibility を適用

**Files:**
- Modify: `packages/editor-core/src/components/EditorToolbar.tsx:83-131`

**Step 1: import 追加と interface 変更**

EditorToolbarProps から以下の個別 props を削除:
```
hideFileOps, hideUndoRedo, hideMoreMenu, hideSettings, hideVersionInfo,
hideModeToggle, hideReadonlyToggle, hideOutline, hideComments,
hideTemplates, hideFoldAll
```

代わりに追加:
```typescript
hide?: ToolbarVisibility;
```

**Step 2: コンポーネント内の参照を更新**

分割代入を変更:
```typescript
// Before
const { hideFileOps, hideUndoRedo, ... } = props;

// After
const { hide = {} } = props;
const { fileOps: hideFileOps, undoRedo: hideUndoRedo, ... } = hide;
```

コンポーネント本体での参照名は変えない（`hideFileOps` 等のローカル変数名を維持）ため、本体のロジック変更は不要。

**Step 3: ビルド確認**

Run: `cd packages/editor-core && npx tsc --noEmit 2>&1 | grep -v headingNumber`
Expected: EditorToolbarSection.tsx でエラー（まだ古い props を渡しているため）

---

### Task 3: EditorToolbarSection に ToolbarVisibility を適用

**Files:**
- Modify: `packages/editor-core/src/components/EditorToolbarSection.tsx:9-57`

**Step 1: EditorToolbarSectionProps から hide* を集約**

削除:
```
hideOutline, hideComments, hideTemplates, hideFoldAll,
hideFileOps, hideUndoRedo, hideHelp, hideVersionInfo,
hideSettings, hideToolbar, showReadonlyMode, readOnly
```

追加:
```typescript
hide?: ToolbarVisibility;
readOnly?: boolean;
```

注: `showReadonlyMode` は `hide.readonlyToggle` の反転で表現（`hideReadonlyToggle={!showReadonlyMode}` → `hide.readonlyToggle`）。
`readOnly` は hide 以外にも `hideFileOps={readOnly || hide?.fileOps}` のような合成で使うため個別に残す。

**Step 2: EditorToolbar への props 渡しを更新**

```typescript
<EditorToolbar
  ...
  hide={{
    fileOps: readOnly || hide?.fileOps,
    undoRedo: readOnly || hide?.undoRedo,
    moreMenu: (readOnly || hide?.help) && (readOnly || hide?.versionInfo) && (readOnly || hide?.settings),
    modeToggle: readOnly,
    readonlyToggle: hide?.readonlyToggle,
    outline: hide?.outline,
    comments: hide?.comments,
    templates: hide?.templates,
    foldAll: hide?.foldAll,
    settings: hide?.settings,
    versionInfo: hide?.versionInfo,
  }}
  ...
/>
```

**Step 3: ビルド確認**

Run: `cd packages/editor-core && npx tsc --noEmit 2>&1 | grep -v headingNumber`
Expected: MarkdownEditorPage.tsx でエラー（まだ古い props を渡しているため）

---

### Task 4: MarkdownEditorPage の呼び出しを更新

**Files:**
- Modify: `packages/editor-core/src/MarkdownEditorPage.tsx:288-307`

**Step 1: hide* props をオブジェクトに集約**

```typescript
<EditorToolbarSection
  ...
  hide={{
    outline: hideOutline, comments: hideComments,
    templates: hideTemplates, foldAll: hideFoldAll,
    fileOps: hideFileOps, undoRedo: hideUndoRedo,
    help: hideHelp, versionInfo: hideVersionInfo,
    settings: hideSettings, toolbar: hideToolbar,
    readonlyToggle: !showReadonlyMode,
  }}
  readOnly={readOnly}
  ...
/>
```

注: `showReadonlyMode` は反転して `readonlyToggle: !showReadonlyMode` で渡す。

**Step 2: ビルド確認**

Run: `cd packages/editor-core && npx tsc --noEmit 2>&1 | grep -v headingNumber`
Expected: エラーなし

**Step 3: テスト実行**

Run: `npm test -w packages/editor-core`
Expected: 全テスト通過

**Step 4: コミット**

```
refactor: hide* props を ToolbarVisibility オブジェクトに集約（Phase 1）
```

---

## Phase 2: FileHandlers — ファイル操作 props の集約

### Task 5: 型定義の追加

**Files:**
- Modify: `packages/editor-core/src/types/toolbar.ts`

**Step 1: FileHandlers / FileCapabilities 型を追加**

```typescript
/** ファイル操作ハンドラ */
export interface ToolbarFileHandlers {
  onDownload: () => void;
  onImport: () => void;
  onClear: () => void;
  onOpenFile?: () => void;
  onSaveFile?: () => void;
  onSaveAsFile?: () => void;
  onExportPdf?: () => void;
  onLoadRightFile?: () => void;
  onExportRightFile?: () => void;
}

/** ファイルシステム機能フラグ */
export interface ToolbarFileCapabilities {
  hasFileHandle?: boolean;
  supportsDirectAccess?: boolean;
}
```

---

### Task 6: EditorToolbar に FileHandlers を適用

**Files:**
- Modify: `packages/editor-core/src/components/EditorToolbar.tsx`

**Step 1: EditorToolbarProps から個別 props を削除し集約**

削除:
```
onDownload, onImport, onClear, onOpenFile, onSaveFile, onSaveAsFile,
onExportPdf, onLoadRightFile, onExportRightFile,
hasFileHandle, supportsDirectAccess
```

追加:
```typescript
fileHandlers: ToolbarFileHandlers;
fileCapabilities?: ToolbarFileCapabilities;
```

**Step 2: コンポーネント内の分割代入を更新**

```typescript
const {
  onDownload, onImport, onClear, onOpenFile, onSaveFile, onSaveAsFile,
  onExportPdf, onLoadRightFile, onExportRightFile,
} = fileHandlers;
const { hasFileHandle, supportsDirectAccess } = fileCapabilities ?? {};
```

---

### Task 7: EditorToolbarSection に FileHandlers を適用

**Files:**
- Modify: `packages/editor-core/src/components/EditorToolbarSection.tsx`

**Step 1: Props 変更**

削除:
```
handleDownload, fileInputRef, handleClear, handleFileSelected,
handleOpenFile, handleSaveFile, handleSaveAsFile,
fileHandle, supportsDirectAccess, rightFileOps, handleExportPdf
```

追加:
```typescript
fileHandlers: {
  onDownload: () => void;
  onClear: () => void;
  onOpenFile: () => void;
  onSaveFile: () => void;
  onSaveAsFile: () => void;
  onExportPdf: () => void;
};
fileInputRef: React.RefObject<HTMLInputElement | null>;
handleFileSelected: (f: File) => void;
fileHandle: unknown;
supportsDirectAccess: boolean;
rightFileOps: { loadFile: () => void; exportFile: () => void } | null;
```

注: `fileInputRef` と `handleFileSelected` は hidden input 用なので Section に残す。

**Step 2: EditorToolbar への変換**

```typescript
fileHandlers={{
  onDownload: fileHandlers.onDownload,
  onImport: () => fileInputRef.current?.click(),
  onClear: fileHandlers.onClear,
  onOpenFile: fileHandlers.onOpenFile,
  onSaveFile: fileHandlers.onSaveFile,
  onSaveAsFile: fileHandlers.onSaveAsFile,
  onExportPdf: fileHandlers.onExportPdf,
  onLoadRightFile: rightFileOps?.loadFile,
  onExportRightFile: rightFileOps?.exportFile,
}}
fileCapabilities={{
  hasFileHandle: fileHandle !== null,
  supportsDirectAccess,
}}
```

---

### Task 8: MarkdownEditorPage の呼び出しを更新

**Files:**
- Modify: `packages/editor-core/src/MarkdownEditorPage.tsx`

**Step 1: 個別 props → オブジェクトに変更**

```typescript
fileHandlers={{
  onDownload: handleDownload,
  onClear: handleClear,
  onOpenFile: handleOpenFile,
  onSaveFile: handleSaveFile,
  onSaveAsFile: handleSaveAsFile,
  onExportPdf: handleExportPdf,
}}
```

**Step 2: ビルド確認 + テスト**

Run: `cd packages/editor-core && npx tsc --noEmit 2>&1 | grep -v headingNumber`
Run: `npm test -w packages/editor-core`
Expected: 全通過

**Step 3: コミット**

```
refactor: ファイル操作 props を ToolbarFileHandlers に集約（Phase 2）
```

---

## Phase 3: ModeState / ModeHandlers — モード管理 props の集約

### Task 9: 型定義の追加

**Files:**
- Modify: `packages/editor-core/src/types/toolbar.ts`

**Step 1: ModeState / ModeHandlers 型を追加**

```typescript
/** エディタのモード状態 */
export interface ToolbarModeState {
  sourceMode: boolean;
  readonlyMode?: boolean;
  reviewMode?: boolean;
  outlineOpen: boolean;
  inlineMergeOpen: boolean;
  commentOpen?: boolean;
}

/** モード切替ハンドラ */
export interface ToolbarModeHandlers {
  onSwitchToSource: () => void;
  onSwitchToWysiwyg: () => void;
  onSwitchToReview?: () => void;
  onSwitchToReadonly?: () => void;
  onToggleOutline: () => void;
  onToggleComments?: () => void;
  onMerge: () => void;
}
```

---

### Task 10: EditorToolbar に ModeState / ModeHandlers を適用

**Files:**
- Modify: `packages/editor-core/src/components/EditorToolbar.tsx`

**Step 1: 個別 props を集約**

削除:
```
sourceMode, readonlyMode, reviewMode, outlineOpen, inlineMergeOpen, commentOpen,
onSwitchToSource, onSwitchToWysiwyg, onSwitchToReview, onSwitchToReadonly,
onToggleOutline, onToggleComments, onMerge
```

追加:
```typescript
modeState: ToolbarModeState;
modeHandlers: ToolbarModeHandlers;
```

**Step 2: 分割代入で既存のローカル変数名を維持**

```typescript
const { sourceMode, readonlyMode, reviewMode, outlineOpen, inlineMergeOpen, commentOpen } = modeState;
const { onSwitchToSource, onSwitchToWysiwyg, onSwitchToReview, onSwitchToReadonly, onToggleOutline, onToggleComments, onMerge } = modeHandlers;
```

---

### Task 11: EditorToolbarSection に ModeState / ModeHandlers を適用

**Files:**
- Modify: `packages/editor-core/src/components/EditorToolbarSection.tsx`

**Step 1: Props 変更**

EditorToolbarSectionProps のモード関連 props を集約。
Section 固有の `setCommentOpen` / `setSettingsOpen` / `setVersionDialogOpen` はオブジェクトに含めず個別に残す（Section 内部で変換するため）。

**Step 2: EditorToolbar への変換**

```typescript
modeState={{
  sourceMode, readonlyMode, reviewMode,
  outlineOpen, inlineMergeOpen,
  commentOpen,
}}
modeHandlers={{
  onSwitchToSource: modeHandlers.onSwitchToSource,
  onSwitchToWysiwyg: modeHandlers.onSwitchToWysiwyg,
  onSwitchToReview: modeHandlers.onSwitchToReview,
  onSwitchToReadonly: modeHandlers.onSwitchToReadonly,
  onToggleOutline: modeHandlers.onToggleOutline,
  onToggleComments: () => setCommentOpen((prev) => !prev),
  onMerge: modeHandlers.onMerge,
}}
```

---

### Task 12: MarkdownEditorPage の呼び出しを更新

**Files:**
- Modify: `packages/editor-core/src/MarkdownEditorPage.tsx`

**Step 1: 個別 props → オブジェクトに変更**

```typescript
modeHandlers={{
  onSwitchToSource: handleSwitchToSource,
  onSwitchToWysiwyg: handleSwitchToWysiwyg,
  onSwitchToReview: handleSwitchToReview,
  onSwitchToReadonly: handleSwitchToReadonly,
  onToggleOutline: handleToggleOutline,
  onMerge: handleMerge,
}}
```

**Step 2: ビルド確認 + テスト**

Run: `cd packages/editor-core && npx tsc --noEmit 2>&1 | grep -v headingNumber`
Run: `npm test -w packages/editor-core`
Expected: 全通過

**Step 3: コミット**

```
refactor: モード管理 props を ToolbarModeState/ModeHandlers に集約（Phase 3）
```

---

## Phase 4: テストとエクスポートの整備

### Task 13: テストファイルの更新

**Files:**
- Modify: `packages/editor-core/src/__tests__/EditorToolbar.test.tsx`

**Step 1: createDefaultProps を新インターフェースに合わせて更新**

```typescript
function createDefaultProps(overrides: Partial<Parameters<typeof EditorToolbar>[0]> = {}) {
  return {
    editor: null,
    isInDiagramBlock: false,
    onToggleAllBlocks: jest.fn(),
    onSetTemplateAnchor: jest.fn(),
    onSetHelpAnchor: jest.fn(),
    onAnnounce: jest.fn(),
    t,
    modeState: {
      sourceMode: false, outlineOpen: false, inlineMergeOpen: false,
    },
    modeHandlers: {
      onSwitchToSource: jest.fn(), onSwitchToWysiwyg: jest.fn(),
      onToggleOutline: jest.fn(), onMerge: jest.fn(),
    },
    fileHandlers: {
      onDownload: jest.fn(), onImport: jest.fn(), onClear: jest.fn(),
    },
    ...overrides,
  };
}
```

---

### Task 14: index.ts のエクスポート追加

**Files:**
- Modify: `packages/editor-core/src/index.ts`

**Step 1: 型をエクスポート**

```typescript
export type {
  ToolbarVisibility, ToolbarFileHandlers, ToolbarFileCapabilities,
  ToolbarModeState, ToolbarModeHandlers,
} from './types/toolbar';
```

---

### Task 15: 最終検証

**Step 1: 型チェック**

Run: `cd packages/editor-core && npx tsc --noEmit 2>&1 | grep -v headingNumber`
Expected: エラーなし

**Step 2: ユニットテスト**

Run: `npm test -w packages/editor-core`
Expected: 全通過

**Step 3: E2E テスト**

Run: `npx playwright test --project=chromium`
Expected: 全通過

**Step 4: コミット**

```
refactor: テスト更新とツールバー型のエクスポート追加（Phase 4）
```

---

## Props 削減サマリ

| コンポーネント | Before | After | 削減 |
|---|---|---|---|
| EditorToolbarProps | 48 | 17 | -31 |
| EditorToolbarSectionProps | 57 | 25 | -32 |

### 最終的な EditorToolbarProps（Phase 1-3 完了後）

```typescript
interface EditorToolbarProps {
  editor: Editor | null;
  isInDiagramBlock: boolean;
  onToggleAllBlocks: () => void;
  onSetTemplateAnchor: (el: HTMLElement) => void;
  onSetHelpAnchor: (el: HTMLElement) => void;
  mergeUndoRedo?: MergeUndoRedo | null;
  onOpenSettings?: () => void;
  onOpenVersionDialog?: () => void;
  onAnnounce?: (message: string) => void;
  t: TranslationFn;
  // Grouped props
  hide?: ToolbarVisibility;
  fileHandlers: ToolbarFileHandlers;
  fileCapabilities?: ToolbarFileCapabilities;
  modeState: ToolbarModeState;
  modeHandlers: ToolbarModeHandlers;
}
```
