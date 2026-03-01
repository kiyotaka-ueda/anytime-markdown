import { useCallback, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { Editor } from "@tiptap/react";
import { useTheme } from "@mui/material";
import { useTranslations } from "next-intl";
import useConfirm from "@/hooks/useConfirm";
import { getMarkdownFromEditor, type MarkdownStorage } from "../types";
import { sanitizeMarkdown, preserveBlankLines } from "../utils/sanitizeMarkdown";
import DOMPurify from "dompurify";
import { SVG_SANITIZE_CONFIG } from "./useMermaidRender";
import { PLANTUML_SERVER } from "../utils/plantumlHelpers";
import plantumlEncoder from "plantuml-encoder";

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
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

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

  const handleExportPdf = useCallback(async () => {
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

    // ダークモード時、印刷用にライトテーマで図を差し替え
    const diagramRestores: (() => void)[] = [];
    if (isDark) {
      // Mermaid: ライトテーマで再レンダリング
      const mermaidWrappers = document.querySelectorAll<HTMLElement>("[data-node-view-wrapper]");
      try {
        const mermaidMod = await import("mermaid");
        const mermaid = mermaidMod.default;
        mermaid.initialize({ startOnLoad: false, suppressErrorRendering: true, theme: "default" });
        let renderIdx = 0;
        for (const wrapper of mermaidWrappers) {
          const imgBox = wrapper.querySelector<HTMLElement>("[role='img']");
          const svgEl = imgBox?.querySelector("svg");
          if (!imgBox || !svgEl) continue;
          // コードブロックからソースを取得
          const codeEl = wrapper.querySelector("code");
          const code = codeEl?.textContent?.trim();
          if (!code) continue;
          const originalHTML = imgBox.innerHTML;
          try {
            const id = `print-mermaid-${++renderIdx}`;
            const { svg: lightSvg } = await mermaid.render(id, code);
            const innerDiv = imgBox.querySelector<HTMLElement>(":scope > div");
            if (innerDiv) {
              innerDiv.innerHTML = DOMPurify.sanitize(lightSvg, SVG_SANITIZE_CONFIG);
            }
            diagramRestores.push(() => { imgBox.innerHTML = originalHTML; });
          } catch {
            // レンダリング失敗時はスキップ
          }
        }
        // レンダリング後にダークテーマに戻す
        mermaid.initialize({ startOnLoad: false, suppressErrorRendering: true, theme: "dark" });
      } catch {
        // mermaid 未ロード時はスキップ
      }
      // 一時的なレンダリング用要素を削除
      document.querySelectorAll('[id^="dprint-mermaid-"]').forEach((el) => el.remove());

      // PlantUML: ダークスキンパラムなしの URL に差し替え、画像ロード完了を待つ
      const pumlImgs = document.querySelectorAll<HTMLImageElement>("[data-node-view-wrapper] img[src*='plantuml']");
      const pumlLoadPromises: Promise<void>[] = [];
      for (const img of pumlImgs) {
        const originalSrc = img.src;
        const wrapperEl = img.closest("[data-node-view-wrapper]");
        const codeEl = wrapperEl?.querySelector("code");
        const code = codeEl?.textContent?.trim();
        if (!code) continue;
        try {
          const startMatch = code.match(/@start(uml|mindmap|wbs|json|yaml)/);
          const src = startMatch ? code : `@startuml\n${code}\n@enduml`;
          const encoded = plantumlEncoder.encode(src);
          const newUrl = `${PLANTUML_SERVER}/svg/${encoded}`;
          pumlLoadPromises.push(new Promise<void>((resolve) => {
            img.onload = () => resolve();
            img.onerror = () => resolve();
            img.src = newUrl;
          }));
          diagramRestores.push(() => { img.src = originalSrc; });
        } catch {
          // エンコード失敗時はスキップ
        }
      }
      if (pumlLoadPromises.length > 0) {
        await Promise.all(pumlLoadPromises);
      }
    }

    // 再レンダーを待ってから印刷
    const needsDelay = collapsedPositions.length > 0 || diagramRestores.length > 0;
    const delay = needsDelay ? 300 : 0;
    setTimeout(() => {
      window.print();
      // 復元
      for (const restore of diagramRestores) restore();
      if (collapsedPositions.length > 0) {
        const tr = editor.state.tr;
        for (const pos of collapsedPositions) {
          tr.setNodeAttribute(pos, "collapsed", true);
        }
        editor.view.dispatch(tr);
      }
    }, delay);
  }, [editor, isDark]);

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
