export interface DeadCodeSignals {
  readonly orphan: boolean;
  readonly fanInZero: boolean;
  readonly noRecentChurn: boolean;
  readonly zeroCoverage: boolean;
  readonly isolatedCommunity: boolean;
  readonly isIgnored: boolean;
}

export interface FileAnalysisRow {
  readonly repoName: string;
  readonly filePath: string;
  readonly importanceScore: number;
  readonly fanInTotal: number;
  readonly cognitiveComplexityMax: number;
  readonly functionCount: number;
  readonly deadCodeScore: number;
  readonly signals: DeadCodeSignals;
  readonly isIgnored: boolean;
  readonly ignoreReason: string;
  readonly analyzedAt: string;
}

export interface FunctionAnalysisRow {
  readonly repoName: string;
  readonly filePath: string;
  readonly functionName: string;
  readonly startLine: number;
  readonly endLine: number;
  readonly language: string;
  readonly fanIn: number;
  readonly cognitiveComplexity: number;
  readonly dataMutationScore: number;
  readonly sideEffectScore: number;
  readonly lineCount: number;
  readonly importanceScore: number;
  readonly signalFanInZero: boolean;
  readonly analyzedAt: string;
}
