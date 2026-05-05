import { aggregateScoresToC4 } from '../aggregateScoresToC4';
import type { C4Element } from '../../domain/engine/c4Mapper';

const elements: readonly C4Element[] = [
  { id: 'pkg_a', type: 'container', name: 'a' },
];

describe('aggregateScoresToC4', () => {
  it('要素単位で max 集約', () => {
    const r = aggregateScoresToC4(
      { 'packages/a/foo.ts': 70, 'packages/a/bar.ts': 30 },
      elements,
    );
    expect(r['pkg_a']).toBe(70);
  });

  it('スコア 0 はスキップ', () => {
    const r = aggregateScoresToC4(
      { 'packages/a/foo.ts': 0, 'packages/a/bar.ts': 30 },
      elements,
    );
    expect(r['pkg_a']).toBe(30);
  });

  it('負スコアはスキップ', () => {
    const r = aggregateScoresToC4(
      { 'packages/a/foo.ts': -10, 'packages/a/bar.ts': 50 },
      elements,
    );
    expect(r['pkg_a']).toBe(50);
  });

  it('system は除外', () => {
    const sysCont: readonly C4Element[] = [
      { id: 'sys_root', type: 'system', name: 'root' },
      { id: 'pkg_a', type: 'container', name: 'a', boundaryId: 'sys_root' },
    ];
    const r = aggregateScoresToC4({ 'packages/a/foo.ts': 80 }, sysCont);
    expect(r['pkg_a']).toBe(80);
    expect(r['sys_root']).toBeUndefined();
  });

  it('空の fileScores は空オブジェクトを返す', () => {
    const r = aggregateScoresToC4({}, elements);
    expect(r).toEqual({});
  });

  it('空の elements は空オブジェクトを返す', () => {
    const r = aggregateScoresToC4({ 'packages/a/foo.ts': 70 }, []);
    expect(r).toEqual({});
  });
});
