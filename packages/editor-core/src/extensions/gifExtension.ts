import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";

import { GifNodeView } from "../components/GifNodeView";

export const GifBlock = Node.create({
  name: "gifBlock",
  group: "block",
  draggable: true,
  atom: true,

  addAttributes() {
    return {
      src: { default: null },
      alt: { default: "" },
      width: { default: null },
      gifSettings: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute("data-gif-settings") || null,
        renderHTML: (attributes: Record<string, unknown>) => {
          if (!attributes.gifSettings) return {};
          return { "data-gif-settings": attributes.gifSettings as string };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'img[src$=".gif"]',
        getAttrs: (element: HTMLElement) => {
          const src = element.getAttribute("src");
          if (!src?.endsWith(".gif")) return false;
          return {
            src,
            alt: element.getAttribute("alt") || "",
            width: element.getAttribute("width") || null,
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ["img", mergeAttributes(HTMLAttributes, { src: HTMLAttributes.src })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(GifNodeView);
  },
});
