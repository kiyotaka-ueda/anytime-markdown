import { computeClaudeActivityColorMap } from '../claudeActivityColorMap';

describe('computeClaudeActivityColorMap', () => {
  it('active要素はオレンジ色を返す', () => {
    const map = computeClaudeActivityColorMap(['el_a'], [], [], true);
    expect(map.get('el_a')).toBeDefined();
    expect(map.get('el_a')).toMatch(/^rgba/);
  });

  it('touched要素は水色を返す', () => {
    const map = computeClaudeActivityColorMap([], ['el_b'], [], true);
    expect(map.get('el_b')).toBeDefined();
  });

  it('active が touched より優先される', () => {
    const active = computeClaudeActivityColorMap(['el_a'], ['el_a'], [], true);
    const touchedOnly = computeClaudeActivityColorMap([], ['el_a'], [], true);
    expect(active.get('el_a')).not.toBe(touchedOnly.get('el_a'));
  });

  it('どちらにも含まれない要素はマップに存在しない', () => {
    const map = computeClaudeActivityColorMap(['el_a'], ['el_b'], [], true);
    expect(map.has('el_c')).toBe(false);
  });

  it('両配列が空のとき空マップを返す', () => {
    const map = computeClaudeActivityColorMap([], [], [], true);
    expect(map.size).toBe(0);
  });

  it('planned要素は紫色を返す', () => {
    const map = computeClaudeActivityColorMap([], [], ['el_c'], true);
    expect(map.get('el_c')).toBeDefined();
    expect(map.get('el_c')).toMatch(/^rgba/);
  });

  it('active が planned より優先される', () => {
    const withActive = computeClaudeActivityColorMap(['el_a'], [], ['el_a'], true);
    const plannedOnly = computeClaudeActivityColorMap([], [], ['el_a'], true);
    expect(withActive.get('el_a')).not.toBe(plannedOnly.get('el_a'));
  });

  it('touched が planned より優先される', () => {
    const withTouched = computeClaudeActivityColorMap([], ['el_a'], ['el_a'], true);
    const plannedOnly = computeClaudeActivityColorMap([], [], ['el_a'], true);
    expect(withTouched.get('el_a')).not.toBe(plannedOnly.get('el_a'));
  });

  it('全配列が空のとき空マップを返す（3引数版）', () => {
    const map = computeClaudeActivityColorMap([], [], [], true);
    expect(map.size).toBe(0);
  });
});
