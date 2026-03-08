import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";

const reviewModePluginKey = new PluginKey("reviewMode");

/**
 * Review mode extension: blocks document changes while keeping the editor
 * editable (cursor visible, text selectable).
 *
 * Enable/disable via `editor.storage.reviewMode.enabled`.
 * To allow specific transactions (e.g. comment, checkbox), temporarily
 * set `enabled = false` before dispatching.
 */
export const ReviewModeExtension = Extension.create({
  name: "reviewMode",

  addStorage() {
    return {
      enabled: false,
    };
  },

  addProseMirrorPlugins() {
    const ext = this;
    return [
      new Plugin({
        key: reviewModePluginKey,
        filterTransaction(tr) {
          if (!ext.storage.enabled) return true;
          // Allow selection-only transactions (cursor movement, focus, etc.)
          if (!tr.docChanged) return true;
          // Block content changes
          return false;
        },
      }),
    ];
  },
});
