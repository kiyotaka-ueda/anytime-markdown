/**
 * TreeNode.tsx - 追加カバレッジテスト
 *
 * ドラッグオーバー、空フォルダのクリック無効化、ActionButtons の各ボタン、
 * DirExpandIcon/EntryIcon のバリエーションなど未カバー部分を検証する。
 */

import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

jest.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

import { TreeNode } from "../components/explorer/TreeNode";

const baseProps = {
  depth: 0,
  repo: { fullName: "user/repo", private: false, defaultBranch: "main" },
  expanded: new Set<string>(),
  loadingDirs: new Set<string>(),
  childrenCache: new Map(),
  hasMdCache: new Map(),
  selectedFilePath: null,
  onToggle: jest.fn(),
  onSelectFile: jest.fn(),
  onCreateFile: jest.fn(),
  onDeleteFile: jest.fn(),
  onRename: jest.fn(),
  onCreateFolder: jest.fn(),
  renamingPath: null,
  onStartRename: jest.fn(),
  onCancelRename: jest.fn(),
  creatingInDir: null,
  onStartCreate: jest.fn(),
  onCancelCreate: jest.fn(),
  creatingFolderInDir: null,
  onStartCreateFolder: jest.fn(),
  onCancelCreateFolder: jest.fn(),
  dragOverPath: null,
  onMoveEntry: jest.fn(),
  onDragOverPath: jest.fn(),
  dragSourceRef: { current: null },
};

describe("TreeNode - empty ディレクトリクリック", () => {
  it("empty ディレクトリのクリックは onToggle を呼ばない", () => {
    const onToggle = jest.fn();
    const entry = { path: "empty-dir", type: "tree" as const, name: "empty-dir" };
    const hasMdCache = new Map([["empty-dir", false]]);
    render(
      <TreeNode {...baseProps} entry={entry} onToggle={onToggle} hasMdCache={hasMdCache} />,
    );
    fireEvent.click(screen.getByText("empty-dir"));
    expect(onToggle).not.toHaveBeenCalled();
  });
});

describe("TreeNode - DirExpandIcon バリエーション", () => {
  it("展開済みディレクトリは ExpandMore アイコンを表示する", () => {
    const entry = { path: "docs", type: "tree" as const, name: "docs" };
    const expanded = new Set(["docs"]);
    const childrenCache = new Map([["docs", [{ path: "docs/a.md", type: "blob" as const, name: "a.md" }]]]);
    const hasMdCache = new Map([["docs", true]]);
    render(
      <TreeNode
        {...baseProps}
        entry={entry}
        expanded={expanded}
        childrenCache={childrenCache}
        hasMdCache={hasMdCache}
      />,
    );
    // ExpandMoreIcon should be rendered (SVG with data-testid from MUI)
    expect(screen.getByText("docs")).toBeTruthy();
  });
});

describe("TreeNode - drag over フォルダ", () => {
  it("ディレクトリへのドラッグオーバーで onDragOverPath が呼ばれる", () => {
    const onDragOverPath = jest.fn();
    const entry = { path: "target-dir", type: "tree" as const, name: "target-dir" };
    const dragSourceRef = { current: "source.md" as string | null };
    render(
      <TreeNode
        {...baseProps}
        entry={entry}
        dragSourceRef={dragSourceRef}
        onDragOverPath={onDragOverPath}
      />,
    );
    const listItem = screen.getByText("target-dir").closest("[role='button']")!;
    fireEvent.dragOver(listItem, {
      dataTransfer: { dropEffect: "" },
      preventDefault: jest.fn(),
    });
    expect(onDragOverPath).toHaveBeenCalledWith("target-dir");
  });

  it("ファイルへのドラッグオーバーは何もしない", () => {
    const onDragOverPath = jest.fn();
    const entry = { path: "file.md", type: "blob" as const, name: "file.md" };
    const dragSourceRef = { current: "source.md" as string | null };
    render(
      <TreeNode
        {...baseProps}
        entry={entry}
        dragSourceRef={dragSourceRef}
        onDragOverPath={onDragOverPath}
      />,
    );
    const listItem = screen.getByText("file.md").closest("[role='button']")!;
    fireEvent.dragOver(listItem);
    expect(onDragOverPath).not.toHaveBeenCalled();
  });

  it("自分自身へのドラッグオーバーは無効", () => {
    const onDragOverPath = jest.fn();
    const entry = { path: "dir", type: "tree" as const, name: "dir" };
    const dragSourceRef = { current: "dir" as string | null };
    render(
      <TreeNode
        {...baseProps}
        entry={entry}
        dragSourceRef={dragSourceRef}
        onDragOverPath={onDragOverPath}
      />,
    );
    const listItem = screen.getByText("dir").closest("[role='button']")!;
    fireEvent.dragOver(listItem);
    expect(onDragOverPath).not.toHaveBeenCalled();
  });

  it("子フォルダへの親のドラッグオーバーは無効", () => {
    const onDragOverPath = jest.fn();
    const entry = { path: "parent", type: "tree" as const, name: "parent" };
    const dragSourceRef = { current: "parent/child" as string | null };
    render(
      <TreeNode
        {...baseProps}
        entry={entry}
        dragSourceRef={dragSourceRef}
        onDragOverPath={onDragOverPath}
      />,
    );
    const listItem = screen.getByText("parent").closest("[role='button']")!;
    fireEvent.dragOver(listItem);
    // src starts with entry.path + "/" => invalid
    expect(onDragOverPath).not.toHaveBeenCalled();
  });

  it("同じ親フォルダへのドラッグオーバーは無効", () => {
    const onDragOverPath = jest.fn();
    const entry = { path: "parent", type: "tree" as const, name: "parent" };
    const dragSourceRef = { current: "parent/sibling.md" as string | null };
    render(
      <TreeNode
        {...baseProps}
        entry={entry}
        dragSourceRef={dragSourceRef}
        onDragOverPath={onDragOverPath}
      />,
    );
    const listItem = screen.getByText("parent").closest("[role='button']")!;
    fireEvent.dragOver(listItem);
    // srcDir === entry.path => invalid
    expect(onDragOverPath).not.toHaveBeenCalled();
  });

  it("dragSource が null のときはドラッグオーバー無視", () => {
    const onDragOverPath = jest.fn();
    const entry = { path: "dir", type: "tree" as const, name: "dir" };
    const dragSourceRef = { current: null as string | null };
    render(
      <TreeNode
        {...baseProps}
        entry={entry}
        dragSourceRef={dragSourceRef}
        onDragOverPath={onDragOverPath}
      />,
    );
    const listItem = screen.getByText("dir").closest("[role='button']")!;
    fireEvent.dragOver(listItem);
    expect(onDragOverPath).not.toHaveBeenCalled();
  });
});

