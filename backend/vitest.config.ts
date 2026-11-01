/**
 * Unit and middleware tests — no database required, so these run anywhere and
 * stay fast. Integration tests live in `vitest.integration.config.ts`.
 */
import { defineConfig } from 'vitest/config';
import { testEnv, coverageExclude } from './tests/vitest.env';

export default defineConfig({
  test: {
    name: 'unit',
    environment: 'node',
    globals: false,
    include: ['src/**/*.test.ts'],
    env: testEnv,
    coverage: { provider: 'v8', reporter: ['text', 'html'], exclude: coverageExclude },
  },
});
