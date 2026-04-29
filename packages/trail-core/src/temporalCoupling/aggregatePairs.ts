import type {
  AggregatePairsOptions,
  GroupedFileRow,
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
  rows: ReadonlyArray<GroupedFileRow>,
  options: AggregatePairsOptions,
): PairAggregation {
  const empty: PairAggregation = {
    fileChangeCount: new Map(),
    coChange: new Map(),
  };
  if (rows.length === 0) return empty;

  const { minChangeCount, excludePairs, pathFilter } = options;
  const maxFilesPerGroup =
    options.maxFilesPerGroup ?? options.maxFilesPerCommit ?? Infinity;

  const groupToFiles = new Map<string, Set<string>>();
  for (const row of rows) {
    if (!row.groupKey) continue;
    if (pathFilter && !pathFilter(row.filePath)) continue;
    let files = groupToFiles.get(row.groupKey);
    if (!files) {
      files = new Set();
      groupToFiles.set(row.groupKey, files);
    }
    files.add(row.filePath);
  }

  const fileChangeCount = new Map<string, number>();
  for (const files of groupToFiles.values()) {
    if (files.size > maxFilesPerGroup) continue;
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
  for (const files of groupToFiles.values()) {
    if (files.size > maxFilesPerGroup) continue;
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
