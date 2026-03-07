import * as fs from "fs";
import * as path from "path";
import { sanitizeMarkdown, preserveBlankLines } from "../utils/sanitizeMarkdown";
import { getMarkdownFromEditor } from "../types";
import { createTestEditor } from "../testUtils/createTestEditor";
import { Editor } from "@tiptap/core";

describe("debug: file round-trip", () => {
  let editor: Editor;
  afterEach(() => { editor?.destroy(); });

  test("20260306-modeConversion-test-list.md のラウンドトリップ差分を出力", () => {
    const filePath = path.resolve(__dirname, "../../../../docs/20260306-modeConversion-test-list.md");
    const md = fs.readFileSync(filePath, "utf-8");

    const sanitized = sanitizeMarkdown(md);
    const preserved = preserveBlankLines(sanitized);
    editor = createTestEditor({ withMarkdown: true, withTable: true });
    editor.commands.setContent(preserved);
    const result = getMarkdownFromEditor(editor);

    const origRows = md.split("\n");
    const resultRows = result.split("\n");

    const diffs: string[] = [];
    const maxLen = Math.max(origRows.length, resultRows.length);
    for (let i = 0; i < maxLen; i++) {
      if (origRows[i] !== resultRows[i]) {
        diffs.push(`Line ${i + 1}:\n  ORIG: ${JSON.stringify(origRows[i])}\n  RT:   ${JSON.stringify(resultRows[i])}`);
      }
    }
    if (diffs.length > 0) {
      console.log(`=== FILE ROUND-TRIP DIFFERENCES (${diffs.length} lines) ===`);
      diffs.forEach(d => console.log(d));
    }
    expect(diffs).toEqual([]);
  });
});
