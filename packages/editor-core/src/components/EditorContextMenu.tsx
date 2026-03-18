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

  // Ctrl+Shift+V: Markdown として貼り付け（paste イベント経由でクリップボードにアクセス）
  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom;
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "V") {
        e.preventDefault();
        // paste イベントを発火させて clipboardData 経由でアクセス
        // execCommand('paste') はブラウザ制限で動かない場合がある
        // → navigator.clipboard.readText を試行し、失敗時は通知
        if (editor.isEditable) {
          navigator.clipboard.readText().then((text) => {
            if (text) insertMarkdownText(editor, text);
          }).catch(() => {
            // Clipboard API 不可の場合: ユーザーに右クリックメニューを使うよう案内
            console.warn("Clipboard API not available. Use the context menu instead.");
          });
        }
      }
    };
    dom.addEventListener("keydown", handler);
    return () => dom.removeEventListener("keydown", handler);
  }, [editor]);

  const handleClose = useCallback(() => {
    setMenuPos(null);
  }, []);

  const handlePasteAsMarkdown = useCallback(async () => {
    if (!editor || !editor.isEditable) { handleClose(); return; }
    try {
      const text = await navigator.clipboard.readText();
      if (!text) { handleClose(); return; }
      insertMarkdownText(editor, text);
    } catch {
      // VS Code ウェブビュー等で Clipboard API が使えない場合
      // input 要素経由のフォールバック
      const textarea = document.createElement("textarea");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.focus();
      document.execCommand("paste");
      const text = textarea.value;
      document.body.removeChild(textarea);
      if (text) {
        insertMarkdownText(editor, text);
      }
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
