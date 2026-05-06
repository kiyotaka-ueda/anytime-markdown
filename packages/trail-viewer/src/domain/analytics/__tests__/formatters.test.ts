import {
  fmtDuration,
  fmtDurationShort,
  fmtNum,
  fmtPercent,
  fmtTokens,
  fmtUsd,
  fmtUsdShort,
} from '../formatters';

describe('fmtNum', () => {
  it('整数を桁区切りでフォーマット', () => {
    expect(fmtNum(0)).toBe('0');
    expect(fmtNum(1234)).toBe('1,234');
    expect(fmtNum(1234567)).toBe('1,234,567');
  });
});

describe('fmtUsd', () => {
  it('小数 2 桁の USD 表記', () => {
    expect(fmtUsd(0)).toBe('$0.00');
    expect(fmtUsd(1.5)).toBe('$1.50');
    expect(fmtUsd(123.456)).toBe('$123.46');
  });
});

describe('fmtUsdShort', () => {
  it('1000 未満は通常 USD 表記', () => {
    expect(fmtUsdShort(0)).toBe('$0.00');
    expect(fmtUsdShort(999.99)).toBe('$999.99');
  });
  it('1000 以上は K 単位に丸める', () => {
    expect(fmtUsdShort(1000)).toBe('$1K');
    expect(fmtUsdShort(1500)).toBe('$1.5K');
    expect(fmtUsdShort(12345)).toBe('$12.3K');
  });
});

describe('fmtTokens', () => {
  it('1000 未満はそのまま', () => {
    expect(fmtTokens(0)).toBe('0');
    expect(fmtTokens(999)).toBe('999');
  });
  it('1K / 1M / 1B 単位で短縮', () => {
    expect(fmtTokens(1_000)).toBe('1K');
    expect(fmtTokens(1_500)).toBe('1.5K');
    expect(fmtTokens(1_000_000)).toBe('1M');
    expect(fmtTokens(2_500_000)).toBe('2.5M');
    expect(fmtTokens(1_000_000_000)).toBe('1B');
    expect(fmtTokens(3_700_000_000)).toBe('3.7B');
  });
});

describe('fmtDuration', () => {
  it('60 分未満は分単位で表示', () => {
    expect(fmtDuration(0)).toBe('0m');
    expect(fmtDuration(30 * 60_000)).toBe('30m');
    expect(fmtDuration(59 * 60_000)).toBe('59m');
  });
  it('60 分以上は時間単位、端数は分付き', () => {
    expect(fmtDuration(60 * 60_000)).toBe('1h');
    expect(fmtDuration(90 * 60_000)).toBe('1h30m');
    expect(fmtDuration(120 * 60_000)).toBe('2h');
  });
});

describe('fmtDurationShort', () => {
  it('1000ms 未満は ms 表示', () => {
    expect(fmtDurationShort(0)).toBe('0ms');
    expect(fmtDurationShort(500)).toBe('500ms');
  });
  it('60s 未満は s 表示', () => {
    expect(fmtDurationShort(1_000)).toBe('1s');
    expect(fmtDurationShort(59_000)).toBe('59s');
  });
  it('60m 未満は m 表示（小数 1 桁）', () => {
    expect(fmtDurationShort(60_000)).toBe('1.0m');
    expect(fmtDurationShort(90_000)).toBe('1.5m');
  });
  it('60m 以上は h / hNNm 表示', () => {
    expect(fmtDurationShort(60 * 60_000)).toBe('1h');
    expect(fmtDurationShort(90 * 60_000)).toBe('1h30m');
  });
});

describe('fmtPercent', () => {
  it('比率を整数 % で表示', () => {
    expect(fmtPercent(0)).toBe('0%');
    expect(fmtPercent(0.5)).toBe('50%');
    expect(fmtPercent(1)).toBe('100%');
    expect(fmtPercent(0.123)).toBe('12%');
  });
});
