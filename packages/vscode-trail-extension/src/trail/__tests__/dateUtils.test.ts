import {
  toUTC,
  getTimeZoneOffsetMinutes,
  getSqliteTzOffset,
  resolveEffectiveTimeZone,
} from '../dateUtils';

describe('toUTC', () => {
  it('returns UTC string unchanged', () => {
    expect(toUTC('2026-04-10T00:00:00.000Z')).toBe('2026-04-10T00:00:00.000Z');
  });

  it('converts offset timestamp to UTC', () => {
    expect(toUTC('2026-04-10T09:00:00+09:00')).toBe('2026-04-10T00:00:00.000Z');
  });

  it('converts negative offset timestamp to UTC', () => {
    expect(toUTC('2026-04-09T20:00:00-04:00')).toBe('2026-04-10T00:00:00.000Z');
  });

  it('preserves milliseconds', () => {
    expect(toUTC('2026-03-27T23:23:45.106Z')).toBe('2026-03-27T23:23:45.106Z');
  });

  it('returns empty string for empty input', () => {
    expect(toUTC('')).toBe('');
  });

  it('returns invalid string as-is', () => {
    expect(toUTC('not-a-date')).toBe('not-a-date');
  });
});

describe('getTimeZoneOffsetMinutes', () => {
  const fixed = new Date('2026-04-12T00:00:00.000Z');

  it('returns +540 for Asia/Tokyo (JST, no DST)', () => {
    expect(getTimeZoneOffsetMinutes('Asia/Tokyo', fixed)).toBe(540);
  });

  it('returns 0 for UTC', () => {
    expect(getTimeZoneOffsetMinutes('UTC', fixed)).toBe(0);
  });

  it('returns negative value for west-of-UTC zones', () => {
    expect(getTimeZoneOffsetMinutes('America/New_York', fixed)).toBeLessThan(0);
  });
});

describe('getSqliteTzOffset', () => {
  const fixed = new Date('2026-04-12T00:00:00.000Z');

  it('formats positive offset as "+540 minutes" for Asia/Tokyo', () => {
    expect(getSqliteTzOffset('Asia/Tokyo', fixed)).toBe('+540 minutes');
  });

  it('formats zero offset as "+0 minutes" for UTC', () => {
    expect(getSqliteTzOffset('UTC', fixed)).toBe('+0 minutes');
  });

  it('formats negative offset with minus sign', () => {
    const result = getSqliteTzOffset('America/New_York', fixed);
    expect(result.startsWith('-')).toBe(true);
    expect(result).toMatch(/^-\d+ minutes$/);
  });

  it('falls back to effective timezone when argument omitted', () => {
    const result = getSqliteTzOffset(undefined, fixed);
    expect(result).toMatch(/^[+-]\d+ minutes$/);
  });
});

describe('resolveEffectiveTimeZone', () => {
  const originalTz = process.env.TZ;
  afterEach(() => {
    if (originalTz === undefined) delete process.env.TZ;
    else process.env.TZ = originalTz;
  });

  it('returns process.env.TZ when set', () => {
    process.env.TZ = 'America/Los_Angeles';
    expect(resolveEffectiveTimeZone()).toBe('America/Los_Angeles');
  });

  it('falls back to Asia/Tokyo when TZ unset and Intl returns UTC', () => {
    delete process.env.TZ;
    // Force Intl to return UTC by stubbing resolvedOptions
    const spy = jest
      .spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions')
      .mockReturnValue({ timeZone: 'UTC' } as Intl.ResolvedDateTimeFormatOptions);
    try {
      expect(resolveEffectiveTimeZone()).toBe('Asia/Tokyo');
    } finally {
      spy.mockRestore();
    }
  });
});
