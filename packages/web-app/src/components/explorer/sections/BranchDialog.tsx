"use client";

import AccountTreeIcon from "@mui/icons-material/AccountTree";
import {
  Box,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
} from "@mui/material";
import { useTranslations } from "next-intl";
import type { FC } from "react";

import type { GitHubRepo } from "../types";

interface BranchDialogProps {
  open: boolean;
  onClose: () => void;
  repo: GitHubRepo | null;
  branches: string[];
  loading: boolean;
  onSelectBranch: (branch: string) => void;
}

export const BranchDialog: FC<BranchDialogProps> = ({
  open,
  onClose,
  repo,
  branches,
  loading,
  onSelectBranch,
}) => {
  const t = useTranslations("Common");

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="xs"
    >
      <DialogTitle sx={{ fontSize: "0.9rem", pb: 0 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <AccountTreeIcon sx={{ fontSize: 18 }} />
          {repo?.fullName}
        </Box>
      </DialogTitle>
      <DialogContent sx={{ px: 1, py: 1 }}>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress size={24} />
          </Box>
        ) : (
          <List dense disablePadding>
            {branches.map((branch) => (
              <ListItemButton
                key={branch}
                onClick={() => onSelectBranch(branch)}
                sx={{ py: 0.5, borderRadius: 1 }}
              >
                <ListItemIcon sx={{ minWidth: 28 }}>
                  <AccountTreeIcon sx={{ fontSize: 16 }} />
                </ListItemIcon>
                <ListItemText
                  primary={branch}
                  primaryTypographyProps={{
                    variant: "body2",
                    fontWeight:
                      branch === repo?.defaultBranch
                        ? 700
                        : 400,
                  }}
                />
                {branch === repo?.defaultBranch && (
                  <Typography
                    variant="caption"
                    sx={{ color: "text.secondary", fontSize: "0.65rem" }}
                  >
                    {t("defaultBranch")}
                  </Typography>
                )}
              </ListItemButton>
            ))}
          </List>
        )}
      </DialogContent>
    </Dialog>
  );
};
