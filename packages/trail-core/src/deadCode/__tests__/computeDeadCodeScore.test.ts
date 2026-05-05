import { computeDeadCodeScore } from '../computeDeadCodeScore';

describe('computeDeadCodeScore', () => {
  const baseSignals = {
    orphan: false, fanInZero: false, noRecentChurn: false,
    zeroCoverage: false, isolatedCommunity: false, isIgnored: false,
  };

  it('全信号 false なら 0', () => {
    expect(computeDeadCodeScore(baseSignals)).toBe(0);
  });

  it('orphan のみで 45', () => {
    expect(computeDeadCodeScore({ ...baseSignals, orphan: true })).toBe(45);
  });

  it('全信号 true で 100', () => {
    expect(computeDeadCodeScore({
      ...baseSignals, orphan: true, fanInZero: true, noRecentChurn: true,
      zeroCoverage: true, isolatedCommunity: true,
    })).toBe(100);
  });

  it('isIgnored が true ならスコアは常に 0', () => {
    expect(computeDeadCodeScore({
      ...baseSignals, orphan: true, fanInZero: true, isIgnored: true,
    })).toBe(0);
  });

  it('orphan + noRecentChurn = 60 (要確認帯)', () => {
    expect(computeDeadCodeScore({
      ...baseSignals, orphan: true, noRecentChurn: true,
    })).toBe(60);
  });
});
