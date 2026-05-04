/**
 * Admonition / Callout Extension
 *
 * StarterKit の Blockquote を拡張し、GitHub 互換の `> [!NOTE]` 記法をサポートする。
 * - parseHTML で data-admonition-type 属性付き blockquote を検出
 * - appendTransaction で setContent / ユーザー入力時の [!TYPE] を検出（初期ロードにも対応）
 * - serialize で `> [!TYPE]` ヘッダーを出力
 *
 * 対応タイプ: NOTE, TIP, IMPORTANT, WARNING, CAUTION
 */
import Blockquote from "@tiptap/extension-blockquote";
import type { Node as PMNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";

const ADMONITION_RE = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/i;
const MAX_BLOCKQUOTE_DEPTH = 6;

interface SerializerState {
  wrapBlock: (delim: string, firstDelim: string | null, node: PMNode, f: () => void) => void;
  renderContent: (node: PMNode) => void;
  write: (content: string) => void;
  ensureNewLine: () => void;
  closeBlock: (node: PMNode) => void;
  out: string;
}

/**
 * blockquote の先頭 paragraph から先頭 stripLen 文字を剥がしたコピーを返す。
 * appendTransaction 未発火経路（new Editor({ content })）からの serialize で
 * admonitionType を fallback 検出した場合に、出力で [!TYPE] 文字列が重複しないよう
 * 元 blockquote から prefix を取り除いたノードを再構築する。
 */
function stripAdmonitionPrefix(blockquote: PMNode, stripLen: number): PMNode {
  const first = blockquote.firstChild;
  if (!first) return blockquote;
  let remaining = stripLen;
  const newInline: PMNode[] = [];
  first.content.forEach((child) => {
    if (remaining <= 0) {
      newInline.push(child);
      return;
    }
    if (child.isText) {
      const text = child.text ?? "";
      if (text.length <= remaining) {
        remaining -= text.length;
        return;
      }
      const sliced = text.slice(remaining);
      newInline.push(first.type.schema.text(sliced, child.marks));
      remaining = 0;
    } else {
      newInline.push(child);
    }
  });
  const newFirst = first.type.create(first.attrs, newInline, first.marks);
  const newChildren: PMNode[] = [newFirst];
  for (let i = 1; i < blockquote.childCount; i++) {
    newChildren.push(blockquote.child(i));
  }
  return blockquote.type.create(blockquote.attrs, newChildren, blockquote.marks);
}

export const AdmonitionBlockquote = Blockquote.extend({
  name: "blockquote", // 既存名を維持して StarterKit の blockquote を置換

  addAttributes() {
    return {
      admonitionType: {
        default: null,
        parseHTML: (el: HTMLElement) => el.dataset.admonitionType,
        renderHTML: (attrs: Record<string, unknown>) =>
          attrs.admonitionType
            ? { "data-admonition-type": attrs.admonitionType }
            : {},
      },
    };
  },

  addKeyboardShortcuts() {
    return {
      Tab: () => {
        const { $from } = this.editor.state.selection;
        let bqDepth = 0;
        for (let d = $from.depth; d > 0; d--) {
          if ($from.node(d).type.name === "blockquote") bqDepth++;
        }
        if (bqDepth >= 1 && bqDepth < MAX_BLOCKQUOTE_DEPTH) {
          return this.editor.chain().wrapIn("blockquote").run();
        }
        return false;
      },
      "Shift-Tab": () => {
        const { $from } = this.editor.state.selection;
        // 外側の blockquote が存在する場合のみ lift
        let bqCount = 0;
        for (let d = $from.depth; d > 0; d--) {
          if ($from.node(d).type.name === "blockquote") bqCount++;
        }
        if (bqCount >= 2) {
          return this.editor.chain().lift("blockquote").run();
        }
        return false;
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("admonitionDetect"),
        appendTransaction(transactions, _oldState, newState) {
          if (!transactions.some((tr) => tr.docChanged)) return null;
          const tr = newState.tr;
          let modified = false;
          const modifications: Array<{
            pos: number;
            type: string;
            deleteFrom: number;
            deleteTo: number;
          }> = [];

          newState.doc.descendants((node, pos) => {
            if (node.type.name !== "blockquote" || node.attrs.admonitionType) return;
            const first = node.firstChild;
            if (first?.type.name !== "paragraph") return;
            const text = first.textContent;
            const match = ADMONITION_RE.exec(text);
            if (!match) return;
            const textStart = pos + 2; // blockquote(1) + paragraph(1)
            modifications.push({
              pos,
              type: match[1].toLowerCase(),
              deleteFrom: textStart,
              deleteTo: textStart + match[0].length,
            });
          });

          if (modifications.length === 0) return null;
          // 後方から処理してポジションずれを防止
          for (let i = modifications.length - 1; i >= 0; i--) {
            const mod = modifications[i];
            tr.setNodeAttribute(mod.pos, "admonitionType", mod.type);
            tr.delete(mod.deleteFrom, mod.deleteTo);
            modified = true;
          }
          return modified ? tr : null;
        },
      }),
    ];
  },

  addStorage() {
    return {
      markdown: {
        serialize(state: SerializerState, node: PMNode) {
          let admonitionType = node.attrs.admonitionType as string | null;
          let renderNode: PMNode = node;

          // appendTransaction 未発火経路（new Editor({ content }) など）から serialize に
          // 到達した場合、admonitionType が null のままだと else 分岐に落ちて
          // ブラケットがエスケープされ `> \[!TYPE\] body` と崩れる。
          // first paragraph の textContent から ADMONITION_RE で type を再導出し、
          // 重複出力防止のため prefix を剥がしたコピーを描画ノードとして使う。
          if (!admonitionType) {
            const first = node.firstChild;
            if (first && first.type.name === "paragraph") {
              const match = ADMONITION_RE.exec(first.textContent);
              if (match) {
                admonitionType = match[1].toLowerCase();
                renderNode = stripAdmonitionPrefix(node, match[0].length);
              }
            }
          }

          if (admonitionType) {
            const type = admonitionType.toUpperCase();
            // firstDelim で [!TYPE] ヘッダー行を出力し、content は通常の > prefix
            state.wrapBlock("> ", `> [!${type}]\n`, renderNode, () => {
              state.renderContent(renderNode);
            });
            // Admonition 間に空行を確保
            state.ensureNewLine();
            if (!state.out.endsWith("\n\n")) {
              state.out += "\n";
            }
          } else {
            state.wrapBlock("> ", null, renderNode, () => {
              state.renderContent(renderNode);
            });
          }
        },
        parse: {},
      },
    };
  },
});
