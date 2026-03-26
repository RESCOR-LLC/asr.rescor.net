import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.mjs'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.mjs'],
      exclude: ['src/server.mjs', 'src/setupDatabase.mjs', 'src/configureFromYaml.mjs'],
      reporter: ['text', 'text-summary'],
      thresholds: {
        // Enforce coverage on files that have tests
        perFile: false,
        // Global thresholds — set conservatively to match current coverage
        statements: 15,
        branches: 10,
        functions: 15,
        lines: 15,
      },
    },
  },
});
