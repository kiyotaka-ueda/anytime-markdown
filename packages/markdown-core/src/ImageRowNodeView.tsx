"use client";

import type { NodeViewProps } from "@tiptap/react";
import { NodeViewContent, NodeViewWrapper } from "@tiptap/react";
import { useTranslations } from "next-intl";

export function ImageRowNodeView({ node, selected }: Readonly<NodeViewProps>) {
  const t = useTranslations("MarkdownEditor");
  const count = node.childCount;
  return (
    <NodeViewWrapper
      as="div"
      data-image-row=""
      data-selected={selected ? "true" : "false"}
      className="image-row"
      role="group"
      aria-label={t("imageRowAriaLabel", { count })}
    >
      <NodeViewContent
        as="div"
        className="image-row-content"
        data-image-row-content=""
        style={{
          // DEBUG: 子数に関わらず固定 3 列で grid 動作確認
          display: "grid",
          gridTemplateColumns: `repeat(${count}, 1fr)`,
          gap: 8,
          alignItems: "start",
          margin: "8px 0",
          outline: "3px dashed red",
          // 診断: 親幅の 100% を確保
          width: "100%",
        }}
      />
    </NodeViewWrapper>
  );
}
