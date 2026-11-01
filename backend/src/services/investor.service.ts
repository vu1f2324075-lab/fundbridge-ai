/**
 * Investor module.
 *
 * THE PRIVACY BOUNDARY THIS FILE ENFORCES
 * ---------------------------------------
 * An investor sees a deliberately narrow view of a business. `discoverySelect`
 * is the only shape ever returned, and it excludes:
 *
 *   - the owner's name, email and user id
 *   - exact financial figures (revenue, expenses, profit, debt)
 *   - uploaded proposals and their extracted text
 *   - anything from a business whose owner set `discoverable = false`
 *
 * Financial position is conveyed as a coarse band instead, which is enough for
 * an investor to judge fit without exposing a small company's accounts to anyone
 * who registers. Proposals are shared only when the owner has shortlisted
 * nothing — there is no mechanism here for an investor to pull a document they
 * were not given.
 */
import { prisma } from '../lib/prisma';
import { ConflictError, NotFoundError, ValidationError } from '../lib/errors';
import { decimalToNumber, serialize } from '../lib/serialize';
import { matchInvestorToBusiness } from '../engines/investorMatching.engine';
import { getInvestorMatchingWeights } from './config.service';
import type { Prisma } from '../../generated/prisma';

/** The only business fields an investor may ever see. */
const discoverySelect = {
  id: true,
  businessName: true,
  businessType: true,
  industry: true,
  subIndustry: true,
  location: true,
  state: true,
  country: true,
  foundedYear: true,
  businessStage: true,
  teamSize: true,
  description: true,
  problem: true,
  solution: true,
  targetCustomer: true,
  productStatus: true,
  customerCount: true,
  // Non-exact signals only.
  growthRate: true,
  partnerships: true,
  certifications: true,
  intellectualProperty: true,
  founderExperience: true,
  teamStrength: true,
  udyamRegistered: true,
  dpiitRecognised: true,
  createdAt: true,
  updatedAt: true,
  fundingRequirement: {
    select: {
      amountRequired: true,
      currency: true,
      purpose: true,
      fundingType: true,
      preferredTimeline: true,
      preferredLocation: true,
    },
  },
  // Deliberately absent: userId, annualRevenue, annualExpenses, profitLoss,
  // existingFunding, existingDebt, marketSize, registrationNumber, customers,
  // proposals.
} satisfies Prisma.BusinessProfileSelect;

/**
 * Revenue as a band rather than a figure.
 *
 * An investor needs to know roughly where a business sits; they do not need its
 * exact turnover, and publishing that to every registered investor would be a
 * disproportionate disclosure of commercially sensitive information.
 */
function revenueBand(revenue: number | null): string {
  if (revenue === null) return 'Not disclosed';
  if (revenue <= 0) return 'Pre-revenue';
  if (revenue < 500_000) return 'Under ₹5 lakh';
  if (revenue < 2_500_000) return '₹5–25 lakh';
  if (revenue < 10_000_000) return '₹25 lakh–1 crore';
  if (revenue < 50_000_000) return '₹1–5 crore';
  return 'Over ₹5 crore';
}

type RawBusiness = Prisma.BusinessProfileGetPayload<{ select: typeof discoverySelect }>;

/** Adds the derived band and strips Decimal objects. */
function toDiscoveryView(business: RawBusiness, revenue: number | null) {
  return {
    ...serialize(business),
    revenueBand: revenueBand(revenue),
  };
}

// ---------------------------------------------------------------------------
// Investor profile
// ---------------------------------------------------------------------------

export async function getInvestorProfile(investorId: string) {
  const profile = await prisma.investorProfile.findUnique({ where: { id: investorId } });
  if (!profile) throw new NotFoundError('Investor profile');
  return serialize(profile);
}

export async function updateInvestorProfile(investorId: string, input: Record<string, unknown>) {
  const data: Prisma.InvestorProfileUpdateInput = {};
  for (const [k, v] of Object.entries(input)) {
    if (v !== undefined) (data as Record<string, unknown>)[k] = v;
  }
  if (Object.keys(data).length === 0) {
    throw new ValidationError('No fields were provided to update.');
  }

  const updated = await prisma.investorProfile.update({ where: { id: investorId }, data });

  // Preferences changed, so stored matches were computed against the old ones.
  await prisma.investorMatch.deleteMany({ where: { investorId } });

  return serialize(updated);
}

// ---------------------------------------------------------------------------
// Discovery
// ---------------------------------------------------------------------------

/**
 * Lists discoverable businesses.
 *
 * `discoverable: true` is a non-negotiable part of the where clause. A business
 * owner who opts out is invisible here regardless of any filter the investor
 * supplies.
 */
