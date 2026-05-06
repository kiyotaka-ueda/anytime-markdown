describe('TrailLogger', () => {
  let appendLine: jest.Mock;
  let originalDebugSql: string | undefined;
  let originalDebugPerf: string | undefined;

  beforeEach(() => {
    originalDebugSql = process.env.TRAIL_DEBUG_SQL;
    originalDebugPerf = process.env.TRAIL_DEBUG_PERF;
    delete process.env.TRAIL_DEBUG_SQL;
    delete process.env.TRAIL_DEBUG_PERF;
    // resetModules() を先に実行してから fresh な vscode mock の createOutputChannel を上書きする。
    // 順序が逆だと、TrailLogger が require する vscode は別インスタンスになり override が効かない。
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const vscodeMock = require('vscode') as { window: { createOutputChannel: jest.Mock } };
    appendLine = jest.fn();
    vscodeMock.window.createOutputChannel.mockReturnValue({
      appendLine,
      dispose: jest.fn(),
    });
  });

  afterEach(() => {
    if (originalDebugSql === undefined) delete process.env.TRAIL_DEBUG_SQL;
    else process.env.TRAIL_DEBUG_SQL = originalDebugSql;
    if (originalDebugPerf === undefined) delete process.env.TRAIL_DEBUG_PERF;
    else process.env.TRAIL_DEBUG_PERF = originalDebugPerf;
  });

  describe('info / warn / error (regression)', () => {
    it('info writes [INFO] prefixed line', () => {
      const { TrailLogger } = require('../TrailLogger');
      TrailLogger.info('hello');
      expect(appendLine).toHaveBeenCalledTimes(1);
      expect(appendLine.mock.calls[0][0]).toMatch(/^\[\d{4}-\d{2}-\d{2}T.+Z\] \[INFO\] hello$/);
    });

    it('error includes Error.message and stack', () => {
      const { TrailLogger } = require('../TrailLogger');
      const err = new Error('boom');
      TrailLogger.error('failure', err);
      expect(appendLine).toHaveBeenCalledTimes(2);
      expect(appendLine.mock.calls[0][0]).toContain('[ERROR] failure: boom');
      expect(appendLine.mock.calls[1][0]).toContain('Error: boom');
    });
  });

  describe('debugSql', () => {
    it('is silent when TRAIL_DEBUG_SQL is unset', () => {
      const { TrailLogger } = require('../TrailLogger');
      TrailLogger.debugSql({ name: 'q', durationMs: 1 });
      expect(appendLine).not.toHaveBeenCalled();
    });

    it('is silent when TRAIL_DEBUG_SQL is "0"', () => {
      process.env.TRAIL_DEBUG_SQL = '0';
      const { TrailLogger } = require('../TrailLogger');
      TrailLogger.debugSql({ name: 'q' });
      expect(appendLine).not.toHaveBeenCalled();
    });

    it('writes [DEBUG:SQL] line with JSON-stringified meta when TRAIL_DEBUG_SQL=1', () => {
      process.env.TRAIL_DEBUG_SQL = '1';
      const { TrailLogger } = require('../TrailLogger');
      TrailLogger.debugSql({ name: 'queryFoo', durationMs: 12.5, rowCount: 42 });
      expect(appendLine).toHaveBeenCalledTimes(1);
      const line: string = appendLine.mock.calls[0][0];
      expect(line).toContain('[DEBUG:SQL]');
      expect(line).toContain('"name":"queryFoo"');
      expect(line).toContain('"durationMs":12.5');
      expect(line).toContain('"rowCount":42');
    });

    it('does not affect debugPerf gating', () => {
      process.env.TRAIL_DEBUG_SQL = '1';
      const { TrailLogger } = require('../TrailLogger');
      TrailLogger.debugPerf({ metric: 'firstPaint', ms: 100 });
      expect(appendLine).not.toHaveBeenCalled();
    });
  });

  describe('debugPerf', () => {
    it('is silent when TRAIL_DEBUG_PERF is unset', () => {
      const { TrailLogger } = require('../TrailLogger');
      TrailLogger.debugPerf({ metric: 'firstPaint', ms: 100 });
      expect(appendLine).not.toHaveBeenCalled();
    });

    it('writes [DEBUG:PERF] line with JSON-stringified meta when TRAIL_DEBUG_PERF=1', () => {
      process.env.TRAIL_DEBUG_PERF = '1';
      const { TrailLogger } = require('../TrailLogger');
      TrailLogger.debugPerf({ metric: 'firstPaint', ms: 250 });
      expect(appendLine).toHaveBeenCalledTimes(1);
      const line: string = appendLine.mock.calls[0][0];
      expect(line).toContain('[DEBUG:PERF]');
      expect(line).toContain('"metric":"firstPaint"');
      expect(line).toContain('"ms":250');
    });

    it('does not affect debugSql gating', () => {
      process.env.TRAIL_DEBUG_PERF = '1';
      const { TrailLogger } = require('../TrailLogger');
      TrailLogger.debugSql({ name: 'q' });
      expect(appendLine).not.toHaveBeenCalled();
    });
  });

  describe('formatMeta edge cases', () => {
    it('handles undefined meta gracefully (no extra space)', () => {
      process.env.TRAIL_DEBUG_SQL = '1';
      const { TrailLogger } = require('../TrailLogger');
      TrailLogger.debugSql(undefined);
      const line: string = appendLine.mock.calls[0][0];
      expect(line).toMatch(/\[DEBUG:SQL\]$/);
    });

    it('falls back to String() when JSON.stringify throws (circular reference)', () => {
      process.env.TRAIL_DEBUG_SQL = '1';
      const { TrailLogger } = require('../TrailLogger');
      const circular: { self?: unknown } = {};
      circular.self = circular;
      expect(() => TrailLogger.debugSql(circular)).not.toThrow();
      expect(appendLine).toHaveBeenCalledTimes(1);
    });
  });
});
