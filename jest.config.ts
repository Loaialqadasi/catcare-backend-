import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  // Handle the team-member folder naming convention
  // Map .js imports to .ts files for NodeNext compatibility
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        // Disable the TS151002 warning for NodeNext module kind
        diagnostics: {
          ignoreCodes: [151002],
        },
      },
    ],
  },
};

export default config;
