/**
 * Administrative operations.
 *
 * Two invariants run through this file:
 *
 * 1. **Provenance is never overwritten in place.** Every scheme edit snapshots
 *    the previous values into `SchemeRevision` first, so the history of a
 *    government record is recoverable and an incorrect edit can be examined.
 * 2. **Every mutation is audited.** The caller passes the actor; nothing here
 *    writes without recording who did it.
 */
import { prisma } from '../lib/prisma';
import { ConflictError, NotFoundError, PreconditionFailedError, ValidationError } from '../lib/errors';
import { serialize } from '../lib/serialize';
import { CONFIG_SCHEMAS, type ConfigKey } from '../config/matching';
import { invalidateConfigCache } from './config.service';
import { recordAudit } from './audit.service';
import * as rag from './rag.service';
import type { Prisma, SchemeStatus } from '../../generated/prisma';

// ---------------------------------------------------------------------------
// Scheme lifecycle
// ---------------------------------------------------------------------------

/**
 * Permitted status transitions.
 *
 * Enumerated rather than free-form so a scheme cannot jump from DRAFT straight
 * to PUBLISHED without passing verification — which is the entire purpose of
 * having a lifecycle.
 */
const ALLOWED_TRANSITIONS: Record<SchemeStatus, SchemeStatus[]> = {
  DRAFT: ['NEEDS_VERIFICATION', 'ARCHIVED'],
  NEEDS_VERIFICATION: ['VERIFIED', 'DRAFT', 'ARCHIVED'],
  VERIFIED: ['PUBLISHED', 'NEEDS_VERIFICATION', 'ARCHIVED'],
  PUBLISHED: ['NEEDS_REVERIFICATION', 'ARCHIVED'],
  NEEDS_REVERIFICATION: ['VERIFIED', 'PUBLISHED', 'ARCHIVED'],
  ARCHIVED: ['DRAFT'],
};

/** Fields a scheme must have before it can be verified. */
const VERIFICATION_REQUIRED_FIELDS = [
  'name',
  'provider',
  'officialSourceUrl',
  'eligibilityCriteria',
] as const;

export async function listSchemesForAdmin(query: {
  page: number;
  limit: number;
  status?: SchemeStatus;
  search?: string;
}) {
  const where: Prisma.GovernmentSchemeWhereInput = {};
  if (query.status) where.status = query.status;
  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: 'insensitive' } },
      { provider: { contains: query.search, mode: 'insensitive' } },
      { slug: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.governmentScheme.findMany({
      where,
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      include: { _count: { select: { matches: true, revisions: true, documents: true } } },
    }),
    prisma.governmentScheme.count({ where }),
  ]);

  return {
    items: serialize(items),
    meta: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    },
  };
}

export async function getSchemeForAdmin(schemeId: string) {
  const scheme = await prisma.governmentScheme.findUnique({
    where: { id: schemeId },
    include: {
      revisions: { orderBy: { createdAt: 'desc' }, take: 20 },
      documents: {
        select: {
          id: true,
          title: true,
          sourceType: true,
          sourceUrl: true,
          status: true,
          indexedAt: true,
          embeddingModel: true,
          _count: { select: { chunks: true } },
        },
      },
      _count: { select: { matches: true } },
    },
  });
  if (!scheme) throw new NotFoundError('Scheme');
  return serialize(scheme);
}

/**
 * Updates a scheme, snapshotting the previous values first.
 *
 * The snapshot is taken inside the same transaction as the update, so there is
 * no window in which a change exists without its history.
 */
export async function updateScheme(
  schemeId: string,
  input: Record<string, unknown>,
  actor: { id: string; ip?: string | null },
  reason?: string,
) {
  const existing = await prisma.governmentScheme.findUnique({ where: { id: schemeId } });
  if (!existing) throw new NotFoundError('Scheme');

  const data: Prisma.GovernmentSchemeUpdateInput = {};
  for (const [k, v] of Object.entries(input)) {
    if (v !== undefined) (data as Record<string, unknown>)[k] = v;
  }

  if (Object.keys(data).length === 0) {
    throw new ValidationError('No fields were provided to update.');
  }

  // Editing a published scheme invalidates its verification: the published text
  // is no longer what was checked. Dropping it back to NEEDS_REVERIFICATION is
  // what stops an unreviewed edit reaching users.
  const editedFields = Object.keys(data);
  const substantive = editedFields.some(
    (f) => !['notes', 'status'].includes(f),
  );
  if (existing.status === 'PUBLISHED' && substantive && data.status === undefined) {
    data.status = 'NEEDS_REVERIFICATION';
  }

  const [, updated] = await prisma.$transaction([
    prisma.schemeRevision.create({
      data: {
        schemeId,
        // The full previous row, so a bad edit is fully reversible.
        snapshot: serialize(existing) as unknown as Prisma.InputJsonValue,
        changedBy: actor.id,
        reason: reason ?? `Fields updated: ${editedFields.join(', ')}`,
      },
    }),
    prisma.governmentScheme.update({ where: { id: schemeId }, data }),
  ]);

  await recordAudit({
    actorId: actor.id,
    action: 'scheme.updated',
    entity: 'GovernmentScheme',
    entityId: schemeId,
    metadata: { fields: editedFields, statusAfter: updated.status },
    ip: actor.ip,
  });

  return serialize(updated);
}

