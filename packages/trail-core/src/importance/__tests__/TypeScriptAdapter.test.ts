import path from 'node:path';
import { TypeScriptAdapter } from '../adapters/TypeScriptAdapter';

const FIXTURE_DIR = path.resolve(__dirname, 'fixtures/importance');

describe('TypeScriptAdapter', () => {
  let adapter: TypeScriptAdapter;

  beforeAll(() => {
    const fixtureFile = path.join(FIXTURE_DIR, 'mutations.ts');
    adapter = new TypeScriptAdapter([fixtureFile]);
  });

  it('extracts function info for all functions in fixture', () => {
    const fixtureFile = path.join(FIXTURE_DIR, 'mutations.ts');
    const functions = adapter.extractFunctions([fixtureFile]);
    const names = functions.map(f => f.name);
    expect(names).toContain('pureAdd');
    expect(names).toContain('mutateManyWays');
    expect(names).toContain('updateGlobal');
    expect(names).toContain('withSideEffects');
  });

  it('sets language to "typescript"', () => {
    const fixtureFile = path.join(FIXTURE_DIR, 'mutations.ts');
    const functions = adapter.extractFunctions([fixtureFile]);
    expect(functions.every(f => f.language === 'typescript')).toBe(true);
  });

  it('sets correct startLine and endLine', () => {
    const fixtureFile = path.join(FIXTURE_DIR, 'mutations.ts');
    const functions = adapter.extractFunctions([fixtureFile]);
    const pureAdd = functions.find(f => f.name === 'pureAdd')!;
    expect(pureAdd.startLine).toBeGreaterThan(0);
    expect(pureAdd.endLine).toBeGreaterThanOrEqual(pureAdd.startLine);
  });

  it('computes higher dataMutationScore for mutateManyWays than pureAdd', () => {
    const fixtureFile = path.join(FIXTURE_DIR, 'mutations.ts');
    const functions = adapter.extractFunctions([fixtureFile]);

    const pureAddFn = functions.find(f => f.name === 'pureAdd')!;
    const mutateFn = functions.find(f => f.name === 'mutateManyWays')!;

    const pureMetrics = adapter.computeMetrics(pureAddFn);
    const mutateMetrics = adapter.computeMetrics(mutateFn);

    expect(mutateMetrics.dataMutationScore).toBeGreaterThan(pureMetrics.dataMutationScore);
  });

  it('computes higher sideEffectScore for withSideEffects than pureAdd', () => {
    const fixtureFile = path.join(FIXTURE_DIR, 'mutations.ts');
    const functions = adapter.extractFunctions([fixtureFile]);

    const pureAddFn = functions.find(f => f.name === 'pureAdd')!;
    const sideEffectFn = functions.find(f => f.name === 'withSideEffects')!;

    const pureMetrics = adapter.computeMetrics(pureAddFn);
    const sideEffectMetrics = adapter.computeMetrics(sideEffectFn);

    expect(sideEffectMetrics.sideEffectScore).toBeGreaterThan(pureMetrics.sideEffectScore);
  });
});

describe('TypeScriptAdapter.fromTsConfig', () => {
  it('creates adapter from tsconfig path', () => {
    const tsconfigPath = path.resolve(__dirname, '../../../tsconfig.json');
    const adapter = TypeScriptAdapter.fromTsConfig(tsconfigPath);
    expect(adapter.language).toBe('typescript');
  });

  it('throws on non-existent tsconfig', () => {
    expect(() =>
      TypeScriptAdapter.fromTsConfig('/path/to/nonexistent/tsconfig.json')
    ).toThrow('Failed to read tsconfig');
  });

  it('extracts functions from files in tsconfig', () => {
    const tsconfigPath = path.resolve(__dirname, '../../../tsconfig.json');
    const adapter = TypeScriptAdapter.fromTsConfig(tsconfigPath);
    const fixtureFile = path.join(FIXTURE_DIR, 'mutations.ts');
    const functions = adapter.extractFunctions([fixtureFile]);
    expect(functions.length).toBeGreaterThan(0);
  });
});
