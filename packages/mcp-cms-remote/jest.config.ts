import type { Config } from 'jest';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const base = require('../../jest.config.base') as Config;
const config: Config = {
  ...base,
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  moduleNameMapper: {
    '^@anytime-markdown/cms-core$': '<rootDir>/../cms-core/src/index.ts',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
export default config;
