import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { TextSelection } from "@tiptap/pm/state";

export const CodeBlockNavigation = Extension.create({
  name: "codeBlockNavigation",

  addKeyboardShortcuts() {
    return {
      Escape: ({ editor }) => {
        const { $from } = editor.state.selection;
        if ($from.parent.type.name !== "codeBlock") return false;
        const afterPos = $from.after($from.depth);
        const resolved = editor.state.doc.resolve(
          Math.min(afterPos, editor.state.doc.content.size)
        );
        const sel = TextSelection.near(resolved, 1);
        editor.view.dispatch(
          editor.state.tr.setSelection(sel).scrollIntoView()
        );
        return true;
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("codeBlockNavigation"),
        props: {
          handleKeyDown(view, event) {
            if (event.key !== "ArrowDown" && event.key !== "ArrowUp")
              return false;

            const { state } = view;
            const { $from, empty } = state.selection;

            if (!empty) return false;
            if ($from.parent.type.name === "codeBlock") return false;

            const isDown = event.key === "ArrowDown";

            if (!view.endOfTextblock(isDown ? "down" : "up")) return false;

            const depth = $from.depth;

            if (isDown) {
              let pos = $from.after(depth);
              const startPos = pos;
              while (pos < state.doc.content.size) {
                const $pos = state.doc.resolve(pos);
                const idx = $pos.index($pos.depth);
                if (idx >= $pos.parent.childCount) break;
                const node = $pos.parent.child(idx);
                if (node.type.name !== "codeBlock") break;
                pos += node.nodeSize;
              }
              if (pos === startPos) return false;
              const resolved = state.doc.resolve(
                Math.min(pos, state.doc.content.size)
              );
              const sel = TextSelection.near(resolved, 1);
              view.dispatch(state.tr.setSelection(sel).scrollIntoView());
              return true;
            } else {
              let pos = $from.before(depth);
              const startPos = pos;
              while (pos > 0) {
                const $prev = state.doc.resolve(pos - 1);
                if ($prev.parent.type.name !== "codeBlock") break;
                pos = $prev.before($prev.depth);
              }
              if (pos === startPos) return false;
              const resolved = state.doc.resolve(Math.max(0, pos));
              const sel = TextSelection.near(resolved, -1);
              view.dispatch(state.tr.setSelection(sel).scrollIntoView());
              return true;
            }
          },
        },
      }),
    ];
  },
});
