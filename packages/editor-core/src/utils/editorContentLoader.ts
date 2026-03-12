import type { Editor } from "@tiptap/react";

import type { InlineComment } from "./commentHelpers";
import { preprocessMarkdown } from "./frontmatterHelpers";

interface ApplyResult {
  frontmatter: string | null;
  comments: Map<string, InlineComment>;
  body: string;
}

/**
 * Markdown テキストを前処理してエディタに適用する共通関数。
 * preprocessMarkdown → setContent → initComments を一括実行する。
 */
export function applyMarkdownToEditor(editor: Editor, text: string): ApplyResult {
  const { frontmatter, comments, body } = preprocessMarkdown(text);
  editor.commands.setContent(body);
  if (comments.size > 0) {
    editor.commands.initComments(comments);
  }
  return { frontmatter, comments, body };
}
