import type { DeadCodeSignals } from './types';

export function computeDeadCodeScore(signals: DeadCodeSignals): number {
  if (signals.isIgnored) return 0;
  let score = 0;
  if (signals.orphan)            score += 45;
  if (signals.fanInZero)         score += 25;
  if (signals.noRecentChurn)     score += 15;
  if (signals.zeroCoverage)      score += 10;
  if (signals.isolatedCommunity) score += 5;
  return score;
}