export async function discoverBusinesses(query: {
  page: number;
  limit: number;
  industry?: string;
  businessStage?: string;
  state?: string;
  minAmount?: number;
  maxAmount?: number;
  search?: string;
}) {
  const where: Prisma.BusinessProfileWhereInput = { discoverable: true };

  if (query.industry) where.industry = { contains: query.industry, mode: 'insensitive' };
  if (query.businessStage) where.businessStage = query.businessStage as never;
  if (query.state) where.state = { contains: query.state, mode: 'insensitive' };
  if (query.search) {
    where.OR = [
      { businessName: { contains: query.search, mode: 'insensitive' } },
      { industry: { contains: query.search, mode: 'insensitive' } },
      { description: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  if (query.minAmount !== undefined || query.maxAmount !== undefined) {
    where.fundingRequirement = {
      amountRequired: {
        ...(query.minAmount !== undefined ? { gte: query.minAmount } : {}),
        ...(query.maxAmount !== undefined ? { lte: query.maxAmount } : {}),
      },
    };
  }

  const [rows, total] = await Promise.all([
    prisma.businessProfile.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      // annualRevenue is selected only to derive the band, and is dropped before
      // the value leaves this function.
      select: { ...discoverySelect, annualRevenue: true },
    }),
    prisma.businessProfile.count({ where }),
  ]);

  const items = rows.map((row) => {
    const { annualRevenue, ...rest } = row;
    return toDiscoveryView(rest as RawBusiness, decimalToNumber(annualRevenue));
  });

  return {
    items,
    meta: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    },
  };
}

export async function getBusinessForInvestor(businessId: string) {
  const row = await prisma.businessProfile.findFirst({
    // 404 for a non-discoverable business: its existence is not disclosed.
    where: { id: businessId, discoverable: true },
    select: { ...discoverySelect, annualRevenue: true },
  });
  if (!row) throw new NotFoundError('Business');

  const { annualRevenue, ...rest } = row;
  return toDiscoveryView(rest as RawBusiness, decimalToNumber(annualRevenue));
}

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

/**
 * Recomputes this investor's matches across discoverable businesses.
 *
 * Only businesses that have stated a funding requirement are considered: without
 * one there is nothing to assess cheque-size fit against, and including them
 * would fill the list with unscoreable entries.
 */
export async function recalculateInvestorMatches(investorId: string): Promise<{
  evaluated: number;
  stored: number;
}> {
  const investor = await prisma.investorProfile.findUnique({ where: { id: investorId } });
  if (!investor) throw new NotFoundError('Investor profile');

  const [weights, businesses] = await Promise.all([
    getInvestorMatchingWeights(),
    prisma.businessProfile.findMany({
      where: { discoverable: true, fundingRequirement: { isNot: null } },
      select: {
        id: true,
        industry: true,
        subIndustry: true,
        businessStage: true,
        location: true,
        state: true,
        country: true,
        fundingRequirement: { select: { amountRequired: true, fundingType: true } },
      },
    }),
  ]);

  const investorInput = {
    id: investor.id,
    investorName: investor.investorName,
    investorType: investor.investorType,
    industries: investor.industries,
    preferredStages: investor.preferredStages as unknown as string[],
    preferredLocations: investor.preferredLocations,
    fundingTypes: investor.fundingTypes as unknown as string[],
    minInvestment: decimalToNumber(investor.minInvestment),
    maxInvestment: decimalToNumber(investor.maxInvestment),
  };

  const results = businesses.map((business) =>
    matchInvestorToBusiness({
      investor: investorInput,
      business: {
        industry: business.industry,
        subIndustry: business.subIndustry,
        businessStage: business.businessStage,
        location: business.location,
        state: business.state,
        country: business.country,
      },
      requirement: {
        amountRequired: business.fundingRequirement
          ? decimalToNumber(business.fundingRequirement.amountRequired)
          : null,
        fundingType: business.fundingRequirement?.fundingType ?? null,
      },
      weights: weights.value,
    }),
  );

  // Below 30 the factors disagree so broadly that showing the pair wastes both
  // parties' time.
  const surfaced = results
    .map((result, index) => ({ result, businessId: businesses[index]!.id }))
    .filter((r) => r.result.overallScore >= 30)
    .sort((a, b) => b.result.overallScore - a.result.overallScore)
    .slice(0, 100);

  const keep = new Set(surfaced.map((s) => s.businessId));

  await prisma.$transaction([
    prisma.investorMatch.deleteMany({
      where: { investorId, businessId: { notIn: [...keep] } },
    }),
    ...surfaced.map(({ result, businessId }) => {
      const factor = (k: string) => result.factors.find((f) => f.key === k)?.score ?? 0;
      const data = {
        industryScore: factor('industry'),
        fundingScore: factor('funding'),
        stageScore: factor('stage'),
        locationScore: factor('location'),
        fundingTypeScore: factor('fundingType'),
        semanticScore: null,
        overallScore: result.overallScore,
        matchedFactors: result.matchedFactors,
        missingFactors: result.missingFactors,
        explanation: result.explanation as unknown as Prisma.InputJsonValue,
        narrative: null,
        modelVersion: result.modelVersion,
        configVersion: weights.configVersion,
      };
      return prisma.investorMatch.upsert({
        where: { businessId_investorId: { businessId, investorId } },
        create: { businessId, investorId, ...data },
        update: data,
      });
    }),
  ]);

  return { evaluated: results.length, stored: surfaced.length };
}

