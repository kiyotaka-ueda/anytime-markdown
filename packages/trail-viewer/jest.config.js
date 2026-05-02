const base = require('../../jest.config.base');
/** @type {import('jest').Config} */
const config = {
  ...base,
  testEnvironment: "node",
  transform: {
    "^.+\\.tsx?$": "ts-jest",
  },
  testMatch: ["<rootDir>/src/**/__tests__/**/*.test.ts"],
  moduleFileExtensions: ["tsx", "ts", "js", "json"],
  maxWorkers: 1,
};
module.exports = config;