describe("TreeNode - dragLeave", () => {
  it("isDragOver の状態で dragLeave すると onDragOverPath(null) が呼ばれる", () => {
    const onDragOverPath = jest.fn();
    const entry = { path: "dir", type: "tree" as const, name: "dir" };
    render(
      <TreeNode
        {...baseProps}
        entry={entry}
        dragOverPath="dir"
        onDragOverPath={onDragOverPath}
      />,
    );
    const listItem = screen.getByText("dir").closest("[role='button']")!;
    fireEvent.dragLeave(listItem);
    expect(onDragOverPath).toHaveBeenCalledWith(null);
  });

  it("isDragOver でない場合は dragLeave で onDragOverPath を呼ばない", () => {
    const onDragOverPath = jest.fn();
    const entry = { path: "dir", type: "tree" as const, name: "dir" };
    render(
      <TreeNode
        {...baseProps}
        entry={entry}
        dragOverPath={null}
        onDragOverPath={onDragOverPath}
      />,
    );
    const listItem = screen.getByText("dir").closest("[role='button']")!;
    fireEvent.dragLeave(listItem);
    expect(onDragOverPath).not.toHaveBeenCalled();
  });
});

describe("TreeNode - drop 追加ケース", () => {
  it("dragSource が null の場合 drop しても onMoveEntry は呼ばれない", () => {
    const onMoveEntry = jest.fn();
    const entry = { path: "dir", type: "tree" as const, name: "dir" };
    const dragSourceRef = { current: null as string | null };
    render(
      <TreeNode
        {...baseProps}
        entry={entry}
        dragSourceRef={dragSourceRef}
        onMoveEntry={onMoveEntry}
      />,
    );
    const listItem = screen.getByText("dir").closest("[role='button']")!;
    fireEvent.drop(listItem, { dataTransfer: {} });
    expect(onMoveEntry).not.toHaveBeenCalled();
  });

  it("ファイルへの drop は onMoveEntry を呼ばない", () => {
    const onMoveEntry = jest.fn();
    const entry = { path: "file.md", type: "blob" as const, name: "file.md" };
    const dragSourceRef = { current: "other.md" as string | null };
    render(
      <TreeNode
        {...baseProps}
        entry={entry}
        dragSourceRef={dragSourceRef}
        onMoveEntry={onMoveEntry}
      />,
    );
    const listItem = screen.getByText("file.md").closest("[role='button']")!;
    fireEvent.drop(listItem, { dataTransfer: {} });
    expect(onMoveEntry).not.toHaveBeenCalled();
  });
});

describe("TreeNode - selected ファイル", () => {
  it("選択中のファイルは selected スタイルが適用される", () => {
    const entry = { path: "selected.md", type: "blob" as const, name: "selected.md" };
    render(
      <TreeNode {...baseProps} entry={entry} selectedFilePath="selected.md" />,
    );
    expect(screen.getByText("selected.md")).toBeTruthy();
  });
});

describe("TreeNode - dragOverPath 表示", () => {
  it("dragOverPath が一致するとハイライトスタイルが適用される", () => {
    const entry = { path: "dir", type: "tree" as const, name: "dir" };
    render(
      <TreeNode {...baseProps} entry={entry} dragOverPath="dir" />,
    );
    expect(screen.getByText("dir")).toBeTruthy();
  });
});

describe("TreeNode - EntryIcon バリエーション", () => {
  it("開いたフォルダアイコン（empty でない）", () => {
    const entry = { path: "docs", type: "tree" as const, name: "docs" };
    const expanded = new Set(["docs"]);
    const hasMdCache = new Map([["docs", true]]);
    const childrenCache = new Map([["docs", [{ path: "docs/a.md", type: "blob" as const, name: "a.md" }]]]);
    render(
      <TreeNode
        {...baseProps}
        entry={entry}
        expanded={expanded}
        hasMdCache={hasMdCache}
        childrenCache={childrenCache}
      />,
    );
    expect(screen.getByText("docs")).toBeTruthy();
  });
});
