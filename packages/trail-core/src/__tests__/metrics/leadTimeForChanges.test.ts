import { computeLeadTimeForChanges } from '../../domain/metrics/leadTimeForChanges';
import type { DateRange } from '../../domain/metrics/types';

const range: DateRange = { from: '2026-04-01T00:00:00.000Z', to: '2026-04-30T23:59:59.999Z' };
const prevRange: DateRange = { from: '2026-03-01T00:00:00.000Z', to: '2026-03-31T23:59:59.999Z' };

function makeInputs(pairs: Array<{ msgAt: string; commitAt: string; confidence?: string }>) {
  return {
    messages: pairs.map((p, i) => ({ uuid: `m${i}`, created_at: p.msgAt })),
    messageCommits: pairs.map((p, i) => ({
      message_uuid: `m${i}`,
      detected_at: p.commitAt,
      match_confidence: p.confidence ?? 'high',
    })),
  };
}

describe('computeLeadTimeForChanges', () => {
  it('empty inputs → value=0, sampleSize=0', () => {
    const result = computeLeadTimeForChanges({ messages: [], messageCommits: [] }, range, prevRange, 'day');
    expect(result.value).toBe(0);
    expect(result.sampleSize).toBe(0);
    expect(result.unit).toBe('hours');
  });

  it('single pair → lead time in hours', () => {
    const inputs = makeInputs([{ msgAt: '2026-04-10T00:00:00.000Z', commitAt: '2026-04-10T06:00:00.000Z' }]);
    const result = computeLeadTimeForChanges(inputs, range, prevRange, 'day');
    expect(result.value).toBeCloseTo(6, 1);
    expect(result.sampleSize).toBe(1);
  });

  it('odd number of samples → correct median', () => {
    const inputs = makeInputs([
      { msgAt: '2026-04-10T00:00:00.000Z', commitAt: '2026-04-10T01:00:00.000Z' }, // 1h
      { msgAt: '2026-04-11T00:00:00.000Z', commitAt: '2026-04-11T04:00:00.000Z' }, // 4h
      { msgAt: '2026-04-12T00:00:00.000Z', commitAt: '2026-04-12T10:00:00.000Z' }, // 10h
    ]);
    const result = computeLeadTimeForChanges(inputs, range, prevRange, 'day');
    expect(result.value).toBeCloseTo(4, 1); // median of [1,4,10]
    expect(result.sampleSize).toBe(3);
  });

  it('even number of samples → average of two middle values', () => {
    const inputs = makeInputs([
      { msgAt: '2026-04-10T00:00:00.000Z', commitAt: '2026-04-10T02:00:00.000Z' }, // 2h
      { msgAt: '2026-04-11T00:00:00.000Z', commitAt: '2026-04-11T06:00:00.000Z' }, // 6h
    ]);
    const result = computeLeadTimeForChanges(inputs, range, prevRange, 'day');
    expect(result.value).toBeCloseTo(4, 1); // median of [2,6] = 4
    expect(result.sampleSize).toBe(2);
  });

  it('excludes match_confidence=low', () => {
    const inputs = makeInputs([
      { msgAt: '2026-04-10T00:00:00.000Z', commitAt: '2026-04-10T02:00:00.000Z', confidence: 'low' },
      { msgAt: '2026-04-11T00:00:00.000Z', commitAt: '2026-04-11T06:00:00.000Z', confidence: 'high' },
    ]);
    const result = computeLeadTimeForChanges(inputs, range, prevRange, 'day');
    expect(result.sampleSize).toBe(1);
    expect(result.value).toBeCloseTo(6, 1);
  });

  it('includes realtime, high, medium confidence', () => {
    const inputs = makeInputs([
      { msgAt: '2026-04-10T00:00:00.000Z', commitAt: '2026-04-10T01:00:00.000Z', confidence: 'realtime' },
      { msgAt: '2026-04-11T00:00:00.000Z', commitAt: '2026-04-11T03:00:00.000Z', confidence: 'medium' },
    ]);
    const result = computeLeadTimeForChanges(inputs, range, prevRange, 'day');
    expect(result.sampleSize).toBe(2);
  });

  it('excludes commits whose message is outside the range', () => {
    const inputs = makeInputs([
      { msgAt: '2026-03-01T00:00:00.000Z', commitAt: '2026-03-01T02:00:00.000Z' },
    ]);
    const result = computeLeadTimeForChanges(inputs, range, prevRange, 'day');
    expect(result.sampleSize).toBe(0);
  });

  it('multiple commits per message → each counted as separate sample', () => {
    const inputs = {
      messages: [{ uuid: 'm0', created_at: '2026-04-10T00:00:00.000Z' }],
      messageCommits: [
        { message_uuid: 'm0', detected_at: '2026-04-10T02:00:00.000Z', match_confidence: 'high' },
        { message_uuid: 'm0', detected_at: '2026-04-10T06:00:00.000Z', match_confidence: 'high' },
      ],
    };
    const result = computeLeadTimeForChanges(inputs, range, prevRange, 'day');
    expect(result.sampleSize).toBe(2);
    expect(result.value).toBeCloseTo(4, 1); // median of [2,6]
  });

  it('deltaPct calculated from previous period', () => {
    const currentInputs = makeInputs([
      { msgAt: '2026-04-10T00:00:00.000Z', commitAt: '2026-04-10T04:00:00.000Z' },
    ]);
    const prevInputs = makeInputs([
      { msgAt: '2026-03-10T00:00:00.000Z', commitAt: '2026-03-10T08:00:00.000Z' },
    ]);
    const result = computeLeadTimeForChanges(currentInputs, range, prevRange, 'day', prevInputs);
    expect(result.comparison).toBeDefined();
    expect(result.comparison!.previousValue).toBeCloseTo(8, 1);
    expect(result.comparison!.deltaPct).toBeCloseTo(-50, 1);
  });

  it('deltaPct=null when previous period has no samples', () => {
    const currentInputs = makeInputs([
      { msgAt: '2026-04-10T00:00:00.000Z', commitAt: '2026-04-10T04:00:00.000Z' },
    ]);
    const result = computeLeadTimeForChanges(currentInputs, range, prevRange, 'day', { messages: [], messageCommits: [] });
    expect(result.comparison!.deltaPct).toBeNull();
  });
});
