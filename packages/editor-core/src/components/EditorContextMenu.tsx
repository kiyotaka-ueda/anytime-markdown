"use client";

import CodeIcon from "@mui/icons-material/Code";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import ContentCutIcon from "@mui/icons-material/ContentCut";
import ContentPasteIcon from "@mui/icons-material/ContentPaste";
import { Divider, ListItemIcon, ListItemText, Menu, MenuItem, Typography } from "@mui/material";
import type { Node as PMNode } from "@tiptap/pm/model";
import type { Editor } from "@tiptap/react";
import { useCallback, useEffect, useRef, useState } from "react";

import { boxTableToMarkdown, containsBoxTable } from "../utils/boxTableToMarkdown";

/** コンテキストメニューでコピーしたブロックノードを保持 */
let copiedBlockNode: PMNode | null = null;

interface EditorContextMenuProps {
  editor: Editor | null;
  readOnly?: boolean;
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
  editor.chain().focus().insertContent(md).run();
}

const menuPaperSx = {
  minWidth: 180,
  bgcolor: "background.paper",
  border: 1,
  borderColor: "divider",
  borderRadius: 1,
  boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
  py: 0.5,
  "& .MuiMenuItem-root": {
    fontSize: "0.8125rem",
    minHeight: 28,
    px: 2,
    py: 0.25,
  },
  "& .MuiListItemIcon-root": {
    minWidth: 28,
  },
};

