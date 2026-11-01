/**
 * Vitest global setup — prepares an isolated database schema for integration tests.
 *
 * Tests run against a dedicated `test` schema inside the development database,
 * rather than a separate database. That is deliberate: the `fundbridge`
 * application role is NOSUPERUSER/NOCREATEDB by design, so it cannot create
 * databases — but it owns the database and can therefore create schemas.
 * Isolation is complete either way and the least-privilege setup stays intact.
 *
 * `prisma db push` is used rather than `migrate deploy` because the test schema
 * needs the current shape, not a replayed history, and pushing is far faster.
 *
 * Two Windows-specific notes:
 *   - This runs in vitest's MAIN process, where the config's `test.env` has not
 *     been applied (that applies to test workers). So the test URL is derived
 *     here with the same helper the workers use, rather than read from the
 *     ambient environment — which would be the developer's real `public` schema.
 *   - Prisma's CLI is invoked as a JS file through the current Node binary.
 *     Spawning `npx.cmd` fails with EINVAL on Node 20+, which refuses to launch
 *     .cmd/.bat without a shell, and enabling a shell would mean quoting paths.
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { testDatabaseUrl } from '../vitest.env';

export default function setup(): void {
  const url = testDatabaseUrl();

  // Belt-and-braces: `db push` is destructive, so it must never be pointed at
  // anything but the test schema.
  if (!/[?&]schema=test(&|$)/.test(url)) {
    throw new Error(`refusing to run db push against a non-test schema: ${url.replace(/:[^:@]+@/, ':***@')}`);
  }

  const schemaPath = path.resolve(__dirname, '../../../prisma/schema.prisma');
  const prismaCli = require.resolve('prisma/build/index.js');

  try {
    execFileSync(
      process.execPath,
      [prismaCli, 'db', 'push', '--schema', schemaPath, '--skip-generate', '--accept-data-loss'],
      {
        env: { ...process.env, DATABASE_URL: url },
        stdio: 'pipe',
        timeout: 180_000,
      },
    );
  } catch (err) {
    const e = err as { stdout?: Buffer; stderr?: Buffer; message?: string };
    const detail = [e.stdout?.toString(), e.stderr?.toString(), e.message].filter(Boolean).join('\n');
    throw new Error(
      [
        'Could not prepare the test schema.',
        '',
        'Integration tests need the development PostgreSQL cluster running:',
        '  npm run db:start',
        '',
        detail,
      ].join('\n'),
    );
  }
}
