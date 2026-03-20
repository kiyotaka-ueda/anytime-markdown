"use client";

import FolderIcon from "@mui/icons-material/Folder";
import GitHubIcon from "@mui/icons-material/GitHub";
import LockIcon from "@mui/icons-material/Lock";
import {
  Box,
  Button,
  CircularProgress,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
} from "@mui/material";
import { signIn } from "next-auth/react";
import { useTranslations } from "next-intl";
import type { FC } from "react";

import type { GitHubRepo } from "../types";

interface RepoListSectionProps {
  needsAuth: boolean;
  loading: boolean;
  repos: GitHubRepo[];
  onSelectRepo: (repo: GitHubRepo) => void;
}

export const RepoListSection: FC<RepoListSectionProps> = ({
  needsAuth,
  loading,
  repos,
  onSelectRepo,
}) => {
  const t = useTranslations("Common");

  if (needsAuth) {
    return (
      <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", py: 6, px: 2, gap: 2 }}>
        <GitHubIcon sx={{ fontSize: 48, color: "text.secondary" }} />
        <Button
          variant="contained"
          size="small"
          startIcon={<GitHubIcon />}
          onClick={() => signIn("github")}
          sx={{
            textTransform: "none",
            bgcolor: "#24292f",
            "&:hover": { bgcolor: "#32383f" },
            borderRadius: 2,
            px: 2.5,
            py: 0.75,
          }}
        >
          {t("signInWithGitHub")}
        </Button>
        <Typography variant="caption" sx={{ color: "text.secondary", textAlign: "center", mt: 1, px: 1 }}>
          {t("savingWillCommit")}
        </Typography>
      </Box>
    );
  }

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  return (
    <List dense disablePadding>
      {repos.map((repo) => (
        <ListItemButton
          key={repo.fullName}
          onClick={() => onSelectRepo(repo)}
          sx={{ py: 0.5 }}
        >
          <ListItemIcon sx={{ minWidth: 28 }}>
            {repo.private ? (
              <LockIcon fontSize="small" />
            ) : (
              <FolderIcon fontSize="small" />
            )}
          </ListItemIcon>
          <ListItemText
            primary={repo.fullName}
            primaryTypographyProps={{ variant: "body2", noWrap: true }}
          />
        </ListItemButton>
      ))}
      {repos.length === 0 && (
        <Typography
          variant="body2"
          sx={{ py: 2, textAlign: "center", color: "text.secondary" }}
        >
          {t("noRepositoriesFound")}
        </Typography>
      )}
    </List>
  );
};
