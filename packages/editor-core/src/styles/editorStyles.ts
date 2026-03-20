import type { SxProps,Theme } from "@mui/material/styles";

import { getEditorBg, getEditorText } from "../constants/colors";
import { calcPaperContentWidth } from "../constants/dimensions";
import type { PaperSize } from "../constants/dimensions";
import { EDITOR_PADDING_BORDER,EDITOR_PADDING_TOP } from "../constants/dimensions";
import type { EditorSettings } from "../useEditorSettings";
import { getBaseStyles } from "./baseStyles";
import { getBlockStyles } from "./blockStyles";
import { getCodeStyles } from "./codeStyles";
import { getHeadingStyles } from "./headingStyles";
import { getInlineStyles } from "./inlineStyles";

/**
 * WYSIWYG エディタ Paper の sx スタイルを生成する。
 * MarkdownEditorPage から切り出し（M-09 リファクタリング）。
 */
export function getEditorPaperSx(
  theme: Theme,
  settings: EditorSettings,
  editorHeight: number,
  options?: { readonlyMode?: boolean },
): SxProps<Theme> {
  return {
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    overflow: "hidden",
    bgcolor: getEditorBg(theme.palette.mode === "dark", settings),
    "& .tiptap": {
      minHeight: editorHeight - EDITOR_PADDING_TOP,
      maxHeight: editorHeight - EDITOR_PADDING_BORDER,
      overflowY: "auto",
      py: 2,
      pr: 2,
      pl: 5,
      outline: "none",
      fontFamily: "sans-serif",
      fontSize: `${settings.fontSize}px`,
      lineHeight: settings.lineHeight,
      color: getEditorText(theme.palette.mode === "dark", settings),
      ...(getBaseStyles(theme, options) as Record<string, unknown>),
      ...(getHeadingStyles(theme) as Record<string, unknown>),
      ...(getCodeStyles(theme) as Record<string, unknown>),
      ...(getBlockStyles(theme, settings) as Record<string, unknown>),
      ...(getInlineStyles(theme) as Record<string, unknown>),
      // 用紙サイズ制限
      ...(settings.paperSize !== "off" && {
        maxWidth: calcPaperContentWidth(settings.paperSize as Exclude<PaperSize, "off">, settings.paperMargin),
        mx: "auto",
        wordBreak: "break-word",
        overflowWrap: "break-word",
      }),
    },
  };
}