/**
 * Moves a scheme through its lifecycle.
 *
 * Verification additionally requires the record to be complete — marking an
 * empty record VERIFIED would defeat the purpose and is refused.
 */
export async function transitionScheme(
  schemeId: string,
  target: SchemeStatus,
  actor: { id: string; ip?: string | null },
  reason?: string,
) {
  const scheme = await prisma.governmentScheme.findUnique({ where: { id: schemeId } });
  if (!scheme) throw new NotFoundError('Scheme');

  if (scheme.status === target) {
    throw new ConflictError(`This scheme is already ${target}.`);
  }

  const allowed = ALLOWED_TRANSITIONS[scheme.status];
  if (!allowed.includes(target)) {
    throw new PreconditionFailedError(
      `A ${scheme.status} scheme cannot move to ${target}. Allowed: ${allowed.join(', ') || 'none'}.`,
    );
  }

  if (target === 'VERIFIED') {
    const missing = VERIFICATION_REQUIRED_FIELDS.filter((field) => {
      const value = scheme[field];
      return Array.isArray(value) ? value.length === 0 : !value;
    });
    if (missing.length > 0) {
      throw new PreconditionFailedError(
        'This scheme cannot be verified until its details have been entered from the official source.',
        { missingFields: missing },
      );
    }
  }

  const data: Prisma.GovernmentSchemeUpdateInput = { status: target };
  if (target === 'VERIFIED') {
    data.lastVerifiedAt = new Date();
    data.verifiedById = actor.id;
  }

  const [, updated] = await prisma.$transaction([
    prisma.schemeRevision.create({
      data: {
        schemeId,
        snapshot: serialize(scheme) as unknown as Prisma.InputJsonValue,
        changedBy: actor.id,
        reason: reason ?? `Status ${scheme.status} to ${target}`,
      },
    }),
    prisma.governmentScheme.update({ where: { id: schemeId }, data }),
  ]);

  await recordAudit({
    actorId: actor.id,
    action:
      target === 'VERIFIED'
        ? 'scheme.verified'
        : target === 'ARCHIVED'
          ? 'scheme.archived'
          : 'scheme.updated',
    entity: 'GovernmentScheme',
    entityId: schemeId,
    metadata: { from: scheme.status, to: target },
    ip: actor.ip,
  });

  // Publishing makes a scheme retrievable, so its index entry must exist;
  // archiving must remove it so retrieval cannot surface a withdrawn scheme.
  let indexNote: string | null = null;
  if (target === 'PUBLISHED') {
    const result = await rag.indexScheme(schemeId);
    indexNote = result.indexed
      ? `Indexed ${result.chunks} chunks for retrieval.`
      : `Not indexed: ${result.reason ?? 'unknown reason'}`;
  } else if (target === 'ARCHIVED') {
    await prisma.schemeDocument.updateMany({
      where: { schemeId },
      data: { status: 'ARCHIVED' },
    });
    const { count } = await prisma.schemeDocumentChunk.deleteMany({
      where: { document: { schemeId } },
    });
    indexNote = `Removed ${count} chunks from the retrieval index.`;
    // Matches against an archived scheme would show users a withdrawn
    // opportunity.
    await prisma.schemeMatch.deleteMany({ where: { schemeId } });
  }

  return { scheme: serialize(updated), indexNote };
}