export async function listInvestorMatches(investorId: string) {
  const matches = await prisma.investorMatch.findMany({
    where: { investorId },
    orderBy: { overallScore: 'desc' },
    include: { business: { select: { ...discoverySelect, annualRevenue: true } } },
  });

  return matches.map((match) => {
    const { annualRevenue, ...business } = match.business;
    return {
      ...serialize({ ...match, business: undefined }),
      business: toDiscoveryView(business as RawBusiness, decimalToNumber(annualRevenue)),
    };
  });
}

/** Matches from the business owner's side: who might be interested in them. */
export async function listMatchesForBusiness(businessId: string) {
  const matches = await prisma.investorMatch.findMany({
    where: { businessId },
    orderBy: { overallScore: 'desc' },
    include: {
      investor: {
        // An investor's own contact details are not exposed either; the business
        // sees their stated preferences.
        select: {
          id: true,
          investorName: true,
          investorType: true,
          description: true,
          industries: true,
          preferredStages: true,
          preferredLocations: true,
          fundingTypes: true,
          minInvestment: true,
          maxInvestment: true,
          website: true,
          verification: true,
          sourceType: true,
        },
      },
    },
  });
  return serialize(matches);
}

// ---------------------------------------------------------------------------
// Shortlist
// ---------------------------------------------------------------------------

export async function addToShortlist(
  investorId: string,
  businessId: string,
  notes?: string | null,
) {
  const business = await prisma.businessProfile.findFirst({
    where: { id: businessId, discoverable: true },
    select: { id: true },
  });
  if (!business) throw new ValidationError('That business could not be found.');

  const existing = await prisma.shortlist.findUnique({
    where: { investorId_businessId: { investorId, businessId } },
    select: { id: true },
  });
  if (existing) throw new ConflictError('This business is already on your shortlist.');

  return serialize(
    await prisma.shortlist.create({
      data: { investorId, businessId, notes: notes ?? null },
    }),
  );
}

export async function listShortlist(investorId: string) {
  const rows = await prisma.shortlist.findMany({
    where: { investorId },
    orderBy: { createdAt: 'desc' },
    include: { business: { select: { ...discoverySelect, annualRevenue: true } } },
  });

  return rows.map((row) => {
    const { annualRevenue, ...business } = row.business;
    return {
      ...serialize({ ...row, business: undefined }),
      business: toDiscoveryView(business as RawBusiness, decimalToNumber(annualRevenue)),
    };
  });
}

export async function updateShortlistEntry(
  investorId: string,
  shortlistId: string,
  input: { status?: string; notes?: string | null },
) {
  const existing = await prisma.shortlist.findFirst({
    where: { id: shortlistId, investorId },
    select: { id: true },
  });
  if (!existing) throw new NotFoundError('Shortlist entry');

  const data: Prisma.ShortlistUpdateInput = {};
  if (input.status !== undefined) data.status = input.status as never;
  if (input.notes !== undefined) data.notes = input.notes;

  return serialize(await prisma.shortlist.update({ where: { id: shortlistId }, data }));
}

export async function removeFromShortlist(investorId: string, shortlistId: string): Promise<void> {
  const { count } = await prisma.shortlist.deleteMany({ where: { id: shortlistId, investorId } });
  if (count === 0) throw new NotFoundError('Shortlist entry');
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export async function getInvestorDashboard(investorId: string) {
  const [profile, matchCount, strongMatches, shortlistCount, discoverableCount] = await Promise.all([
    prisma.investorProfile.findUnique({ where: { id: investorId } }),
    prisma.investorMatch.count({ where: { investorId } }),
    prisma.investorMatch.count({ where: { investorId, overallScore: { gte: 70 } } }),
    prisma.shortlist.count({ where: { investorId } }),
    prisma.businessProfile.count({ where: { discoverable: true, fundingRequirement: { isNot: null } } }),
  ]);
  if (!profile) throw new NotFoundError('Investor profile');

  const topMatches = await prisma.investorMatch.findMany({
    where: { investorId },
    orderBy: { overallScore: 'desc' },
    take: 5,
    include: { business: { select: { ...discoverySelect, annualRevenue: true } } },
  });

  // How complete the investor's own preferences are. Matching quality depends
  // directly on this, so it is surfaced rather than left implicit.
  const preferenceFields = [
    profile.industries.length > 0,
    profile.preferredStages.length > 0,
    profile.preferredLocations.length > 0,
    profile.fundingTypes.length > 0,
    profile.minInvestment !== null,
    profile.maxInvestment !== null,
  ];
  const preferencesComplete = preferenceFields.filter(Boolean).length;

  return {
    profile: serialize(profile),
    preferences: {
      complete: preferencesComplete,
      total: preferenceFields.length,
      percent: Math.round((preferencesComplete / preferenceFields.length) * 100),
    },
    matches: { total: matchCount, strong: strongMatches },
    shortlistCount,
    discoverableBusinesses: discoverableCount,
    topMatches: topMatches.map((m) => {
      const { annualRevenue, ...business } = m.business;
      return {
        ...serialize({ ...m, business: undefined }),
        business: toDiscoveryView(business as RawBusiness, decimalToNumber(annualRevenue)),
      };
    }),
  };
}
