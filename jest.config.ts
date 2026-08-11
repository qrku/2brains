import type { Config } from 'jest';
import nextJest from 'next/jest.js';

const createJestConfig = nextJest({
  // Load next.config and .env into the test environment.
  dir: './',
});

const config: Config = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  // e2e/ is Playwright's turf; those specs import @playwright/test and must not run under Jest.
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/.next/', '<rootDir>/e2e/'],
  // `json-summary` feeds scripts/coverage-summary.mjs, `lcov` the HTML artifact.
  coverageReporters: ['text-summary', 'json-summary', 'lcov'],
  // A ratchet, not a target: set just under the numbers the suite currently hits, so a
  // change that drops coverage fails loudly instead of eroding it a commit at a time.
  coverageThreshold: {
    global: { statements: 58, branches: 45, functions: 58, lines: 60 },
  },
};

export default createJestConfig(config);