export function EditorContextMenu({ editor, readOnly, t }: EditorContextMenuProps) {
  const [menuPos, setMenuPos] = useState<MenuPosition | null>(null);

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

  // VS Code 拡張からの Markdown 貼り付けイベント
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

  // VS Code 拡張からのコードブロック貼り付けイベント
  useEffect(() => {
    if (!editor) return;
    const handler = (e: Event) => {
      const text = (e as CustomEvent<string>).detail;
      if (text && editor.isEditable) {
        editor.chain().focus().insertContent({
          type: "codeBlock",
          attrs: { language: "" },
          content: [{ type: "text", text }],
        }).run();
      }
    };
    window.addEventListener("vscode-paste-codeblock", handler);
    return () => window.removeEventListener("vscode-paste-codeblock", handler);
  }, [editor]);

  const handleClose = useCallback(() => {
    setMenuPos(null);
  }, []);

  const BLOCK_NODE_TYPES = new Set(["codeBlock", "table", "gifBlock", "image"]);

  /** カーソル位置周辺のブロックノードを探す */
  const findBlockNode = useCallback((): { node: PMNode; pos: number } | null => {
    if (!editor) return null;
    const { $from, from } = editor.state.selection;

    // 1. 祖先ノードをチェック
    for (let d = $from.depth; d >= 1; d--) {
      const node = $from.node(d);
      if (BLOCK_NODE_TYPES.has(node.type.name)) {
        return { node, pos: $from.before(d) };
      }
    }

    // 2. カーソル位置のノード（NodeView の外にカーソルがある場合）
    const nodeAt = editor.state.doc.nodeAt(from);
    if (nodeAt && BLOCK_NODE_TYPES.has(nodeAt.type.name)) {
      return { node: nodeAt, pos: from };
    }

    // 3. カーソルの直前のノード（カーソルがノードの直後にある場合）
    if (from > 0) {
      const $pos = editor.state.doc.resolve(from);
      const before = $pos.nodeBefore;
      if (before && BLOCK_NODE_TYPES.has(before.type.name)) {
        return { node: before, pos: from - before.nodeSize };
      }
    }

    // 4. トップレベルノードをチェック（depth=1）
    if ($from.depth >= 1) {
      const topNode = $from.node(1);
      if (BLOCK_NODE_TYPES.has(topNode.type.name)) {
        return { node: topNode, pos: $from.before(1) };
      }
    }

    return null;
  }, [editor]);

  const hasSelection = editor ? editor.state.selection.from !== editor.state.selection.to : false;
  const isInBlock = !!findBlockNode();
  const canCopy = hasSelection || isInBlock;

  /** ブロック全体の情報を取得 */
  const getBlockInfo = useCallback((): { text: string; node: PMNode; blockStart: number; blockEnd: number } | null => {
    const found = findBlockNode();
    if (!found || !editor) return null;
    const { node, pos: blockStart } = found;
    const blockEnd = blockStart + node.nodeSize;
    const text = editor.state.doc.textBetween(blockStart, blockEnd, "\n");
    return { text, node, blockStart, blockEnd };
  }, [editor, findBlockNode]);

  const handleCut = useCallback(() => {
    if (!editor || !editor.isEditable) return;
    const { from, to } = editor.state.selection;

    if (from !== to) {
      copiedBlockNode = null;
      const text = editor.state.doc.textBetween(from, to, "\n");
      navigator.clipboard.writeText(text).catch(() => { document.execCommand("copy"); });
      editor.chain().focus().deleteSelection().run();
      handleClose();
      return;
    }

    const block = getBlockInfo();
    if (block) {
      copiedBlockNode = block.node;
      navigator.clipboard.writeText(block.text).catch(() => { document.execCommand("copy"); });
      const { tr } = editor.state;
      tr.delete(block.blockStart, block.blockEnd);
      editor.view.dispatch(tr);
    }
    handleClose();
  }, [editor, handleClose, getBlockInfo]);

  const handleCopy = useCallback(() => {
    if (!editor) return;
    const { from, to } = editor.state.selection;

    if (from !== to) {
      copiedBlockNode = null;
      const text = editor.state.doc.textBetween(from, to, "\n");
      navigator.clipboard.writeText(text).catch(() => { document.execCommand("copy"); });
      handleClose();
      return;
    }

    const block = getBlockInfo();
    if (block) {
      copiedBlockNode = block.node;
      navigator.clipboard.writeText(block.text).catch(() => { document.execCommand("copy"); });
    }
    handleClose();
  }, [editor, handleClose, getBlockInfo]);

  const handlePaste = useCallback(async () => {
    if (!editor || !!readOnly) { handleClose(); return; }

    // コンテキストメニューでコピーしたブロックノードがある場合はそれを挿入
    if (copiedBlockNode) {
      const { $from } = editor.state.selection;
      const insertPos = $from.after(1); // 現在のブロックの末尾に挿入
      const { tr } = editor.state;
      tr.insert(Math.min(insertPos, tr.doc.content.size), copiedBlockNode.copy(copiedBlockNode.content));
      editor.view.dispatch(tr.scrollIntoView());
      handleClose();
      return;
    }

    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        editor.chain().focus().insertContent(text, { parseOptions: { preserveWhitespace: true } }).run();
        handleClose();
        return;
      }
    } catch { /* Clipboard API 不可 */ }
    handleClose();
  }, [editor, readOnly, handleClose]);

  const handlePasteAsCodeBlock = useCallback(async () => {
    if (!editor || !!readOnly) { handleClose(); return; }
    const pasteIntoCodeBlock = (text: string) => {
      editor.chain().focus().insertContent({
        type: "codeBlock",
        attrs: { language: "" },
        content: [{ type: "text", text }],
      }).run();
    };
    try {
      const text = await navigator.clipboard.readText();
      if (text) { pasteIntoCodeBlock(text); handleClose(); return; }
    } catch { /* Clipboard API 不可 */ }
    // VS Code 環境: vscode-paste-codeblock イベントで処理
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    if (w.__vscode) {
      w.__vscode.postMessage({ type: "readClipboardForCodeBlock" });
    }
    handleClose();
  }, [editor, readOnly, handleClose]);

  const handlePasteAsMarkdown = useCallback(async () => {
    if (!editor || !editor.isEditable) { handleClose(); return; }
    try {
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
      slotProps={{ paper: { sx: menuPaperSx } }}
    >
      <MenuItem onClick={handleCut} disabled={!!readOnly || !canCopy}>
        <ListItemIcon>
          <ContentCutIcon sx={{ fontSize: 16 }} />
        </ListItemIcon>
        <ListItemText primaryTypographyProps={{ fontSize: "0.8125rem" }}>
          {t("cut")}
        </ListItemText>
        <Typography variant="body2" sx={{ color: "text.secondary", fontSize: "0.75rem", ml: 2 }}>
          Ctrl+X
        </Typography>
      </MenuItem>
      <MenuItem onClick={handleCopy} disabled={!canCopy}>
        <ListItemIcon>
          <ContentCopyIcon sx={{ fontSize: 16 }} />
        </ListItemIcon>
        <ListItemText primaryTypographyProps={{ fontSize: "0.8125rem" }}>
          {t("copy")}
        </ListItemText>
        <Typography variant="body2" sx={{ color: "text.secondary", fontSize: "0.75rem", ml: 2 }}>
          Ctrl+C
        </Typography>
      </MenuItem>
      <MenuItem onClick={handlePaste} disabled={!!readOnly}>
        <ListItemIcon>
          <ContentPasteIcon sx={{ fontSize: 16 }} />
        </ListItemIcon>
        <ListItemText primaryTypographyProps={{ fontSize: "0.8125rem" }}>
          {t("paste")}
        </ListItemText>
        <Typography variant="body2" sx={{ color: "text.secondary", fontSize: "0.75rem", ml: 2 }}>
          Ctrl+V
        </Typography>
      </MenuItem>
      <Divider sx={{ my: 0.5 }} />
      <MenuItem onClick={handlePasteAsMarkdown} disabled={!!readOnly}>
        <ListItemIcon>
          <ContentPasteIcon sx={{ fontSize: 16 }} />
        </ListItemIcon>
        <ListItemText primaryTypographyProps={{ fontSize: "0.8125rem" }}>
          {t("pasteAsMarkdown")}
        </ListItemText>
        <Typography variant="body2" sx={{ color: "text.secondary", fontSize: "0.75rem", ml: 2 }}>
          Ctrl+Shift+V
        </Typography>
      </MenuItem>
      <MenuItem onClick={handlePasteAsCodeBlock} disabled={!!readOnly}>
        <ListItemIcon>
          <CodeIcon sx={{ fontSize: 16 }} />
        </ListItemIcon>
        <ListItemText primaryTypographyProps={{ fontSize: "0.8125rem" }}>
          {t("pasteAsCodeBlock")}
        </ListItemText>
      </MenuItem>
    </Menu>
  );
}
