export type CommitFileRow = {
  commitHash: string;
  filePath: string;
};

export type TemporalCouplingEdge = {
  source: string;
  target: string;
  coChangeCount: number;
  sourceChangeCount: number;
  targetChangeCount: number;
  jaccard: number;
};

export type ComputeTemporalCouplingOptions = {
  minChangeCount: number;
  jaccardThreshold: number;
  topK: number;
  maxFilesPerCommit: number;
  excludePairs?: ReadonlyArray<readonly [string, string]>;
  pathFilter?: (filePath: string) => boolean;
};
