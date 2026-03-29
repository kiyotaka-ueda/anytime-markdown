import { Box } from "@mui/material";
import React, { useCallback, useEffect, useRef, useState } from "react";

interface SpreadsheetCellProps {
  readonly value: string;
  readonly isSelected: boolean;
  readonly isEditing: boolean;
  readonly isInRange: boolean;
  readonly onSelect: () => void;
  readonly onDoubleClick: () => void;
  readonly onCommit: (value: string) => void;
  readonly onCancel: () => void;
  readonly onKeyNavigation: (key: string, shiftKey: boolean) => void;
  readonly onCharInput: (char: string) => void;
  readonly isDark: boolean;
}

const SpreadsheetCell: React.FC<Readonly<SpreadsheetCellProps>> = ({
  value,
  isSelected,
  isEditing,
  isInRange,
  onSelect,
  onDoubleClick,
  onCommit,
  onCancel,
  onKeyNavigation,
  onCharInput,
  isDark,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [editValue, setEditValue] = useState(value);

  const borderColor = isDark
    ? "rgba(255,255,255,0.12)"
    : "rgba(0,0,0,0.12)";
  const selectedOutline = isDark ? "#5b9bd5" : "#1976d2";

  // Sync editValue when entering edit mode
  useEffect(() => {
    if (isEditing) {
      setEditValue(value);
    }
  }, [isEditing, value]);

  // Auto-focus and select input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (isEditing) {
        return;
      }

      const { key, shiftKey, ctrlKey, metaKey, altKey } = e;

      if (
        key === "ArrowUp" ||
        key === "ArrowDown" ||
        key === "ArrowLeft" ||
        key === "ArrowRight" ||
        key === "Tab"
      ) {
        e.preventDefault();
        onKeyNavigation(key, shiftKey);
        return;
      }

      if (key === "Enter" || key === "F2") {
        e.preventDefault();
        onDoubleClick();
        return;
      }

      if (key === "Delete" || key === "Backspace") {
        e.preventDefault();
        onCommit("");
        return;
      }

      // Printable character: length 1, no modifier keys
      if (key.length === 1 && !ctrlKey && !metaKey && !altKey) {
        e.preventDefault();
        onCharInput(key);
      }
    },
    [isEditing, onKeyNavigation, onDoubleClick, onCommit, onCharInput],
  );

  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      const { key, shiftKey } = e;

      if (key === "Enter") {
        e.preventDefault();
        onCommit(editValue);
        return;
      }

      if (key === "Tab") {
        e.preventDefault();
        onCommit(editValue);
        onKeyNavigation("Tab", shiftKey);
        return;
      }

      if (key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    },
    [editValue, onCommit, onKeyNavigation, onCancel],
  );

  const handleBlur = useCallback(() => {
    if (isEditing) {
      onCommit(editValue);
    }
  }, [isEditing, editValue, onCommit]);

  const rangeBackground = isInRange
    ? isDark
      ? "rgba(91,155,213,0.15)"
      : "rgba(25,118,210,0.08)"
    : undefined;

  return (
    <Box
      component="td"
      tabIndex={isSelected ? 0 : -1}
      onClick={onSelect}
      onDoubleClick={onDoubleClick}
      onKeyDown={handleKeyDown}
      sx={{
        height: 28,
        minWidth: 80,
        maxWidth: 200,
        padding: "0 6px",
        borderRight: `1px solid ${borderColor}`,
        borderBottom: `1px solid ${borderColor}`,
        cursor: "cell",
        userSelect: isEditing ? "auto" : "none",
        outline: isSelected
          ? `2px solid ${selectedOutline}`
          : "none",
        outlineOffset: -2,
        position: "relative",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        fontSize: 13,
        lineHeight: "28px",
        background: rangeBackground,
        boxSizing: "border-box",
      }}
    >
      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleInputKeyDown}
          onBlur={handleBlur}
          style={{
            width: "100%",
            height: "100%",
            background: "transparent",
            color: "inherit",
            border: "none",
            outline: "none",
            font: "inherit",
            padding: 0,
            margin: 0,
          }}
        />
      ) : (
        value
      )}
    </Box>
  );
};

export default React.memo(SpreadsheetCell);
