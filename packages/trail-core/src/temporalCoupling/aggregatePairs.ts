import type {
  AggregatePairsOptions,
  CommitFileRow,
  PairAggregation,
} from './types';

export const PAIR_KEY_SEPARATOR = ' ';

export const pairKey = (a: string, b: string): string =>
  a < b ? `${a}${PAIR_KEY_SEPARATOR}${b}` : `${b}${PAIR_KEY_SEPARATOR}${a}`;

export const normalizePair = (
  a: string,
  b: string,
): readonly [string, string] => (a < b ? [a, b] : [b, a]);

export function aggregatePairs(
  rows: ReadonlyArray<CommitFileRow>,
  options: AggregatePairsOptions,
): PairAggregation {
  const empty: PairAggregation = {
    fileChangeCount: new Map(),
    coChange: new Map(),
  };
  if (rows.length === 0) return empty;

  const { minChangeCount, maxFilesPerCommit, excludePairs, pathFilter } =
    options;

  const commitToFiles = new Map<string, Set<string>>();
  for (const row of rows) {
    if (pathFilter && !pathFilter(row.filePath)) continue;
    let files = commitToFiles.get(row.commitHash);
    if (!files) {
      files = new Set();
      commitToFiles.set(row.commitHash, files);
    }
    files.add(row.filePath);
  }

  const fileChangeCount = new Map<string, number>();
  for (const files of commitToFiles.values()) {
    if (files.size > maxFilesPerCommit) continue;
    for (const file of files) {
      fileChangeCount.set(file, (fileChangeCount.get(file) ?? 0) + 1);
    }
  }

  const eligibleFiles = new Set<string>();
  for (const [file, count] of fileChangeCount) {
    if (count >= minChangeCount) eligibleFiles.add(file);
  }
  if (eligibleFiles.size < 2) {
    return { fileChangeCount, coChange: new Map() };
  }

  const excludeKeys = new Set<string>();
  if (excludePairs) {
    for (const [a, b] of excludePairs) excludeKeys.add(pairKey(a, b));
  }

  const coChange = new Map<string, number>();
  for (const files of commitToFiles.values()) {
    if (files.size > maxFilesPerCommit) continue;
    const sorted = [...files].filter((f) => eligibleFiles.has(f)).sort();
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const key = pairKey(sorted[i], sorted[j]);
        if (excludeKeys.has(key)) continue;
        coChange.set(key, (coChange.get(key) ?? 0) + 1);
      }
    }
  }

  return { fileChangeCount, coChange };
}
