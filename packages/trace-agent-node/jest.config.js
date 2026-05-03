const base = require('../../jest.config.base');
/** @type {import('jest').Config} */
module.exports = {
    ...base,
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/src'],
    testMatch: ['**/__tests__/**/*.test.ts'],
    moduleNameMapper: {
        '^@anytime-markdown/trace-core/types$': '<rootDir>/../trace-core/src/types.ts',
        '^@anytime-markdown/trace-core$': '<rootDir>/../trace-core/src/index.ts',
    },
};
