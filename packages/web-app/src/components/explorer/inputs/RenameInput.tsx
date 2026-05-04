"use client";

import { TextField } from "@mui/material";
import { type FC, useEffect, useRef, useState } from "react";

export const RenameInput: FC<{
  currentName: string;
  isDir: boolean;
  onSubmit: (newName: string) => void;
  onCancel: () => void;
}> = ({ currentName, isDir, onSubmit, onCancel }) => {
  const [value, setValue] = useState(currentName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    // 拡張子を除いた部分を選択
    if (inputRef.current) {
      const dotIdx = currentName.lastIndexOf(".");
      const end = !isDir && dotIdx > 0 ? dotIdx : currentName.length;
      inputRef.current.setSelectionRange(0, end);
    }
  }, [currentName, isDir]);

  const handleSubmit = () => {
    const name = value.trim();
    if (!name || name === currentName) { onCancel(); return; }
    onSubmit(name);
  };

  return (
    <TextField
      inputRef={inputRef}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") handleSubmit();
        if (e.key === "Escape") onCancel();
        e.stopPropagation();
      }}
      onClick={(e) => e.stopPropagation()}
      onBlur={handleSubmit}
      variant="standard"
      size="small"
      fullWidth
      slotProps={{
        input: {
          disableUnderline: false,
          sx: { fontSize: "0.78rem", py: 0 },
        },
      }}
    />
  );
};
