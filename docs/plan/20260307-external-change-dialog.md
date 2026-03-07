# 外部変更通知の確認ダイアログ化

## 意図

VS Code 拡張機能でファイル編集中に、Claude Code 等の外部ツールがファイルを変更した場合、
現状は即座にエディタ内容を更新しトースト通知のみ。
ユーザーが意図しないタイミングで編集中の内容が上書きされるリスクがある。

**変更後**: 確認ダイアログを表示し、OK 後に更新する。

## 現状のフロー

1. `fileWatcher.onDidChange` 検知 → `setContent` メッセージ送信 + `showInformationMessage`
2. `App.tsx` が `setContent` を受信 → `vscode-set-content` カスタムイベント発火
3. `useEditorSideEffects.ts` がイベントを受信 → `editor.commands.setContent()` で即反映

※ `onDidChangeTextDocument` も同様に `updateWebview()` → `setContent` で即反映する。
  外部ファイル変更時は `fileWatcher` と `onDidChangeTextDocument` の両方が発火する可能性がある。

## 変更計画

### 変更対象ファイル（3ファイル + i18n 2ファイル）

#### 1. `packages/vscode-extension/src/providers/MarkdownEditorProvider.ts`
- `fileWatcher.onDidChange`: `setContent` → `externalChange` メッセージに変更
- `showInformationMessage` を削除
- `onDidChangeTextDocument`: 外部ファイル変更中は抑制するフラグ追加
- ダイアログ中の追加変更: 最新のコンテンツのみ保持（webview 側で制御）

#### 2. `packages/vscode-extension/src/webview/App.tsx`
- `externalChange` メッセージを受信 → `vscode-external-change` カスタムイベント発火

#### 3. `packages/editor-core/src/hooks/useEditorSideEffects.ts`
- `vscode-external-change` イベントをリッスン
- `useConfirm` で確認ダイアログ表示
- OK → `editor.commands.setContent()` で反映
- キャンセル → 変更を破棄（現在のエディタ内容を維持）
- ダイアログ表示中に追加の外部変更があった場合、最新のコンテンツで上書き

#### 4. `packages/editor-core/src/i18n/ja.json` / `en.json`
- ダイアログ用 i18n キー追加（タイトル・説明文）

## 選択理由

- `ConfirmProvider` + `useConfirm` は既存の確認ダイアログ基盤であり、新規コンポーネント不要
- メッセージタイプを分離（`setContent` vs `externalChange`）することで、
  VS Code Undo/Redo（`setContent`）は即反映、外部変更のみダイアログ経由にできる

## リスク

- ダイアログ表示中にユーザーが編集を続けた場合、OK で外部変更に上書きされる
  → これは意図した動作（外部変更を受け入れる = 現在の内容を破棄）
- `onDidChangeTextDocument` の抑制漏れで二重更新される可能性
  → フラグ + タイムアウトで対処
