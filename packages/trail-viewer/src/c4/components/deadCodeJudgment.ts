import type { FileAnalysisApiEntry } from '../hooks/fetchFileAnalysisApi';

export type DeadCodeJudgment = 'strong' | 'review' | 'healthy' | 'ignored';

export interface DeadCodeSignals {
  readonly orphan: boolean;
  readonly fanInZero: boolean;
  readonly noRecentChurn: boolean;
  readonly zeroCoverage: boolean;
  readonly isolatedCommunity: boolean;
}

export interface DeadCodeAggregate {
  readonly score: number;
  readonly judgment: DeadCodeJudgment;
  readonly signals: DeadCodeSignals;
  readonly relatedFiles: readonly { readonly filePath: string; readonly score: number }[];
}

export function aggregateDeadCodeForElement(
  entries: readonly FileAnalysisApiEntry[],
): DeadCodeAggregate {
  if (entries.length === 0) {
    return {
      score: 0,
      judgment: 'healthy',
      signals: {
        orphan: false,
        fanInZero: false,
        noRecentChurn: false,
        zeroCoverage: false,
        isolatedCommunity: false,
      },
      relatedFiles: [],
    };
  }

  const score = Math.max(...entries.map((e) => e.deadCodeScore));
  const allIgnored = entries.every((e) => e.isIgnored);
  const judgment: DeadCodeJudgment = allIgnored
    ? 'ignored'
    : score >= 70
      ? 'strong'
      : score >= 40
        ? 'review'
        : 'healthy';

  const signals: DeadCodeSignals = {
    orphan: entries.some((e) => e.signals.orphan),
    fanInZero: entries.some((e) => e.signals.fanInZero),
    noRecentChurn: entries.some((e) => e.signals.noRecentChurn),
    zeroCoverage: entries.some((e) => e.signals.zeroCoverage),
    isolatedCommunity: entries.some((e) => e.signals.isolatedCommunity),
  };

  const relatedFiles = entries
    .filter((e) => e.deadCodeScore >= 40)
    .sort((a, b) => b.deadCodeScore - a.deadCodeScore)
    .slice(0, 10)
    .map((e) => ({ filePath: e.filePath, score: e.deadCodeScore }));

  return { score, judgment, signals, relatedFiles };
}
