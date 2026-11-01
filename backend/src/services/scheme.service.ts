/**
 * Government scheme catalogue and matching.
 *
 * Visibility rule, enforced in one place: business users only ever see schemes
 * with status PUBLISHED. A draft or unverified record must never reach a user
 * as though it were current official information (master spec §27), and the
 * seeded stubs are deliberately NEEDS_VERIFICATION so they stay invisible until
 * an administrator has entered verified data.
 */
import { prisma } from '../lib/prisma';
import { NotFoundError } from '../lib/errors';
import { decimalToNumber, serialize } from '../lib/serialize';
import { matchSchemeToBusiness, type SchemeMatchResult } from '../engines/schemeMatching.engine';
import { getSchemeMatchingThresholds, getSchemeMatchingWeights } from './config.service';
import * as ai from './aiService.client';
import { logger } from '../lib/logger';
import type { ListSchemesQuery } from '../validators/business';
import type { Prisma } from '../../generated/prisma';

/** The only status a business user may see. */
const PUBLIC_STATUS = 'PUBLISHED' as const;

/**
 * Fields safe to expose publicly. `notes` and `verifiedById` are omitted —
 * they are internal administrative annotations.
 */
const publicSchemeSelect = {
  id: true,
  slug: true,
  name: true,
  provider: true,
  ministry: true,
  department: true,
  level: true,
  schemeType: true,
  targetBusinessTypes: true,
  supportedIndustries: true,
  supportedStages: true,
  supportedLocations: true,
  supportedFundingTypes: true,
  supportedPurposes: true,
  minFunding: true,
  maxFunding: true,
  fundingDescription: true,
  description: true,
  eligibilityCriteria: true,
  requiredDocuments: true,
  applicationProcess: true,
  applicationUrl: true,
  officialSourceUrl: true,
  status: true,
  source: true,
  // Exposed so the UI can badge a SYNTHETIC demo record rather than
  // presenting it as ordinary reference data.
  sourceType: true,
  lastVerifiedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.GovernmentSchemeSelect;

export async function listPublishedSchemes(query: ListSchemesQuery) {
  const where: Prisma.GovernmentSchemeWhereInput = { status: PUBLIC_STATUS };

  if (query.level) where.level = query.level;
  if (query.schemeType) where.schemeType = query.schemeType;
  if (query.industry) where.supportedIndustries = { has: query.industry };

  if (query.search) {
    // Prisma parameterises these, so the user's string cannot alter the query.
    where.OR = [
      { name: { contains: query.search, mode: 'insensitive' } },
      { provider: { contains: query.search, mode: 'insensitive' } },
      { description: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  const orderBy: Prisma.GovernmentSchemeOrderByWithRelationInput =
    query.sort === 'recentlyVerified' ? { lastVerifiedAt: 'desc' } : { name: 'asc' };

  // Filtering and pagination happen in SQL, not by loading everything and
  // slicing in JavaScript (master spec §45).
  const [items, total] = await Promise.all([
    prisma.governmentScheme.findMany({
      where,
      orderBy,
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      select: publicSchemeSelect,
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

export async function getPublishedScheme(schemeId: string) {
  const scheme = await prisma.governmentScheme.findFirst({
    where: { id: schemeId, status: PUBLIC_STATUS },
    select: publicSchemeSelect,
  });
  // 404 for an unpublished scheme too: its existence is not public information.
  if (!scheme) throw new NotFoundError('Scheme');
  return serialize(scheme);
}

/**
 * Scores the business description against each scheme description.
 *
 * Returns null — not an array of zeros — when the AI service is unavailable, so
 * the engine can drop the factor and renormalise rather than scoring every
 * scheme as semantically irrelevant.
 */
async function computeSemanticScores(
  business: { description: string | null; problem: string | null; solution: string | null; industry: string | null },
  schemes: Array<{ name: string; description: string | null; supportedIndustries: string[]; supportedPurposes: string[] }>,
): Promise<number[] | null> {
  // The business text has to be substantive for similarity to mean anything.
  // Comparing a two-word description against scheme prose produces noise that
  // looks like signal.
  const businessText = [business.industry, business.description, business.problem, business.solution]
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    .join('\n\n');

  if (businessText.trim().length < 80 || schemes.length === 0) return null;

  const candidates = schemes.map((s) =>
    [s.name, s.description, s.supportedIndustries.join(', '), s.supportedPurposes.join(', ')]
      .filter((v) => v && String(v).trim().length > 0)
      .join('\n'),
  );

  const result = await ai.similarity(businessText, candidates);
  if (!result.ok) {
    logger.info({ reason: result.reason }, 'semantic scoring unavailable; using deterministic factors only');
    return null;
  }

  const byIndex = new Array<number>(schemes.length).fill(0);
  for (const { index, score } of result.value.scores) {
    if (index >= 0 && index < byIndex.length) byIndex[index] = score;
  }
  return byIndex;
}

/**
 * Recomputes matches for one business against every published scheme.
 *
 * Returns a summary rather than the matches themselves; the caller reads them
 * back through `listSchemeMatches`, which applies the surfacing threshold.
 */
export async function recalculateSchemeMatches(businessId: string): Promise<{
  evaluated: number;
  stored: number;
  skippedBelowThreshold: number;
  semanticAvailable: boolean;
}> {
  const business = await prisma.businessProfile.findUnique({
    where: { id: businessId },
    include: { fundingRequirement: true },
  });
  if (!business) throw new NotFoundError('Business profile');

  const [weights, thresholds, schemes] = await Promise.all([
    getSchemeMatchingWeights(),
    getSchemeMatchingThresholds(),
    prisma.governmentScheme.findMany({
      where: { status: PUBLIC_STATUS },
      select: {
        id: true,
        name: true,
        description: true,
        targetBusinessTypes: true,
        supportedIndustries: true,
        supportedStages: true,
        supportedLocations: true,
        supportedFundingTypes: true,
        supportedPurposes: true,
        minFunding: true,
        maxFunding: true,
        eligibilityRules: true,
        eligibilityCriteria: true,
        requiredDocuments: true,
      },
    }),
  ]);

  const businessInput = {
    businessType: business.businessType,
    industry: business.industry,
    subIndustry: business.subIndustry,
    businessStage: business.businessStage,
    location: business.location,
    state: business.state,
    country: business.country,
    foundedYear: business.foundedYear,
    teamSize: business.teamSize,
    annualRevenue: decimalToNumber(business.annualRevenue),
    udyamRegistered: business.udyamRegistered,
    dpiitRecognised: business.dpiitRecognised,
    gstRegistered: business.gstRegistered,
  };

  const requirementInput = {
    amountRequired: business.fundingRequirement
      ? decimalToNumber(business.fundingRequirement.amountRequired)
      : null,
    fundingType: business.fundingRequirement?.fundingType ?? null,
    purpose: business.fundingRequirement?.purpose ?? null,
  };

  // Injected once so every scheme in this run is evaluated against the same
  // year — otherwise a run spanning midnight on 1 January could score two
  // schemes against different ages.
  const currentYear = new Date().getUTCFullYear();
  const configVersion = `${weights.configVersion}+${thresholds.configVersion}`;

  // Semantic relevance, if the AI service is reachable.
  //
  // One batched call scores the business description against every scheme
  // description at once — a call per scheme would be far slower and would load
  // the embedding model's query vector repeatedly.
  //
  // When unavailable, every match is computed from the deterministic factors
  // with the weights renormalised, and the caller is told. No placeholder
  // similarity is ever invented, because a fabricated 0.5 would silently move
  // every score.
  const semanticScores = await computeSemanticScores(business, schemes);

  const results: SchemeMatchResult[] = schemes.map((scheme, index) =>
    matchSchemeToBusiness({
      scheme: {
        ...scheme,
        minFunding: decimalToNumber(scheme.minFunding),
        maxFunding: decimalToNumber(scheme.maxFunding),
      },
      business: businessInput,
      requirement: requirementInput,
      semanticScore: semanticScores?.[index] ?? null,
      weights: weights.value,
      thresholds: thresholds.value,
      currentYear,
    }),
  );

  const semanticAvailable = semanticScores !== null;

  const surfaced = results
    .filter((r) => r.eligibilityScore >= thresholds.value.minimumScoreToSurface)
    .sort((a, b) => b.eligibilityScore - a.eligibilityScore)
    .slice(0, thresholds.value.maxMatchesPerBusiness);

  const surfacedIds = new Set(surfaced.map((r) => r.schemeId));

  await prisma.$transaction([
    // Clear matches that no longer qualify, so a stale high score cannot linger
    // after a profile edit.
    prisma.schemeMatch.deleteMany({
      where: { businessId, schemeId: { notIn: [...surfacedIds] } },
    }),
    ...surfaced.map((r) => {
      const factor = (k: string) => r.factors.find((f) => f.key === k)?.score ?? 0;
      const data = {
        eligibilityScore: r.eligibilityScore,
        businessTypeScore: factor('businessType'),
        industryScore: factor('industry'),
        stageScore: factor('businessStage'),
        locationScore: factor('location'),
        fundingScore: factor('fundingRequirement'),
        purposeScore: factor('purpose'),
        semanticScore: r.factors.some((f) => f.key === 'semanticRelevance') ? factor('semanticRelevance') : null,
        matchedCriteria: r.matchedCriteria,
        missingCriteria: r.missingCriteria,
        blockingIssues: r.blockingIssues,
        status: r.status,
        explanation: r.explanation as unknown as Prisma.InputJsonValue,
        // Null until the LLM verbaliser runs. The UI renders the structured
        // factors directly when absent, so the feature degrades rather than
        // breaking (master spec §40).
        narrative: null,
        modelVersion: r.modelVersion,
        configVersion,
      };
      return prisma.schemeMatch.upsert({
        where: { businessId_schemeId: { businessId, schemeId: r.schemeId } },
        create: { businessId, schemeId: r.schemeId, ...data },
        update: data,
      });
    }),
  ]);

  return {
    evaluated: results.length,
    stored: surfaced.length,
    skippedBelowThreshold: results.length - surfaced.length,
    semanticAvailable,
  };
}

export async function listSchemeMatches(businessId: string) {
  const matches = await prisma.schemeMatch.findMany({
    where: { businessId },
    orderBy: { eligibilityScore: 'desc' },
    include: { scheme: { select: publicSchemeSelect } },
  });
  return serialize(matches);
}

export async function getSchemeMatch(businessId: string, schemeId: string) {
  const match = await prisma.schemeMatch.findUnique({
    where: { businessId_schemeId: { businessId, schemeId } },
    include: { scheme: { select: publicSchemeSelect } },
  });
  if (!match) throw new NotFoundError('Scheme match');
  return serialize(match);
}
