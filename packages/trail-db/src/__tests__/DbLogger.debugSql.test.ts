import { noopDbLogger, type DbLogger } from '../DbLogger';

describe('DbLogger', () => {
  it('noopDbLogger satisfies DbLogger interface including debugSql', () => {
    const logger: DbLogger = noopDbLogger;
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.debugSql).toBe('function');
  });

  it('noopDbLogger.debugSql returns undefined and does not throw', () => {
    expect(noopDbLogger.debugSql({ name: 'q', durationMs: 1 })).toBeUndefined();
    expect(() => noopDbLogger.debugSql(undefined)).not.toThrow();
  });

  it('spread pattern preserves debugSql when overriding other methods', () => {
    const warnMsgs: string[] = [];
    const mock: DbLogger = { ...noopDbLogger, warn: (m: string) => { warnMsgs.push(m); } };
    expect(typeof mock.debugSql).toBe('function');
    mock.warn('hello');
    expect(warnMsgs).toEqual(['hello']);
  });
});
