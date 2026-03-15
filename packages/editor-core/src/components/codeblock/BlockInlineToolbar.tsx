"use client";

import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import FullscreenIcon from "@mui/icons-material/Fullscreen";
import { Box, Divider, IconButton, Tooltip, Typography } from "@mui/material";
import React from "react";

interface BlockInlineToolbarProps {
  /** Block label (e.g. "Mermaid", "Math", "Table") */
  label: string;
  /** Show fullscreen button */
  onFullscreen?: () => void;
  /** Show delete button */
  onDelete?: () => void;
  /** Whether code/content is collapsed */
  collapsed?: boolean;
  /** Extra content between label and spacer */
  extra?: React.ReactNode;
  /** Translation function */
  t: (key: string) => string;
}

const iconSx = { fontSize: 16, color: "text.secondary" };

export function BlockInlineToolbar({
  label, onFullscreen, onDelete, collapsed, extra, t,
}: BlockInlineToolbarProps) {
  return (
    <Box
      data-block-toolbar=""
      role="toolbar"
      aria-label={label}
      sx={{ bgcolor: "action.hover", px: 0.75, py: 0.25, display: "flex", alignItems: "center", gap: 0.25 }}
      contentEditable={false}
    >
      <Box
        data-drag-handle=""
        role="button"
        tabIndex={0}
        aria-roledescription="draggable item"
        aria-label={t("dragHandle")}
        sx={{ cursor: "grab", display: "flex", alignItems: "center", opacity: 0.7, "&:hover, &:focus-visible": { opacity: 1 }, "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main", borderRadius: 0.5 } }}
      >
        <DragIndicatorIcon sx={iconSx} />
      </Box>
      {onFullscreen && !collapsed && (
        <Tooltip title={t("fullscreen")} placement="top">
          <IconButton size="small" sx={{ p: 0.25 }} onClick={onFullscreen} aria-label={t("fullscreen")}>
            <FullscreenIcon sx={iconSx} />
          </IconButton>
        </Tooltip>
      )}
      <Typography variant="caption" sx={{ fontWeight: 600, color: "text.secondary", flexShrink: 0 }}>
        {label}
      </Typography>
      {extra}
      <Box sx={{ flex: 1 }} />
      {onDelete && !collapsed && (<>
        <Divider orientation="vertical" flexItem sx={{ mx: 0.25 }} />
        <Tooltip title={t("delete")} placement="top">
          <IconButton size="small" sx={{ p: 0.25 }} onClick={onDelete} aria-label={t("delete")}>
            <DeleteOutlineIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      </>)}
    </Box>
  );
}
