"use client";

import { Box } from "@mui/material";
import type { NodeViewProps } from "@tiptap/react";
import { NodeViewContent, NodeViewWrapper } from "@tiptap/react";

export function ImageRowNodeView({ selected }: Readonly<NodeViewProps>) {
  return (
    <NodeViewWrapper
      as="div"
      data-image-row=""
      data-selected={selected ? "true" : "false"}
      className="image-row"
    >
      <Box
        component={NodeViewContent}
        sx={{
          display: "flex",
          flexWrap: "wrap",
          gap: 1,
          alignItems: "flex-start",
          my: 1,
        }}
        data-image-row-content=""
      />
    </NodeViewWrapper>
  );
}
