"use client";

import CommitIcon from "@mui/icons-material/Commit";
import EditIcon from "@mui/icons-material/Edit";
import { Box, CircularProgress, List, ListItemButton, ListItemIcon, ListItemText, Typography } from "@mui/material";
import { useTranslations } from "next-intl";
import type { FC } from "react";

import type { CommitEntry } from "./types";
import { formatCommitDate, truncateMessage } from "./helpers";

interface GitHistorySectionProps {
  commits: CommitEntry[];
  loading: boolean;
  selectedSha: string | null;
  onSelectCommit: (sha: string) => void;
  isDirty?: boolean;
  onSelectCurrent?: () => void;
  stale?: boolean;
}

export const GitHistorySection: FC<GitHistorySectionProps> = ({
  commits, loading, selectedSha, onSelectCommit, isDirty, onSelectCurrent, stale,
}) => {
  const t = useTranslations("Common");
  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
        <CircularProgress size={20} />
      </Box>
    );
  }
  if (commits.length === 0) {
    return (
      <Typography variant="caption" sx={{ py: 2, textAlign: "center", display: "block", color: "text.secondary" }}>
        {t("noCommitHistory")}
      </Typography>
    );
  }
  return (
    <List dense disablePadding>
      {isDirty && onSelectCurrent && (
        <ListItemButton
          selected={selectedSha === null}
          onClick={onSelectCurrent}
          sx={{ py: 0.25, minHeight: 32, alignItems: "flex-start" }}
        >
          <ListItemIcon sx={{ minWidth: 24, mt: 0.5 }}>
            <EditIcon sx={{ fontSize: 16, color: "warning.main" }} />
          </ListItemIcon>
          <ListItemText
            primary={t("editing")}
            primaryTypographyProps={{ variant: "body2", fontSize: "0.78rem", fontStyle: "italic", color: "warning.main" }}
          />
        </ListItemButton>
      )}
      {stale && (
        <Typography
          variant="caption"
          sx={{ display: "block", px: 2, py: 0.5, color: "warning.main", fontSize: "0.7rem" }}
        >
          {t("historyMayBeStale")}
        </Typography>
      )}
      {commits.map((c) => (
        <ListItemButton
          key={c.sha}
          selected={c.sha === selectedSha}
          onClick={() => onSelectCommit(c.sha)}
          sx={{ py: 0.25, minHeight: 32, alignItems: "flex-start" }}
        >
          <ListItemIcon sx={{ minWidth: 24, mt: 0.5 }}>
            <CommitIcon sx={{ fontSize: 16 }} />
          </ListItemIcon>
          <ListItemText
            primary={truncateMessage(c.message)}
            secondary={`${formatCommitDate(c.date)} · ${c.author}`}
            primaryTypographyProps={{ variant: "body2", fontSize: "0.78rem", noWrap: true }}
            secondaryTypographyProps={{ variant: "caption", fontSize: "0.68rem", noWrap: true }}
          />
        </ListItemButton>
      ))}
    </List>
  );
};
