/**
 * Integration tests — run against a real PostgreSQL schema.
 *
 * Kept in a separate config rather than a vitest project because vitest 2.x
 * does not support the `projects` key, and because these need to run serially:
 * they share one schema and truncate between tests, so parallel files would
 * clobber each other.
 */
import { defineConfig } from 'vitest/config';
import { testEnv, coverageExclude } from './tests/vitest.env';

export default defineConfig({
  test: {
    name: 'integration',
    environment: 'node',
    globals: false,
    include: ['tests/integration/**/*.test.ts'],
    env: testEnv,
    globalSetup: ['tests/setup/globalSetup.ts'],
    fileParallelism: false,
    sequence: { concurrent: false },
    testTimeout: 30_000,
    hookTimeout: 120_000,
    coverage: { provider: 'v8', reporter: ['text', 'html'], exclude: coverageExclude },
  },
});
