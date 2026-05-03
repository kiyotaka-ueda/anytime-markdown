const base = require('../../jest.config.base');
/** @type {import('jest').Config} */
module.exports = {
    ...base,
    preset: 'ts-jest',
    testEnvironment: 'jsdom',
    roots: ['<rootDir>/src'],
    testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
    moduleFileExtensions: ['tsx', 'ts', 'js', 'json'],
    moduleNameMapper: {
        '^@anytime-markdown/trace-core/parse$': '<rootDir>/../trace-core/src/parse/index.ts',
        '^@anytime-markdown/trace-core/analyze$': '<rootDir>/../trace-core/src/analyze/index.ts',
        '^@anytime-markdown/trace-core/types$': '<rootDir>/../trace-core/src/types.ts',
        '^@anytime-markdown/trace-core$': '<rootDir>/../trace-core/src/index.ts',
        '^@anytime-markdown/graph-core$': '<rootDir>/../graph-core/src/index.ts',
    },
};
