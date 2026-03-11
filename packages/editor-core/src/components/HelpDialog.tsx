"use client";

import KeyboardIcon from "@mui/icons-material/Keyboard";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from "@mui/material";

import { KEYBOARD_SHORTCUTS } from "../constants/shortcuts";
import type { TranslationFn } from "../types";

interface HelpDialogProps {
  open: boolean;
  onClose: () => void;
  t: TranslationFn;
}

/** Kbd-style chip for shortcut keys (matches shortcut dialog style) */
function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <Typography
      component="span"
      variant="caption"
      sx={{
        px: 0.75,
        py: 0.25,
        minWidth: 28,
        textAlign: "center",
        bgcolor: "action.selected",
        borderRadius: 0.5,
        fontFamily: "monospace",
        fontSize: "0.75rem",
        fontWeight: 600,
        border: 1,
        borderColor: "divider",
        lineHeight: 1.4,
      }}
    >
      {children}
    </Typography>
  );
}

export function HelpDialog({ open, onClose, t }: HelpDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" aria-labelledby="help-dialog-title">
      <DialogTitle id="help-dialog-title" sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <KeyboardIcon sx={{ color: "text.secondary" }} />
        {t("helpPage")}
      </DialogTitle>
      <DialogContent dividers sx={{ p: 3 }}>
        <Typography variant="body2" sx={{ mb: 2 }}>{t("helpShortcutsDesc")}</Typography>
        {KEYBOARD_SHORTCUTS.map((group) => (
          <Box key={group.categoryKey} sx={{ mb: 2, "&:last-child": { mb: 0 } }}>
            <Typography variant="subtitle2" sx={{ color: "text.secondary", mb: 0.5 }}>
              {t(group.categoryKey)}
            </Typography>
            {group.items.map((item) => (
              <Box
                key={item.keys}
                sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", py: 0.5, px: 1, borderRadius: 0.5, "&:hover": { bgcolor: "action.hover" } }}
              >
                <Typography variant="body2">{t(item.descKey)}</Typography>
                <Box sx={{ display: "flex", gap: 0.5 }}>
                  {item.keys.split("+").map((key) => (
                    <Kbd key={key}>{key}</Kbd>
                  ))}
                </Box>
              </Box>
            ))}
          </Box>
        ))}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">{t("close")}</Button>
      </DialogActions>
    </Dialog>
  );
}
