/**
 * Server entry point.
 *
 * Verifies the database is reachable before accepting traffic, and shuts down
 * gracefully so in-flight requests finish and the connection pool is released.
 */
import { env } from './config/env';
import { logger } from './lib/logger';
import { prisma, disconnectPrisma } from './lib/prisma';
import { createApp } from './app';

async function main(): Promise<void> {
  // Fail at startup with a clear message rather than on the first request with
  // an opaque 503.
  try {
    await prisma.$queryRaw`SELECT 1`;
    logger.info('database connection established');
  } catch (err) {
    logger.fatal(
      { err: err instanceof Error ? err.message : String(err) },
      'cannot reach the database — check DATABASE_URL and that PostgreSQL is running',
    );
    process.exit(1);
  }

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info(
      { port: env.PORT, env: env.NODE_ENV, aiService: env.aiServiceEnabled ? 'configured' : 'not configured' },
      `FundBridge API listening on http://localhost:${env.PORT}`,
    );
  });

  // Slightly above a typical 60s load-balancer idle timeout, so the balancer
  // closes connections first and clients never see a truncated response.
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;

  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'shutting down');

    server.close(() => {
      void disconnectPrisma().finally(() => process.exit(0));
    });

    // Backstop: if connections refuse to drain, exit anyway rather than hang.
    setTimeout(() => {
      logger.warn('forced exit after shutdown timeout');
      process.exit(1);
    }, 10_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // A crash with an unreleased pool is worse than a restart: log and exit so
  // the supervisor can replace the process.
  process.on('unhandledRejection', (reason) => {
    logger.fatal({ reason }, 'unhandled promise rejection');
    shutdown('unhandledRejection');
  });
  process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'uncaught exception');
    shutdown('uncaughtException');
  });
}

void main();
