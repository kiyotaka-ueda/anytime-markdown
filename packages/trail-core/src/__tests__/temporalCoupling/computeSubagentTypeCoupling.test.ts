import { computeSubagentTypeCoupling } from '../../temporalCoupling/computeSubagentTypeCoupling';
import type {
  ComputeTemporalCouplingOptions,
  SubagentTypeFileRow,
} from '../../temporalCoupling/types';

const baseOptions: ComputeTemporalCouplingOptions = {
  minChangeCount: 1,
  jaccardThreshold: 0,
  topK: 100,
  maxFilesPerCommit: 50,
};

describe('computeSubagentTypeCoupling', () => {
  it('returns empty for empty input', () => {
    expect(computeSubagentTypeCoupling([], baseOptions)).toEqual([]);
  });

  it('generates a pair from a single subagent_type touching two files (Jaccard=1.0)', () => {
    const rows: SubagentTypeFileRow[] = [
      { subagentType: 'Explore', filePath: 'a.ts' },
      { subagentType: 'Explore', filePath: 'b.ts' },
    ];
    const result = computeSubagentTypeCoupling(rows, baseOptions);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      source: 'a.ts',
      target: 'b.ts',
      coChangeCount: 1,
      jaccard: 1.0,
    });
  });

  it('aggregates the same pair across two subagent_types', () => {
    const rows: SubagentTypeFileRow[] = [
      { subagentType: 'Explore', filePath: 'a.ts' },
      { subagentType: 'Explore', filePath: 'b.ts' },
      { subagentType: 'code-reviewer', filePath: 'a.ts' },
      { subagentType: 'code-reviewer', filePath: 'b.ts' },
    ];
    const result = computeSubagentTypeCoupling(rows, baseOptions);
    expect(result).toHaveLength(1);
    expect(result[0].coChangeCount).toBe(2);
    expect(result[0].jaccard).toBe(1.0);
  });

  it('respects minChangeCount filter', () => {
    const rows: SubagentTypeFileRow[] = [
      { subagentType: 'Plan', filePath: 'a.ts' },
      { subagentType: 'Plan', filePath: 'b.ts' },
      { subagentType: 'Explore', filePath: 'c.ts' },
      { subagentType: 'Explore', filePath: 'd.ts' },
      { subagentType: 'code-reviewer', filePath: 'c.ts' },
      { subagentType: 'code-reviewer', filePath: 'd.ts' },
    ];
    const result = computeSubagentTypeCoupling(rows, {
      ...baseOptions,
      minChangeCount: 2,
    });
    expect(result).toHaveLength(1);
    expect(result[0].source).toBe('c.ts');
    expect(result[0].target).toBe('d.ts');
  });

  it('respects topK', () => {
    const rows: SubagentTypeFileRow[] = [
      { subagentType: 'Plan', filePath: 'a.ts' },
      { subagentType: 'Plan', filePath: 'b.ts' },
      { subagentType: 'Explore', filePath: 'c.ts' },
      { subagentType: 'Explore', filePath: 'd.ts' },
    ];
    const result = computeSubagentTypeCoupling(rows, { ...baseOptions, topK: 1 });
    expect(result).toHaveLength(1);
  });

  it('respects pathFilter', () => {
    const rows: SubagentTypeFileRow[] = [
      { subagentType: 'Explore', filePath: 'a.ts' },
      { subagentType: 'Explore', filePath: 'b.ts' },
      { subagentType: 'Explore', filePath: 'node_modules/x.js' },
    ];
    const result = computeSubagentTypeCoupling(rows, {
      ...baseOptions,
      pathFilter: (p) => !p.startsWith('node_modules/'),
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ source: 'a.ts', target: 'b.ts' });
  });

  it('skips rows with empty subagentType', () => {
    const rows: SubagentTypeFileRow[] = [
      { subagentType: '', filePath: 'a.ts' },
      { subagentType: '', filePath: 'b.ts' },
      { subagentType: 'Plan', filePath: 'c.ts' },
      { subagentType: 'Plan', filePath: 'd.ts' },
    ];
    const result = computeSubagentTypeCoupling(rows, baseOptions);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ source: 'c.ts', target: 'd.ts' });
  });
});
