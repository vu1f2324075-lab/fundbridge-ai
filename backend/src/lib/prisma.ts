/**
 * Prisma client singleton.
 *
 * All database access goes through Prisma, which parameterises every query —
 * the project's primary SQL-injection control (spec §30). Raw SQL is permitted
 * only via `$queryRaw` tagged templates, which are also parameterised; string
 * concatenation into SQL is forbidden.
 */
import { PrismaClient } from '../../generated/prisma';
import { env } from '../config/env';
import { logger } from './logger';

const createClient = () =>
  new PrismaClient({
    log: env.isDevelopment
      ? [
          { emit: 'event', level: 'query' },
          { emit: 'event', level: 'warn' },
          { emit: 'event', level: 'error' },
        ]
      : [
          { emit: 'event', level: 'warn' },
          { emit: 'event', level: 'error' },
        ],
  });

// `tsx watch` re-imports modules on change; without this the dev server would
// open a new connection pool on every save until PostgreSQL refused more.
const globalForPrisma = globalThis as unknown as { prisma?: ReturnType<typeof createClient> };

export const prisma = globalForPrisma.prisma ?? createClient();

if (!env.isProduction) globalForPrisma.prisma = prisma;

prisma.$on('warn', (e) => logger.warn({ prisma: e.message }, 'prisma warning'));
// Only the message is logged. Prisma error payloads can echo back query
// parameters, which may contain user financial data.
prisma.$on('error', (e) => logger.error({ prisma: e.message }, 'prisma error'));

if (env.isDevelopment) {
  prisma.$on('query', (e) => {
    // Query text only, never `e.params`.
    logger.debug({ durationMs: e.duration, query: e.query }, 'prisma query');
  });
}

export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
}

export type { PrismaClient } from '../../generated/prisma';
