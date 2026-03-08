import { useCallback, useEffect, useState } from "react";
import type { Editor } from "@tiptap/react";
import { getMarkdownFromEditor } from "../types";
import { sanitizeMarkdown, preserveBlankLines } from "../utils/sanitizeMarkdown";
import { parseCommentData } from "../utils/commentHelpers";

interface UseSourceModeParams {
  editor: Editor | null;
  saveContent: (md: string) => void;
  t: (key: string) => string;
}

const SOURCE_MODE_KEY = "markdown-editor-source-mode";
const REVIEW_MODE_KEY = "markdown-editor-review-mode";
const READONLY_MODE_KEY = "markdown-editor-readonly-mode";

export function useSourceMode({ editor, saveContent, t }: UseSourceModeParams) {
  const [sourceMode, setSourceMode] = useState(() => {
    try {
      return localStorage.getItem(SOURCE_MODE_KEY) === "true";
    } catch {
      return false;
    }
  });
  const [readonlyMode, setReadonlyMode] = useState(() => {
    try {
      return localStorage.getItem(READONLY_MODE_KEY) === "true";
    } catch {
      return false;
    }
  });
  const [reviewMode, setReviewMode] = useState(() => {
    try {
      const stored = localStorage.getItem(REVIEW_MODE_KEY);
      // readonlyMode が有効な場合は reviewMode を無効化
      if (localStorage.getItem(READONLY_MODE_KEY) === "true") return false;
      return stored === null ? true : stored === "true";
    } catch {
      return true;
    }
  });
  const [sourceText, setSourceText] = useState("");
  const [liveMessage, setLiveMessage] = useState("");

  // Restore sourceText from editor when reopening in source mode
  useEffect(() => {
    if (sourceMode && editor && !sourceText) {
      setSourceText(getMarkdownFromEditor(editor));
    }
  }, [editor]); // eslint-disable-line react-hooks/exhaustive-deps

  // Restore readonly/review editable state on init
  useEffect(() => {
    if (editor && (readonlyMode || reviewMode)) {
      editor.setEditable(false);
    }
  }, [editor]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSwitchToSource = useCallback(() => {
    if (!editor) return;
    if (readonlyMode || reviewMode) {
      editor.setEditable(true);
      setReadonlyMode(false);
      setReviewMode(false);
      try { localStorage.setItem(READONLY_MODE_KEY, "false"); } catch { /* ignore */ }
      try { localStorage.setItem(REVIEW_MODE_KEY, "false"); } catch { /* ignore */ }
    }
    editor.commands.closeSearch();
    setSourceText(getMarkdownFromEditor(editor));
    setSourceMode(true);
    try { localStorage.setItem(SOURCE_MODE_KEY, "true"); } catch { /* ignore */ }
    setLiveMessage(t("switchedToSource"));
  }, [editor, readonlyMode, reviewMode, t]);

  const handleSwitchToWysiwyg = useCallback(() => {
    if (editor) {
      if (readonlyMode || reviewMode) {
        editor.setEditable(true);
        setReadonlyMode(false);
        setReviewMode(false);
        try { localStorage.setItem(READONLY_MODE_KEY, "false"); } catch { /* ignore */ }
        try { localStorage.setItem(REVIEW_MODE_KEY, "false"); } catch { /* ignore */ }
      }
      if (sourceMode) {
        const { comments, body } = parseCommentData(sourceText);
        const sanitized = preserveBlankLines(sanitizeMarkdown(body));
        editor.commands.setContent(sanitized);
        if (comments.size > 0) {
          (editor.commands as any).initComments(comments);
        }
        saveContent(sourceText);
      }
    }
    setSourceMode(false);
    try { localStorage.setItem(SOURCE_MODE_KEY, "false"); } catch { /* ignore */ }
    setLiveMessage(t("switchedToWysiwyg"));
  }, [editor, sourceMode, readonlyMode, reviewMode, sourceText, saveContent, t]);

  const handleSwitchToReview = useCallback(() => {
    if (!editor) return;
    // Source モードから切り替える場合、まず WYSIWYG に同期
    if (sourceMode) {
      const { comments, body } = parseCommentData(sourceText);
      const sanitized = preserveBlankLines(sanitizeMarkdown(body));
      editor.commands.setContent(sanitized);
      if (comments.size > 0) {
        (editor.commands as any).initComments(comments);
      }
      saveContent(sourceText);
      setSourceMode(false);
      try { localStorage.setItem(SOURCE_MODE_KEY, "false"); } catch { /* ignore */ }
    }
    editor.setEditable(false);
    setReadonlyMode(false);
    setReviewMode(true);
    try { localStorage.setItem(READONLY_MODE_KEY, "false"); } catch { /* ignore */ }
    try { localStorage.setItem(REVIEW_MODE_KEY, "true"); } catch { /* ignore */ }
    setLiveMessage(t("switchedToReview"));
  }, [editor, sourceMode, sourceText, saveContent, t]);

  const handleSwitchToReadonly = useCallback(() => {
    if (!editor) return;
    // Source モードから切り替える場合、まず WYSIWYG に同期
    if (sourceMode) {
      const { comments, body } = parseCommentData(sourceText);
      const sanitized = preserveBlankLines(sanitizeMarkdown(body));
      editor.commands.setContent(sanitized);
      if (comments.size > 0) {
        (editor.commands as any).initComments(comments);
      }
      saveContent(sourceText);
      setSourceMode(false);
      try { localStorage.setItem(SOURCE_MODE_KEY, "false"); } catch { /* ignore */ }
    }
    editor.setEditable(false);
    setReadonlyMode(true);
    setReviewMode(false);
    try { localStorage.setItem(READONLY_MODE_KEY, "true"); } catch { /* ignore */ }
    try { localStorage.setItem(REVIEW_MODE_KEY, "false"); } catch { /* ignore */ }
    setLiveMessage(t("switchedToReadonly"));
  }, [editor, sourceMode, sourceText, saveContent, t]);

  /** コメント操作用: 一時的に editable を true にしてコマンド実行後に戻す */
  const executeInReviewMode = useCallback((fn: () => void) => {
    if (!editor) return;
    editor.setEditable(true);
    try {
      fn();
    } finally {
      // 次のマイクロタスクで editable を戻す（コマンドの非同期処理完了を待つ）
      queueMicrotask(() => {
        editor.setEditable(false);
      });
    }
  }, [editor]);

  const handleSourceChange = useCallback(
    (value: string) => {
      setSourceText(value);
      saveContent(value);
    },
    [saveContent],
  );

  const appendToSource = useCallback(
    (markdown: string) => {
      setSourceText((prev) => {
        const separator = prev.length > 0 && !prev.endsWith("\n") ? "\n" : "";
        const newText = prev + separator + markdown;
        saveContent(newText);
        return newText;
      });
    },
    [saveContent],
  );

  return {
    sourceMode,
    readonlyMode,
    reviewMode,
    sourceText,
    setSourceText,
    liveMessage,
    setLiveMessage,
    handleSwitchToSource,
    handleSwitchToWysiwyg,
    handleSwitchToReview,
    handleSwitchToReadonly,
    executeInReviewMode,
    handleSourceChange,
    appendToSource,
  };
}
