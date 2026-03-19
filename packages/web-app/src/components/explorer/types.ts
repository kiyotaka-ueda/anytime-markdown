export interface GitHubRepo {
  fullName: string;
  private: boolean;
  defaultBranch: string;
}

export interface TreeEntry {
  path: string;
  type: "blob" | "tree";
  name: string;
}

export interface CommitEntry {
  sha: string;
  message: string;
  author: string;
  date: string;
}

export interface ExplorerPanelProps {
  open: boolean;
  width?: number;
  onSelectFile: (repo: string, filePath: string, branch: string) => void;
  onSelectCommit?: (repo: string, filePath: string, sha: string) => void;
  onSelectCurrent?: () => void;
  isDirty?: boolean;
  newCommit?: { sha: string; message: string; author: string; date: string } | null;
}

export type ChildrenCache = Map<string, TreeEntry[]>;
export type HasMdCache = Map<string, boolean>;

export const PANEL_WIDTH = 260;
export const INDENT_PX = 16;
export const PANEL_HEADER_MIN_HEIGHT = 40;
