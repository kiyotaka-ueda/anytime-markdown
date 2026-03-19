"use client";

import GifIcon from "@mui/icons-material/Gif";
import { Box } from "@mui/material";

import { EditDialogHeader } from "./EditDialogHeader";
import { EditDialogWrapper } from "./EditDialogWrapper";
import type { GifSettings } from "../utils/gifEncoder";

interface GifPlayerDialogProps {
  open: boolean;
  onClose: () => void;
  src: string;
  settings?: GifSettings;
}

/** GIF 再生・編集ダイアログ（Task 6 で本実装） */
export function GifPlayerDialog({ open, onClose, src }: GifPlayerDialogProps) {
  const t = (key: string) => key;

  return (
    <EditDialogWrapper open={open} onClose={onClose} ariaLabelledBy="gif-player-title">
      <EditDialogHeader
        label="GIF Player"
        onClose={onClose}
        icon={<GifIcon sx={{ fontSize: 18 }} />}
        t={t}
      />
      <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "black" }}>
        <img src={src} alt="GIF" style={{ maxWidth: "100%", maxHeight: "100%" }} />
      </Box>
    </EditDialogWrapper>
  );
}
