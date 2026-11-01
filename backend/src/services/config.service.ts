/**
 * Scoring-configuration access.
 *
 * Engines never import weights from code — they read the active row from
 * `MatchingConfig` through here, so an admin can retune scoring without a
 * deploy and every stored score records which configuration produced it.
 *
 * Values are validated on read as well as on write: a row edited directly in
 * the database must not be able to feed a malformed weight set into scoring.
 * An invalid or missing row falls back to the code default rather than failing
 * the user's request, and says so in the log.
 */
import {
  CONFIG_DEFAULTS,
  CONFIG_KEYS,
  CONFIG_SCHEMAS,
  CONFIG_VERSION,
  type ConfigKey,
  type InvestorMatchingWeights,
  type ReadinessCategories,
  type ReadinessWeights,
  type SchemeMatchingThresholds,
  type SchemeMatchingWeights,
} from '../config/matching';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';

interface CacheEntry {
  value: unknown;
  version: number;
  loadedAt: number;
}

/**
 * Short in-process cache. Scoring reads these on every match, and a 30-second
 * window keeps an admin change visible promptly without a database round trip
 * per scheme comparison.
 */
const CACHE_TTL_MS = 30_000;
const cache = new Map<ConfigKey, CacheEntry>();

/** Clears the cache so an admin write takes effect immediately. */
export function invalidateConfigCache(key?: ConfigKey): void {
  if (key) cache.delete(key);
  else cache.clear();
}

async function load<T>(key: ConfigKey): Promise<{ value: T; version: number }> {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.loadedAt < CACHE_TTL_MS) {
    return { value: cached.value as T, version: cached.version };
  }

  const row = await prisma.matchingConfig.findFirst({
    where: { key, active: true },
    orderBy: { version: 'desc' },
    select: { value: true, version: true },
  });

  const schema = CONFIG_SCHEMAS[key];

  if (!row) {
    // Not seeded yet. Use the code default rather than refusing to score.
    logger.warn({ key }, 'no active scoring config row; using code default');
    const fallback = schema.parse(CONFIG_DEFAULTS[key]) as T;
    cache.set(key, { value: fallback, version: 0, loadedAt: Date.now() });
    return { value: fallback, version: 0 };
  }

  const parsed = schema.safeParse(row.value);
  if (!parsed.success) {
    logger.error(
      { key, version: row.version, issues: parsed.error.issues.map((i) => i.message) },
      'stored scoring config is invalid; falling back to code default',
    );
    const fallback = schema.parse(CONFIG_DEFAULTS[key]) as T;
    cache.set(key, { value: fallback, version: 0, loadedAt: Date.now() });
    return { value: fallback, version: 0 };
  }

  cache.set(key, { value: parsed.data, version: row.version, loadedAt: Date.now() });
  return { value: parsed.data as T, version: row.version };
}

/**
 * The configuration an engine run was performed with, including the stamp
 * written to the derived row.
 */
export interface ResolvedConfig<T> {
  value: T;
  /** e.g. "config-v1/3" — code contract version plus the database row version. */
  configVersion: string;
}

function stamp<T>(loaded: { value: T; version: number }): ResolvedConfig<T> {
  return { value: loaded.value, configVersion: `${CONFIG_VERSION}/${loaded.version}` };
}

export async function getSchemeMatchingWeights(): Promise<ResolvedConfig<SchemeMatchingWeights>> {
  return stamp(await load<SchemeMatchingWeights>(CONFIG_KEYS.schemeMatchingWeights));
}

export async function getSchemeMatchingThresholds(): Promise<ResolvedConfig<SchemeMatchingThresholds>> {
  return stamp(await load<SchemeMatchingThresholds>(CONFIG_KEYS.schemeMatchingThresholds));
}

export async function getInvestorMatchingWeights(): Promise<ResolvedConfig<InvestorMatchingWeights>> {
  return stamp(await load<InvestorMatchingWeights>(CONFIG_KEYS.investorMatchingWeights));
}

export async function getReadinessWeights(): Promise<ResolvedConfig<ReadinessWeights>> {
  return stamp(await load<ReadinessWeights>(CONFIG_KEYS.readinessWeights));
}

export async function getReadinessCategories(): Promise<ResolvedConfig<ReadinessCategories>> {
  return stamp(await load<ReadinessCategories>(CONFIG_KEYS.readinessCategories));
}

/** Every config key with its active value — for the admin configuration screen. */
export async function listActiveConfig(): Promise<
  Array<{ key: ConfigKey; version: number; value: unknown; isDefault: boolean }>
> {
  const rows = await prisma.matchingConfig.findMany({
    where: { active: true },
    orderBy: [{ key: 'asc' }, { version: 'desc' }],
    select: { key: true, version: true, value: true, notes: true, updatedAt: true },
  });

  return Object.values(CONFIG_KEYS).map((key) => {
    const row = rows.find((r) => r.key === key);
    return {
      key,
      version: row?.version ?? 0,
      value: row?.value ?? CONFIG_DEFAULTS[key],
      // True when nothing is stored and the code default is in use.
      isDefault: !row,
    };
  });
}
