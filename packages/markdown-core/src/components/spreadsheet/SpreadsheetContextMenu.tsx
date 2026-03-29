import React, { useCallback } from "react";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Divider from "@mui/material/Divider";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import type { Editor } from "@tiptap/react";
import { moveTableRow, moveTableColumn } from "../../utils/tableHelpers";
import type { ContextMenuState, DataRange } from "./spreadsheetTypes";

interface SpreadsheetContextMenuProps {
  readonly contextMenu: ContextMenuState;
  readonly dataRange: DataRange;
  readonly grid: string[][];
  readonly editor: Editor;
  readonly onClose: () => void;
  readonly onInsertRow: (index: number) => void;
  readonly onDeleteRow: (index: number) => void;
  readonly onInsertCol: (index: number) => void;
  readonly onDeleteCol: (index: number) => void;
  readonly onSwapRows: (a: number, b: number) => void;
  readonly onSwapCols: (a: number, b: number) => void;
  readonly setDataRange: (range: DataRange) => void;
  readonly syncCellToProseMirror: (
    row: number,
    col: number,
    value: string,
  ) => void;
  readonly isDark: boolean;
  readonly t: (key: string) => string;
}

export const SpreadsheetContextMenu = React.memo(
  function SpreadsheetContextMenu({
    contextMenu,
    dataRange,
    grid,
    editor,
    onClose,
    onInsertRow,
    onDeleteRow,
    onInsertCol,
    onDeleteCol,
    onSwapRows,
    onSwapCols,
    setDataRange,
    isDark: _isDark,
    t,
  }: Readonly<SpreadsheetContextMenuProps>) {
    const { anchorX, anchorY, target } = contextMenu;

    const handleInsertRowAbove = useCallback(() => {
      const inData = target.index < dataRange.rows;
      if (inData) {
        editor.chain().focus().addRowBefore().run();
        setDataRange({ ...dataRange, rows: dataRange.rows + 1 });
      } else {
        onInsertRow(target.index);
      }
      onClose();
    }, [target, dataRange, editor, onInsertRow, setDataRange, onClose]);

    const handleInsertRowBelow = useCallback(() => {
      const inData = target.index < dataRange.rows;
      if (inData) {
        editor.chain().focus().addRowAfter().run();
        setDataRange({ ...dataRange, rows: dataRange.rows + 1 });
      } else {
        onInsertRow(target.index + 1);
      }
      onClose();
    }, [target, dataRange, editor, onInsertRow, setDataRange, onClose]);

    const handleDeleteRow = useCallback(() => {
      const inData = target.index < dataRange.rows;
      if (inData) {
        editor.chain().focus().deleteRow().run();
        setDataRange({
          ...dataRange,
          rows: Math.max(1, dataRange.rows - 1),
        });
      } else {
        onDeleteRow(target.index);
      }
      onClose();
    }, [target, dataRange, editor, onDeleteRow, setDataRange, onClose]);

    const handleMoveRowUp = useCallback(() => {
      const inData = target.index < dataRange.rows;
      if (inData) {
        moveTableRow(editor, "up");
      } else {
        onSwapRows(target.index, target.index - 1);
      }
      onClose();
    }, [target, dataRange, editor, onSwapRows, onClose]);

    const handleMoveRowDown = useCallback(() => {
      const inData = target.index < dataRange.rows;
      if (inData) {
        moveTableRow(editor, "down");
      } else {
        onSwapRows(target.index, target.index + 1);
      }
      onClose();
    }, [target, dataRange, editor, onSwapRows, onClose]);

    const handleInsertColLeft = useCallback(() => {
      const inData = target.index < dataRange.cols;
      if (inData) {
        editor.chain().focus().addColumnBefore().run();
        setDataRange({ ...dataRange, cols: dataRange.cols + 1 });
      } else {
        onInsertCol(target.index);
      }
      onClose();
    }, [target, dataRange, editor, onInsertCol, setDataRange, onClose]);

    const handleInsertColRight = useCallback(() => {
      const inData = target.index < dataRange.cols;
      if (inData) {
        editor.chain().focus().addColumnAfter().run();
        setDataRange({ ...dataRange, cols: dataRange.cols + 1 });
      } else {
        onInsertCol(target.index + 1);
      }
      onClose();
    }, [target, dataRange, editor, onInsertCol, setDataRange, onClose]);

    const handleDeleteCol = useCallback(() => {
      const inData = target.index < dataRange.cols;
      if (inData) {
        editor.chain().focus().deleteColumn().run();
        setDataRange({
          ...dataRange,
          cols: Math.max(1, dataRange.cols - 1),
        });
      } else {
        onDeleteCol(target.index);
      }
      onClose();
    }, [target, dataRange, editor, onDeleteCol, setDataRange, onClose]);

    const handleMoveColLeft = useCallback(() => {
      const inData = target.index < dataRange.cols;
      if (inData) {
        moveTableColumn(editor, "left");
      } else {
        onSwapCols(target.index, target.index - 1);
      }
      onClose();
    }, [target, dataRange, editor, onSwapCols, onClose]);

    const handleMoveColRight = useCallback(() => {
      const inData = target.index < dataRange.cols;
      if (inData) {
        moveTableColumn(editor, "right");
      } else {
        onSwapCols(target.index, target.index + 1);
      }
      onClose();
    }, [target, dataRange, editor, onSwapCols, onClose]);

    const rotatedIconSx = { transform: "rotate(-90deg)" } as const;

    if (target.type === "row") {
      const maxRowIndex = grid.length - 1;
      return (
        <Menu
          open
          onClose={onClose}
          anchorReference="anchorPosition"
          anchorPosition={{ top: anchorY, left: anchorX }}
        >
          <MenuItem onClick={handleInsertRowAbove}>
            <ListItemIcon>
              <AddIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>{t("spreadsheetInsertRowAbove")}</ListItemText>
          </MenuItem>
          <MenuItem onClick={handleInsertRowBelow}>
            <ListItemIcon>
              <AddIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>{t("spreadsheetInsertRowBelow")}</ListItemText>
          </MenuItem>
          <MenuItem onClick={handleDeleteRow}>
            <ListItemIcon>
              <DeleteIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>{t("spreadsheetDeleteRow")}</ListItemText>
          </MenuItem>
          <Divider />
          <MenuItem
            onClick={handleMoveRowUp}
            disabled={target.index === 0}
          >
            <ListItemIcon>
              <ArrowUpwardIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>{t("spreadsheetMoveRowUp")}</ListItemText>
          </MenuItem>
          <MenuItem
            onClick={handleMoveRowDown}
            disabled={target.index >= maxRowIndex}
          >
            <ListItemIcon>
              <ArrowDownwardIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>{t("spreadsheetMoveRowDown")}</ListItemText>
          </MenuItem>
        </Menu>
      );
    }

    // target.type === "col"
    const maxColIndex = (grid[0]?.length ?? 1) - 1;
    return (
      <Menu
        open
        onClose={onClose}
        anchorReference="anchorPosition"
        anchorPosition={{ top: anchorY, left: anchorX }}
      >
        <MenuItem onClick={handleInsertColLeft}>
          <ListItemIcon>
            <AddIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t("spreadsheetInsertColLeft")}</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleInsertColRight}>
          <ListItemIcon>
            <AddIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t("spreadsheetInsertColRight")}</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleDeleteCol}>
          <ListItemIcon>
            <DeleteIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t("spreadsheetDeleteCol")}</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem
          onClick={handleMoveColLeft}
          disabled={target.index === 0}
        >
          <ListItemIcon>
            <ArrowUpwardIcon fontSize="small" sx={rotatedIconSx} />
          </ListItemIcon>
          <ListItemText>{t("spreadsheetMoveColLeft")}</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={handleMoveColRight}
          disabled={target.index >= maxColIndex}
        >
          <ListItemIcon>
            <ArrowDownwardIcon fontSize="small" sx={rotatedIconSx} />
          </ListItemIcon>
          <ListItemText>{t("spreadsheetMoveColRight")}</ListItemText>
        </MenuItem>
      </Menu>
    );
  },
);
