// domain/port/IGitService.ts — Git operations port

export interface MergeCommitEntry {
  readonly hash: string;
  readonly subject: string;
  readonly parentHashes: readonly string[];
  readonly mergedAt: string;
}

export interface FileStatEntry {
  readonly filePath: string;
  readonly linesAdded: number;
  readonly linesDeleted: number;
  readonly changeType: string;
}

export interface IGitService {
  getMergeCommits(): readonly MergeCommitEntry[];
  getCommitsInRange(base: string, head: string): readonly string[];
  getAggregateFileStats(commitHashes: readonly string[]): readonly FileStatEntry[];
}