export async function getSchemeRevisions(schemeId: string) {
  return serialize(
    await prisma.schemeRevision.findMany({
      where: { schemeId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
  );
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export async function listUsers(query: { page: number; limit: number; role?: string; search?: string }) {
  const where: Prisma.UserWhereInput = {};
  if (query.role) where.role = query.role as Prisma.UserWhereInput['role'];
  if (query.search) {
    where.OR = [
      { email: { contains: query.search, mode: 'insensitive' } },
      { name: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      // passwordHash is never selected, even for an admin.
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        lastLoginAt: true,
        createdAt: true,
        businessProfile: { select: { id: true, businessName: true } },
        investorProfile: { select: { id: true, investorName: true, verification: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return {
    items: serialize(items),
    meta: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    },
  };
}

/**
 * Suspends or reactivates a user.
 *
 * An admin cannot suspend themselves — locking the last administrator out of
 * the system is not a recoverable state through the UI.
 */
export async function setUserStatus(
  userId: string,
  status: 'ACTIVE' | 'SUSPENDED',
  actor: { id: string; ip?: string | null },
) {
  if (userId === actor.id) {
    throw new ValidationError('You cannot change your own account status.');
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true, status: true } });
  if (!user) throw new NotFoundError('User');

  if (user.role === 'ADMIN' && status === 'SUSPENDED') {
    const activeAdmins = await prisma.user.count({ where: { role: 'ADMIN', status: 'ACTIVE' } });
    if (activeAdmins <= 1) {
      throw new PreconditionFailedError('At least one active administrator must remain.');
    }
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { status },
    select: { id: true, email: true, role: true, status: true },
  });

  await recordAudit({
    actorId: actor.id,
    action: status === 'SUSPENDED' ? 'user.suspended' : 'user.reactivated',
    entity: 'User',
    entityId: userId,
    metadata: { role: user.role },
    ip: actor.ip,
  });

  return serialize(updated);
}

// ---------------------------------------------------------------------------
// Matching configuration
// ---------------------------------------------------------------------------

/**
 * Stores a new version of a scoring configuration key.
 *
 * The value is validated against the same schema the engines use, so an invalid
 * weight set cannot be stored at all. A new version row is created rather than
 * the old one edited, which keeps historical scores interpretable via their
 * recorded `configVersion`.
 */
export async function updateMatchingConfig(
  key: ConfigKey,
  value: unknown,
  actor: { id: string; ip?: string | null },
  notes?: string,
) {
  const schema = CONFIG_SCHEMAS[key];
  if (!schema) throw new ValidationError('Unknown configuration key.');

  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new ValidationError('The configuration is not valid.', {
      issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
  }

  const latest = await prisma.matchingConfig.findFirst({
    where: { key },
    orderBy: { version: 'desc' },
    select: { version: true },
  });
  const nextVersion = (latest?.version ?? 0) + 1;

  const [, created] = await prisma.$transaction([
    // Only one version of a key is active at a time.
    prisma.matchingConfig.updateMany({ where: { key, active: true }, data: { active: false } }),
    prisma.matchingConfig.create({
      data: {
        key,
        version: nextVersion,
        active: true,
        value: parsed.data as Prisma.InputJsonValue,
        notes: notes ?? null,
        updatedBy: actor.id,
      },
    }),
  ]);

  // The engines cache config for 30 seconds; clear it so the change applies now.
  invalidateConfigCache(key);

  await recordAudit({
    actorId: actor.id,
    action: 'matching_config.updated',
    entity: 'MatchingConfig',
    entityId: created.id,
    metadata: { key, version: nextVersion },
    ip: actor.ip,
  });

  return serialize(created);
}

export async function getConfigHistory(key: ConfigKey) {
  return serialize(
    await prisma.matchingConfig.findMany({
      where: { key },
      orderBy: { version: 'desc' },
      take: 20,
    }),
  );
}

// ---------------------------------------------------------------------------
// Data quality
// ---------------------------------------------------------------------------

/**
 * Data-quality report over the scheme dataset.
 *
 * Counts only — no interpretation. A scheme missing its eligibility criteria is
 * reported as such rather than being quietly treated as unrestricted.
 */
export async function getDataQualityReport() {
  const [
    total,
    byStatus,
    missingApplicationUrl,
    missingFundingRange,
    missingEligibility,
    missingDocuments,
    neverVerified,
    syntheticRecords,
    bySourceTypeRows,
    staleVerification,
  ] = await Promise.all([
    prisma.governmentScheme.count(),
    prisma.governmentScheme.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.governmentScheme.count({ where: { applicationUrl: null } }),
    prisma.governmentScheme.count({ where: { minFunding: null, maxFunding: null } }),
    prisma.governmentScheme.count({ where: { eligibilityCriteria: { isEmpty: true } } }),
    prisma.governmentScheme.count({ where: { requiredDocuments: { isEmpty: true } } }),
    prisma.governmentScheme.count({ where: { lastVerifiedAt: null } }),
    prisma.governmentScheme.count({ where: { sourceType: 'SYNTHETIC' } }),
    // Provenance is the single most important property of this dataset, so it
    // is reported directly. It must never be inferred as "total minus
    // synthetic": that lumps unverified SEED placeholders in with genuinely
    // sourced records and overstates how much of the data is trustworthy.
    prisma.governmentScheme.groupBy({ by: ['sourceType'], _count: { _all: true } }),
    prisma.governmentScheme.count({
      where: {
        status: 'PUBLISHED',
        // Published but unverified for six months: scheme terms change, so this
        // is the queue an administrator should work through.
        lastVerifiedAt: { lt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000) },
      },
    }),
  ]);

  // Candidate duplicates by normalised name, computed in SQL.
  const duplicates = await prisma.$queryRaw<Array<{ normalised: string; count: bigint }>>`
    SELECT lower(regexp_replace(name, '[^a-zA-Z0-9]', '', 'g')) AS normalised,
           COUNT(*)::bigint AS count
    FROM "GovernmentScheme"
    GROUP BY normalised
    HAVING COUNT(*) > 1
  `;

  const [businesses, businessesMissingFinancials, businessesMissingRequirement] = await Promise.all([
    prisma.businessProfile.count(),
    prisma.businessProfile.count({ where: { annualRevenue: null } }),
    prisma.businessProfile.count({ where: { fundingRequirement: null } }),
  ]);

  const [proposals, extracted, extractionFailed, analysed] = await Promise.all([
    prisma.proposal.count(),
    prisma.proposal.count({ where: { status: { in: ['EXTRACTED', 'ANALYSING', 'ANALYSED'] } } }),
    prisma.proposal.count({ where: { status: 'EXTRACTION_FAILED' } }),
    prisma.proposal.count({ where: { status: 'ANALYSED' } }),
  ]);

  return {
    schemes: {
      total,
      byStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count._all])),
      missingApplicationUrl,
      missingFundingRange,
      missingEligibility,
      missingDocuments,
      neverVerified,
      staleVerification,
      syntheticRecords,
      bySourceType: Object.fromEntries(
        bySourceTypeRows.map((r) => [r.sourceType, r._count._all]),
      ) as Record<string, number>,
      duplicateCandidates: duplicates.map((d) => ({ normalisedName: d.normalised, count: Number(d.count) })),
    },
    businesses: {
      total: businesses,
      missingFinancials: businessesMissingFinancials,
      missingFundingRequirement: businessesMissingRequirement,
    },
    proposals: { total: proposals, extracted, extractionFailed, analysed },
  };
}

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

export async function listAuditLogs(query: {
  page: number;
  limit: number;
  action?: string;
  entity?: string;
}) {
  const where: Prisma.AuditLogWhereInput = {};
  if (query.action) where.action = query.action;
  if (query.entity) where.entity = query.entity;

  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      include: { actor: { select: { id: true, email: true, role: true } } },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    items: serialize(items),
    meta: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    },
  };
}

