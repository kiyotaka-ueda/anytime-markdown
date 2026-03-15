"use client";

import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import { Box, IconButton, Tooltip } from "@mui/material";
import DOMPurify from "dompurify";

import { DEFAULT_DARK_BG, DEFAULT_LIGHT_BG } from "../../constants/colors";
import { PREVIEW_MAX_HEIGHT } from "../../constants/dimensions";
import htmlSamples from "../../constants/htmlSamples.json";
import { CodeBlockFullscreenDialog } from "../CodeBlockFullscreenDialog";
import { BlockInlineToolbar } from "./BlockInlineToolbar";
import { CodeBlockFrame } from "./CodeBlockFrame";
import type { CodeBlockSharedProps } from "./types";
import { HTML_SANITIZE_CONFIG } from "./types";

type HtmlPreviewBlockProps = Pick<
  CodeBlockSharedProps,
  | "editor"
  | "codeCollapsed" | "isSelected"
  | "selectNode" | "code"
  | "handleCopyCode" | "handleDeleteBlock" | "deleteDialogOpen" | "setDeleteDialogOpen"
  | "fullscreen" | "setFullscreen" | "fsCode" | "onFsCodeChange" | "fsTextareaRef" | "fsSearch"
  | "t" | "isDark"
> & {
  handleFsTextChange: (newCode: string) => void;
};

export function HtmlPreviewBlock(props: HtmlPreviewBlockProps) {
  const {
    editor,
    codeCollapsed, isSelected,
    selectNode, code,
    handleCopyCode, handleDeleteBlock, deleteDialogOpen, setDeleteDialogOpen,
    fullscreen, setFullscreen, fsCode, onFsCodeChange, fsTextareaRef, fsSearch,
    handleFsTextChange,
    t, isDark,
  } = props;

  const toolbar = (
    <BlockInlineToolbar
      label={t("htmlPreview")}
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
      showBorder={isSelected}
      deleteDialogOpen={deleteDialogOpen}
      setDeleteDialogOpen={setDeleteDialogOpen}
      handleDeleteBlock={handleDeleteBlock}
      t={t}
      afterFrame={
        <CodeBlockFullscreenDialog
          open={fullscreen}
          onClose={() => { fsSearch.reset(); setFullscreen(false); }}
          label={t("htmlPreview")}
          language="html"
          fsCode={fsCode}
          onFsCodeChange={onFsCodeChange}
          onFsTextChange={handleFsTextChange}
          fsTextareaRef={fsTextareaRef}
          fsSearch={fsSearch}
          readOnly={!editor.isEditable}
          customSamples={htmlSamples.filter((s) => s.enabled)}
          renderPreview={(code) => (
            <Box
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(code, HTML_SANITIZE_CONFIG) }}
              sx={{ "& img": { maxWidth: "100%" } }}
            />
          )}
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
      <Box
          role="document"
          aria-label={t("htmlPreview")}
          contentEditable={false}
          onClick={selectNode}
          onDoubleClick={() => setFullscreen(true)}
          sx={{ pt: 0, px: 2, pb: 2, bgcolor: isDark ? DEFAULT_DARK_BG : DEFAULT_LIGHT_BG, borderTop: codeCollapsed ? 0 : 1, borderColor: "divider", overflow: "auto", maxHeight: PREVIEW_MAX_HEIGHT, cursor: "pointer", "& img": { maxWidth: "100%" } }}
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(code, HTML_SANITIZE_CONFIG) }}
        />
    </CodeBlockFrame>
  );
}
