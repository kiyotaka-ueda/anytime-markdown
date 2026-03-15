"use client";

import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import { Alert, Box, IconButton, Tooltip } from "@mui/material";
import DOMPurify from "dompurify";
import { useCallback, useRef, useState } from "react";

import { DEFAULT_DARK_BG, DEFAULT_LIGHT_BG } from "../../constants/colors";
import { PREVIEW_MAX_HEIGHT } from "../../constants/dimensions";
import { useBlockMergeCompare } from "../../hooks/useBlockMergeCompare";
import { MATH_SANITIZE_CONFIG,useKatexRender } from "../../hooks/useKatexRender";
import { MathFullscreenDialog } from "../MathFullscreenDialog";
import { BlockInlineToolbar } from "./BlockInlineToolbar";
import { CodeBlockFrame } from "./CodeBlockFrame";
import type { CodeBlockSharedProps } from "./types";

type MathBlockProps = Pick<
  CodeBlockSharedProps,
  | "editor" | "node" | "updateAttributes" | "getPos"
  | "codeCollapsed" | "isSelected"
  | "selectNode" | "code"
  | "handleCopyCode" | "handleDeleteBlock" | "deleteDialogOpen" | "setDeleteDialogOpen"
  | "fullscreen" | "setFullscreen" | "fsCode" | "onFsCodeChange" | "fsTextareaRef" | "fsSearch"
  | "t" | "isDark"
> & {
  handleFsTextChange: (newCode: string) => void;
};

export function MathBlock(props: MathBlockProps) {
  const {
    editor, node, updateAttributes, getPos,
    codeCollapsed, isSelected,
    selectNode, code,
    handleCopyCode, handleDeleteBlock, deleteDialogOpen, setDeleteDialogOpen,
    fullscreen, setFullscreen, fsCode, onFsCodeChange, fsTextareaRef, fsSearch,
    handleFsTextChange,
    t, isDark,
  } = props;

  const { html: mathHtml, error: mathError } = useKatexRender({ code, isMath: true });

  // --- Resize ---
  const mathContainerRef = useRef<HTMLDivElement>(null);
  const [resizing, setResizing] = useState(false);
  const [resizeWidth, setResizeWidth] = useState<number | null>(null);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);
  const MIN_WIDTH = 50;

  const handleResizePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const container = mathContainerRef.current;
    if (!container) return;
    startXRef.current = e.clientX;
    startWidthRef.current = container.getBoundingClientRect().width;
    setResizing(true);
    setResizeWidth(startWidthRef.current);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handleResizePointerMove = useCallback((e: React.PointerEvent) => {
    if (!resizing) return;
    const delta = e.clientX - startXRef.current;
    setResizeWidth(Math.max(MIN_WIDTH, Math.round(startWidthRef.current + delta)));
  }, [resizing]);

  const handleResizePointerUp = useCallback(() => {
    if (!resizing) return;
    setResizing(false);
    if (resizeWidth !== null) {
      updateAttributes({ width: `${resizeWidth}px` });
    }
    setResizeWidth(null);
  }, [resizing, resizeWidth, updateAttributes]);

  const displayWidth = resizeWidth !== null ? `${resizeWidth}px` : node.attrs.width || undefined;

  const { isCompareMode, compareCode, handleMergeApply } = useBlockMergeCompare({
    editor, getPos, language: "math", code, fullscreen,
  });

  const toolbar = (
    <BlockInlineToolbar
      label="Math"
      onFullscreen={() => setFullscreen(true)}
      onDelete={() => setDeleteDialogOpen(true)}
      t={t}
    />
  );

  return (
    <CodeBlockFrame
      toolbar={toolbar}
      codeCollapsed={codeCollapsed}
      isDark={isDark}
      showBorder={isSelected && editor.isEditable}
      deleteDialogOpen={deleteDialogOpen}
      setDeleteDialogOpen={setDeleteDialogOpen}
      handleDeleteBlock={handleDeleteBlock}
      t={t}
      afterFrame={
        <MathFullscreenDialog
          open={fullscreen}
          onClose={() => { fsSearch.reset(); setFullscreen(false); }}
          label="Math"
          fsCode={fsCode}
          onFsCodeChange={onFsCodeChange}
          onFsTextChange={handleFsTextChange}
          fsTextareaRef={fsTextareaRef}
          fsSearch={fsSearch}
          readOnly={!editor.isEditable}
          isCompareMode={isCompareMode}
          compareCode={compareCode}
          onMergeApply={handleMergeApply}
          toolbarExtra={
            <Tooltip title={t("copyCode")} placement="bottom">
              <IconButton size="small" sx={{ p: 0.25 }} onClick={handleCopyCode} aria-label={t("copyCode")}>
                <ContentCopyIcon sx={{ fontSize: 16, color: "text.secondary" }} />
              </IconButton>
            </Tooltip>
          }
          t={t}
        />
      }
    >
      {mathError && (
        <Alert severity="warning" sx={{ borderRadius: 0 }}>{mathError}</Alert>
      )}
      {mathHtml && (
        <Box
          ref={mathContainerRef}
          contentEditable={false}
          role="img"
          aria-label={`${t("mathFormula")}: ${code}`}
          onClick={() => { selectNode(); if (!codeCollapsed) updateAttributes({ codeCollapsed: true }); }}
          onDoubleClick={() => setFullscreen(true)}
          onPointerMove={handleResizePointerMove}
          onPointerUp={handleResizePointerUp}
          sx={{ pt: 0, px: 2, pb: 2, bgcolor: isDark ? DEFAULT_DARK_BG : DEFAULT_LIGHT_BG, borderTop: codeCollapsed ? 0 : 1, borderColor: "divider", overflow: "auto", maxHeight: PREVIEW_MAX_HEIGHT, display: "flex", justifyContent: "flex-start", cursor: "pointer", position: "relative", width: displayWidth || "fit-content", maxWidth: "100%" }}
        >
          <Box
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(mathHtml, MATH_SANITIZE_CONFIG) }}
            sx={{ pointerEvents: "none" }}
          />
          {isSelected && editor.isEditable && (
            <Box
              onPointerDown={handleResizePointerDown}
              sx={{
                position: "absolute", right: 0, bottom: 0, width: 16, height: 16,
                cursor: "nwse-resize", bgcolor: "primary.main", opacity: 0.7, borderTopLeftRadius: 4,
                "&:hover": { opacity: 1 },
                clipPath: "polygon(100% 0, 100% 100%, 0 100%)",
              }}
            />
          )}
          {resizing && resizeWidth !== null && (
            <Box sx={{ position: "absolute", bottom: 4, left: "50%", transform: "translateX(-50%)", bgcolor: "rgba(0,0,0,0.7)", color: "white", px: 1, py: 0.25, borderRadius: 1, fontSize: "0.7rem", fontFamily: "monospace", pointerEvents: "none" }}>
              {resizeWidth}px
            </Box>
          )}
        </Box>
      )}
    </CodeBlockFrame>
  );
}
