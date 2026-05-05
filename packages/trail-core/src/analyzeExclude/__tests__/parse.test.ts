import { parseAnalyzeExclude } from '../parse';

describe('parseAnalyzeExclude', () => {
  it('通常行をディレクトリ名として返す', () => {
    const result = parseAnalyzeExclude('__tests__\nfixtures\n');
    expect(result).toEqual(['__tests__', 'fixtures']);
  });

  it('# コメント行を除外する', () => {
    const result = parseAnalyzeExclude('# comment\n__tests__\n');
    expect(result).toEqual(['__tests__']);
  });

  it('空行を除外する', () => {
    const result = parseAnalyzeExclude('\n__tests__\n\nfixtures\n');
    expect(result).toEqual(['__tests__', 'fixtures']);
  });

  it('前後の空白をトリムする', () => {
    const result = parseAnalyzeExclude('  __tests__  \n  fixtures  \n');
    expect(result).toEqual(['__tests__', 'fixtures']);
  });

  it('空文字列で空配列を返す', () => {
    expect(parseAnalyzeExclude('')).toEqual([]);
  });

  it('コメントと空行だけなら空配列を返す', () => {
    expect(parseAnalyzeExclude('# only comments\n\n# another\n')).toEqual([]);
  });
});
