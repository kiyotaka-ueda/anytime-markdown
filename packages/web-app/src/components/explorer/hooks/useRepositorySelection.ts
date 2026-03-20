import { useCallback, useState } from "react";

import { fetchBranches } from "../helpers";
import type { GitHubRepo } from "../types";

interface UseRepositorySelectionArgs {
  loadTree: (repo: GitHubRepo, branch: string) => Promise<void>;
}

export function useRepositorySelection({ loadTree }: UseRepositorySelectionArgs) {
  const [branches, setBranches] = useState<string[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [branchDialogOpen, setBranchDialogOpen] = useState(false);
  const [branchDialogRepo, setBranchDialogRepo] = useState<GitHubRepo | null>(null);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null);

  const handleSelectRepo = useCallback(
    async (repo: GitHubRepo) => {
      setBranchDialogRepo(repo);
      setBranches([]);
      setBranchesLoading(true);
      setBranchDialogOpen(true);
      const b = await fetchBranches(repo.fullName);
      const sorted = [repo.defaultBranch, ...b.filter((n) => n !== repo.defaultBranch)];
      setBranches(sorted);
      setBranchesLoading(false);
    },
    [],
  );

  const handleBranchSelect = useCallback(
    async (branch: string) => {
      const repo = branchDialogRepo;
      if (!repo) return;
      setBranchDialogOpen(false);
      setSelectedRepo(repo);
      setSelectedBranch(branch);
      await loadTree(repo, branch);
    },
    [branchDialogRepo, loadTree],
  );

  const handleBranchDialogClose = useCallback(() => {
    setBranchDialogOpen(false);
    setBranchDialogRepo(null);
  }, []);

  return {
    selectedRepo,
    setSelectedRepo,
    selectedBranch,
    setSelectedBranch,
    branches,
    setBranches,
    branchDialogOpen,
    branchDialogRepo,
    branchesLoading,
    handleSelectRepo,
    handleBranchSelect,
    handleBranchDialogClose,
  };
}
