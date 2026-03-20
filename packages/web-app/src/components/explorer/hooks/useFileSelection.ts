import { useCallback, useEffect, useState } from "react";

import { fetchCommits } from "../helpers";
import type { CommitEntry, GitHubRepo } from "../types";

interface UseFileSelectionArgs {
  selectedRepo: GitHubRepo | null;
  selectedBranch: string;
  onSelectFile: (repo: string, filePath: string, branch: string) => void;
  onSelectCommit?: (repo: string, filePath: string, sha: string) => void;
  onSelectCurrentProp?: () => void;
  newCommit?: { sha: string; message: string; author: string; date: string } | null;
}

export function useFileSelection({
  selectedRepo,
  selectedBranch,
  onSelectFile,
  onSelectCommit,
  onSelectCurrentProp,
  newCommit,
}: UseFileSelectionArgs) {
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [commits, setCommits] = useState<CommitEntry[]>([]);
  const [commitsLoading, setCommitsLoading] = useState(false);
  const [selectedSha, setSelectedSha] = useState<string | null>(null);
  const [commitsStale, setCommitsStale] = useState(false);

  // 新しいコミットをリストの先頭に追加
  useEffect(() => {
    if (!newCommit) return;
    setCommits((prev) => {
      if (prev.some((c) => c.sha === newCommit.sha)) return prev;
      return [newCommit, ...prev];
    });
    setCommitsStale(false);
    setSelectedSha(null);
  }, [newCommit]);

  const handleFileSelect = useCallback(
    async (filePath: string) => {
      if (!selectedRepo) return;
      setSelectedFilePath(filePath);
      setSelectedSha(null);
      onSelectFile(selectedRepo.fullName, filePath, selectedBranch);

      // 選択状態を sessionStorage に保存
      try {
        sessionStorage.setItem("explorerSelection", JSON.stringify({
          repo: selectedRepo.fullName,
          branch: selectedBranch,
          filePath,
        }));
      } catch { /* ignore */ }

      // コミット履歴を取得
      setCommitsLoading(true);
      const { commits: commitList, stale } = await fetchCommits(selectedRepo.fullName, filePath, selectedBranch);
      setCommits(commitList);
      setCommitsStale(stale);
      setCommitsLoading(false);
    },
    [selectedRepo, selectedBranch, onSelectFile],
  );

  const handleCommitSelect = useCallback(
    (sha: string) => {
      if (!selectedRepo || !selectedFilePath) return;
      setSelectedSha(sha);
      onSelectCommit?.(selectedRepo.fullName, selectedFilePath, sha);
    },
    [selectedRepo, selectedFilePath, onSelectCommit],
  );

  const handleSelectCurrent = useCallback(() => {
    if (!selectedRepo || !selectedFilePath) return;
    setSelectedSha(null);
    if (onSelectCurrentProp) {
      onSelectCurrentProp();
    } else {
      onSelectFile(selectedRepo.fullName, selectedFilePath, selectedBranch);
    }
  }, [selectedRepo, selectedFilePath, selectedBranch, onSelectFile, onSelectCurrentProp]);

  return {
    selectedFilePath,
    setSelectedFilePath,
    commits,
    setCommits,
    commitsLoading,
    setCommitsLoading,
    selectedSha,
    setSelectedSha,
    commitsStale,
    setCommitsStale,
    handleFileSelect,
    handleCommitSelect,
    handleSelectCurrent,
  };
}
