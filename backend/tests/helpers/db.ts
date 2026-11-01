/**
 * Integration-test database helpers.
 */
import { prisma } from '../../src/lib/prisma';

/**
 * Tables cleared between tests, children before parents.
 *
 * `TRUNCATE ... CASCADE` on one table would be shorter, but listing them keeps
 * the cleanup explicit: a new model added to the schema shows up here as a
 * deliberate decision rather than being silently wiped (or silently left
 * behind, leaking state into the next test).
 */
const TABLES_IN_DELETION_ORDER = [
  'SchemeDocumentChunk',
  'SchemeDocument',
  'SchemeRevision',
  'ProposalAnalysis',
  'Proposal',
  'InvestorMatch',
  'SchemeMatch',
  'FundingReadiness',
  'ActionPlanItem',
  'Shortlist',
  'SavedOpportunity',
  'Notification',
  'AuditLog',
  'FundingRequirement',
  'BusinessProfile',
  'InvestorProfile',
  'GovernmentScheme',
  'ExperimentRun',
  'MatchingConfig',
  'User',
] as const;

/**
 * The schema to truncate, read from DATABASE_URL.
 *
 * This is resolved explicitly rather than relying on the connection's
 * search_path, and is asserted to be the test schema. Getting this wrong would
 * mean TRUNCATE running against `public` and destroying the developer's seeded
 * data — so it fails loudly instead.
 */
function resolveTestSchema(): string {
  const url = process.env['DATABASE_URL'] ?? '';
  const schema = /[?&]schema=([A-Za-z0-9_]+)/.exec(url)?.[1];

  if (!schema) {
    throw new Error('DATABASE_URL has no ?schema= parameter; refusing to truncate');
  }
  if (schema !== 'test') {
    throw new Error(`refusing to truncate schema "${schema}" — integration tests must target "test"`);
  }
  return schema;
}

/**
 * Empties every table in the test schema. Both the schema name and the table
 * names are validated/constant, never taken from test input, so the
 * interpolation below cannot be steered.
 */
export async function resetDatabase(): Promise<void> {
  const schema = resolveTestSchema();
  const quoted = TABLES_IN_DELETION_ORDER.map((t) => `"${schema}"."${t}"`).join(', ');
  // RESTART IDENTITY keeps sequences predictable across tests.
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE`);
}

export async function disconnect(): Promise<void> {
  await prisma.$disconnect();
}

export { prisma };