/**
 * Security overview: failed logins and recent privileged actions.
 *
 * Failed-login counts are grouped by IP rather than by attempted email, so the
 * screen surfaces brute-force sources without compiling a list of addresses
 * someone tried.
 */
export async function getSecurityOverview() {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [failedLogins, recentFailures, adminActions, suspendedUsers] = await Promise.all([
    prisma.auditLog.count({ where: { action: 'auth.login_failed', createdAt: { gte: since } } }),
    prisma.$queryRaw<Array<{ ip: string | null; count: bigint }>>`
      SELECT ip, COUNT(*)::bigint AS count
      FROM "AuditLog"
      WHERE action = 'auth.login_failed' AND "createdAt" >= ${since}
      GROUP BY ip
      ORDER BY count DESC
      LIMIT 10
    `,
    prisma.auditLog.count({
      where: {
        action: { in: ['scheme.verified', 'scheme.archived', 'user.suspended', 'matching_config.updated'] },
        createdAt: { gte: since },
      },
    }),
    prisma.user.count({ where: { status: 'SUSPENDED' } }),
  ]);

  return {
    windowHours: 24,
    failedLogins,
    failedLoginsByIp: recentFailures.map((r) => ({ ip: r.ip ?? 'unknown', count: Number(r.count) })),
    privilegedActions: adminActions,
    suspendedUsers,
  };
}

// ---------------------------------------------------------------------------
// System status
// ---------------------------------------------------------------------------

/** What is actually running, for the admin monitoring screen. */
export async function getSystemStatus() {
  const [aiHealth, ragStats, counts] = await Promise.all([
    (await import('./aiService.client')).health(),
    rag.getIndexStats(),
    Promise.all([
      prisma.user.count(),
      prisma.businessProfile.count(),
      prisma.investorProfile.count(),
      prisma.governmentScheme.count({ where: { status: 'PUBLISHED' } }),
      prisma.schemeMatch.count(),
      prisma.fundingReadiness.count(),
      prisma.proposal.count(),
    ]),
  ]);

  const [users, businesses, investors, publishedSchemes, schemeMatches, readinessRecords, proposals] = counts;

  return {
    aiService: aiHealth.ok
      ? {
          reachable: true,
          version: aiHealth.value.version,
          embeddings: aiHealth.value.embeddings_available,
          embeddingModel: aiHealth.value.embedding_model,
          llm: aiHealth.value.llm_available,
          llmModel: aiHealth.value.llm_model,
        }
      : { reachable: false, reason: aiHealth.reason },
    rag: ragStats,
    data: { users, businesses, investors, publishedSchemes, schemeMatches, readinessRecords, proposals },
  };
}
