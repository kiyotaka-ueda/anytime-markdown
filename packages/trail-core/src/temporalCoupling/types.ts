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

export type CouplingDirection = 'A→B' | 'B→A' | 'undirected';

export type ConfidenceCouplingEdge = {
  source: string;
  target: string;
  direction: CouplingDirection;
  confidenceForward: number;
  confidenceBackward: number;
  coChangeCount: number;
  sourceChangeCount: number;
  targetChangeCount: number;
  jaccard: number;
};

export type ComputeConfidenceCouplingOptions = {
  minChangeCount: number;
  confidenceThreshold: number;
  directionalDiffThreshold: number;
  topK: number;
  maxFilesPerCommit: number;
  excludePairs?: ReadonlyArray<readonly [string, string]>;
  pathFilter?: (filePath: string) => boolean;
};

export type PairAggregation = {
  fileChangeCount: ReadonlyMap<string, number>;
  coChange: ReadonlyMap<string, number>;
};

export type AggregatePairsOptions = {
  minChangeCount: number;
  maxFilesPerCommit: number;
  excludePairs?: ReadonlyArray<readonly [string, string]>;
  pathFilter?: (filePath: string) => boolean;
};
