"use client";

import AddIcon from "@mui/icons-material/Add";
import NoteAddIcon from "@mui/icons-material/NoteAdd";
import { Box, IconButton, InputAdornment, TextField } from "@mui/material";
import { useTranslations } from "next-intl";
import { type FC, useEffect, useRef, useState } from "react";

import { INDENT_PX } from "../types";

export const NewFileInput: FC<{
  depth: number;
  onSubmit: (name: string) => void;
  onCancel: () => void;
}> = ({ depth, onSubmit, onCancel }) => {
  const t = useTranslations("Common");
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = () => {
    const name = value.trim();
    if (!name) { onCancel(); return; }
    const finalName = name.endsWith(".md") || name.endsWith(".markdown") ? name : `${name}.md`;
    onSubmit(finalName);
  };

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        pl: 1 + (depth + 1) * (INDENT_PX / 8),
        pr: 0.5,
        py: 0.25,
        minHeight: 28,
      }}
    >
      <Box sx={{ width: 20 }} />
      <NoteAddIcon sx={{ fontSize: 16, color: "primary.main", mr: 0.5, flexShrink: 0 }} />
      <TextField
        inputRef={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSubmit();
          if (e.key === "Escape") onCancel();
        }}
        onBlur={handleSubmit}
        placeholder={t("filenamePlaceholder")}
        variant="standard"
        size="small"
        fullWidth
        slotProps={{
          input: {
            disableUnderline: false,
            sx: { fontSize: "0.78rem", py: 0 },
            endAdornment: (
              <InputAdornment position="end">
                <IconButton size="small" onClick={handleSubmit} sx={{ p: 0.25 }} aria-label={t("createFile")}>
                  <AddIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </InputAdornment>
            ),
          },
        }}
      />
    </Box>
  );
};
