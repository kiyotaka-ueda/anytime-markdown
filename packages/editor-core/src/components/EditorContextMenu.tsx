"use client";

import ContentPasteIcon from "@mui/icons-material/ContentPaste";
import { ListItemIcon, ListItemText, Menu, MenuItem } from "@mui/material";
import type { Editor } from "@tiptap/react";
import { useCallback, useEffect, useState } from "react";

import { getMarkdownStorage } from "../types";
import { boxTableToMarkdown, containsBoxTable } from "../utils/boxTableToMarkdown";

interface EditorContextMenuProps {
  editor: Editor | null;
  t: (key: string) => string;
}

interface MenuPosition {
  mouseX: number;
  mouseY: number;
}

/** クリップボードテキストを Markdown として解析しエディタに挿入 */
function insertMarkdownText(editor: Editor, text: string): void {
  let md = text;
  if (containsBoxTable(md)) {
    md = boxTableToMarkdown(md);
  }
  const { parser } = getMarkdownStorage(editor);
  const parsed = parser.parse(md);
  if (parsed) {
    const { from, to } = editor.state.selection;
    const tr = editor.state.tr.replaceWith(from, to, parsed.content);
    editor.view.dispatch(tr);
  }
}

export function EditorContextMenu({ editor, t }: EditorContextMenuProps) {
  const [menuPos, setMenuPos] = useState<MenuPosition | null>(null);

  // 右クリックメニュー表示
  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom;
    const handler = (event: MouseEvent) => {
      event.preventDefault();
      setMenuPos({ mouseX: event.clientX, mouseY: event.clientY });
    };
    dom.addEventListener("contextmenu", handler);
    return () => dom.removeEventListener("contextmenu", handler);
  }, [editor]);

  // VS Code 拡張からの Markdown 貼り付けイベント（Ctrl+Shift+V / コマンド経由）
  useEffect(() => {
    if (!editor) return;
    const handler = (e: Event) => {
      const text = (e as CustomEvent<string>).detail;
      if (text && editor.isEditable) {
        insertMarkdownText(editor, text);
      }
    };
    window.addEventListener("vscode-paste-markdown", handler);
    return () => window.removeEventListener("vscode-paste-markdown", handler);
  }, [editor]);

  const handleClose = useCallback(() => {
    setMenuPos(null);
  }, []);

  const handlePasteAsMarkdown = useCallback(async () => {
    if (!editor || !editor.isEditable) { handleClose(); return; }
    try {
      // Clipboard API を試行（Web アプリ用）
      const text = await navigator.clipboard.readText();
      if (text) {
        insertMarkdownText(editor, text);
        handleClose();
        return;
      }
    } catch { /* Clipboard API 不可 */ }

    // VS Code 環境: 拡張側にクリップボード読み取りを依頼
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    if (w.__vscode) {
      w.__vscode.postMessage({ type: "readClipboard" });
    }
    handleClose();
  }, [editor, handleClose]);

  return (
    <Menu
      open={menuPos !== null}
      onClose={handleClose}
      anchorReference="anchorPosition"
      anchorPosition={
        menuPos !== null
          ? { top: menuPos.mouseY, left: menuPos.mouseX }
          : undefined
      }
      slotProps={{
        paper: { sx: { minWidth: 180 } },
      }}
    >
      <MenuItem onClick={handlePasteAsMarkdown} disabled={!editor?.isEditable}>
        <ListItemIcon>
          <ContentPasteIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>{t("pasteAsMarkdown")}</ListItemText>
      </MenuItem>
    </Menu>
  );
}
