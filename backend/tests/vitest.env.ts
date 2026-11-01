/**
 * Shared test environment, imported by both vitest configs.
 *
 * `src/config/env.ts` validates `process.env` at import time, so these values
 * must be injected through vitest's `env` option — which is applied before test
 * modules load — rather than from a setup file.
 */
import path from 'node:path';
import dotenv from 'dotenv';

// Loaded so the test run can derive its database URL from the developer's real
// credentials without those credentials being committed anywhere.
dotenv.config({ path: path.resolve(__dirname, '../.env') });

/**
 * Integration tests target a dedicated `test` schema in the development
 * database — never `public`, which holds seeded development data.
 *
 * With no .env present (fresh clone, CI without a database) this yields a
 * placeholder: unit tests never connect so they still pass, and integration
 * tests fail with a clear setup message from globalSetup.
 */
export function testDatabaseUrl(): string {
  const base = process.env['DATABASE_URL'];
  if (!base) return 'postgresql://fundbridge:unset@localhost:5433/fundbridge?schema=test';
  return base.includes('schema=')
    ? base.replace(/schema=[A-Za-z0-9_]+/, 'schema=test')
    : `${base}${base.includes('?') ? '&' : '?'}schema=test`;
}

export const testEnv: Record<string, string> = {
  NODE_ENV: 'test',
  DATABASE_URL: testDatabaseUrl(),
  JWT_SECRET: 'test-only-secret-at-least-32-characters-long',
  JWT_EXPIRES_IN: '7d',
  CORS_ORIGIN: 'http://localhost:5173',
  LOG_LEVEL: 'silent',
  // Blank: no test may depend on a live AI service.
  AI_SERVICE_URL: '',
  TRUST_PROXY: 'false',
  // A directory of its own. Uploads in an integration test write real bytes to
  // disk, and the default would put them in the developer's storage directory
  // alongside genuine proposals.
  STORAGE_LOCAL_DIR: './storage/test-proposals',
};

export const coverageExclude = [
  'generated/**',
  'src/index.ts',
  '**/*.test.ts',
  'vitest.config.ts',
  'vitest.integration.config.ts',
  'tests/**',
];
