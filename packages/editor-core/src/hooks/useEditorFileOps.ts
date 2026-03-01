import { useCallback, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { Editor } from "@tiptap/react";
import { useTranslations } from "next-intl";
import useConfirm from "@/hooks/useConfirm";
import { getMarkdownFromEditor, type MarkdownStorage } from "../types";
import { sanitizeMarkdown, preserveBlankLines } from "../utils/sanitizeMarkdown";

interface UseEditorFileOpsParams {
  editor: Editor | null;
  sourceMode: boolean;
  sourceText: string;
  setSourceText: Dispatch<SetStateAction<string>>;
  saveContent: (md: string) => void;
  downloadMarkdown: (md: string) => void;
  clearContent: () => void;
  openFile?: () => Promise<string | null>;
  saveFile?: (content: string) => Promise<void>;
  saveAsFile?: (content: string) => Promise<void>;
  resetFile?: () => void;
}

export function useEditorFileOps({
  editor,
  sourceMode,
  sourceText,
  setSourceText,
  saveContent,
  downloadMarkdown,
  clearContent,
  openFile,
  saveFile,
  saveAsFile,
  resetFile,
}: UseEditorFileOpsParams) {
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const confirm = useConfirm();
  const t = useTranslations("MarkdownEditor");

  const handleClear = useCallback(async () => {
    try {
      await confirm({
        open: true,
        title: t("clear"),
        icon: "alert",
        description: t("clearConfirm"),
      });
    } catch {
      return;
    }
    if (sourceMode) {
      setSourceText("");
    } else {
      editor?.commands.clearContent();
    }
    clearContent();
    resetFile?.();
  }, [confirm, t, sourceMode, setSourceText, editor, clearContent, resetFile]);

  const handleImport = useCallback(
    (file: File) => {
      if (!file.name.endsWith(".md") && !file.type.startsWith("text/")) return;
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result !== "string") return;
        if (sourceMode) {
          setSourceText(sanitizeMarkdown(reader.result));
        } else if (editor) {
          editor.commands.setContent(
            (editor.storage as unknown as MarkdownStorage).markdown.parser.parse(
              preserveBlankLines(sanitizeMarkdown(reader.result)),
            ),
          );
        }
      };
      reader.readAsText(file);
    },
    [sourceMode, setSourceText, editor],
  );

  const handleFileSelected = useCallback(async (file: File) => {
    const hasContent = sourceMode ? sourceText.trim() !== "" : !editor?.isEmpty;
    if (hasContent) {
      try {
        await confirm({
          open: true,
          title: t("import"),
          icon: "info",
          description: t("importConfirm"),
        });
      } catch {
        return;
      }
    }
    handleImport(file);
  }, [sourceMode, sourceText, editor, confirm, t, handleImport]);

  const handleDownload = useCallback(() => {
    const md = sourceMode ? sourceText : editor ? getMarkdownFromEditor(editor) : "";
    downloadMarkdown(md);
  }, [sourceMode, sourceText, editor, downloadMarkdown]);

  const handleCopy = useCallback(async () => {
    const md = sourceMode ? sourceText : editor ? getMarkdownFromEditor(editor) : "";
    await navigator.clipboard.writeText(md);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [sourceMode, sourceText, editor]);

  const handleOpenFile = useCallback(async () => {
    if (!openFile) return;
    const hasContent = sourceMode ? sourceText.trim() !== "" : !editor?.isEmpty;
    if (hasContent) {
      try {
        await confirm({
          open: true,
          title: t("openFile"),
          icon: "info",
          description: t("importConfirm"),
        });
      } catch {
        return;
      }
    }
    const content = await openFile();
    if (content === null) return;
    const sanitized = sanitizeMarkdown(content);
    if (sourceMode) {
      setSourceText(sanitized);
    } else if (editor) {
      editor.commands.setContent(
        (editor.storage as unknown as MarkdownStorage).markdown.parser.parse(
          preserveBlankLines(sanitized),
        ),
      );
    }
  }, [openFile, editor, sourceMode, sourceText, setSourceText, confirm, t]);

  const handleSaveFile = useCallback(async () => {
    if (!saveFile) return;
    const md = sourceMode ? sourceText : editor ? getMarkdownFromEditor(editor) : "";
    await saveFile(md);
  }, [saveFile, editor, sourceMode, sourceText]);

  const handleSaveAsFile = useCallback(async () => {
    if (!saveAsFile) return;
    const md = sourceMode ? sourceText : editor ? getMarkdownFromEditor(editor) : "";
    await saveAsFile(md);
  }, [saveAsFile, editor, sourceMode, sourceText]);

  const handleExportPdf = useCallback(() => {
    if (typeof window === "undefined" || !editor) {
      if (typeof window !== "undefined") window.print();
      return;
    }
    // 印刷前に折りたたまれたブロックを一時展開
    const collapsedPositions: number[] = [];
    editor.state.doc.descendants((node, pos) => {
      if (node.attrs.collapsed) {
        collapsedPositions.push(pos);
      }
    });
    if (collapsedPositions.length > 0) {
      const tr = editor.state.tr;
      for (const pos of collapsedPositions) {
        tr.setNodeAttribute(pos, "collapsed", false);
      }
      editor.view.dispatch(tr);
    }
    // React の再レンダーを待ってから印刷し、終了後に復元
    // requestAnimationFrame では Tiptap NodeView の React 再レンダーが
    // 間に合わないため setTimeout で十分な遅延を確保する
    const delay = collapsedPositions.length > 0 ? 300 : 0;
    setTimeout(() => {
      window.print();
      if (collapsedPositions.length > 0) {
        const tr = editor.state.tr;
        for (const pos of collapsedPositions) {
          tr.setNodeAttribute(pos, "collapsed", true);
        }
        editor.view.dispatch(tr);
      }
    }, delay);
  }, [editor]);

  return {
    copied,
    fileInputRef,
    handleClear,
    handleFileSelected,
    handleDownload,
    handleImport,
    handleCopy,
    handleOpenFile,
    handleSaveFile,
    handleSaveAsFile,
    handleExportPdf,
  };
}
