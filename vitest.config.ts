import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    setupFiles: ['tests/global-setup.ts'],
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/pdf-test.ts'],
    // Run tests sequentially to avoid DB conflicts
    // Each test file uses an in-memory SQLite DB that gets reset between tests
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    // Increase timeout for integration tests
    testTimeout: 10000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/index.ts',
        'src/cli.ts',
        'src/entities/**',
        'src/db/**',
      ],
    },
  },
});
