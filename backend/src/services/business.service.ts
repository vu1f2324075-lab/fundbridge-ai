/**
 * Business profile and funding requirement persistence.
 *
 * Every function takes the caller's own `businessId`, resolved by the
 * `requireOwnBusiness` guard from the session — never an id from the URL or
 * body. That makes cross-tenant access structurally impossible here rather than
 * dependent on remembering a `where` clause.
 *
 * Changing the profile or the requirement invalidates derived analysis, because
 * a readiness score or scheme match computed against old inputs is misleading
 * rather than merely stale (master spec §78).
 */
import { prisma } from '../lib/prisma';
import { NotFoundError } from '../lib/errors';
import { serialize } from '../lib/serialize';
import type { UpdateBusinessProfileInput, UpsertFundingRequirementInput } from '../validators/business';
import type { Prisma } from '../../generated/prisma';

/** Fields returned to the owner. Excludes nothing — it is their own data. */
const businessSelect = {
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
  annualRevenue: true,
  annualExpenses: true,
  profitLoss: true,
  existingFunding: true,
  existingDebt: true,
  growthRate: true,
  marketSize: true,
  founderExperience: true,
  teamStrength: true,
  customers: true,
  partnerships: true,
  certifications: true,
  intellectualProperty: true,
  udyamRegistered: true,
  dpiitRecognised: true,
  gstRegistered: true,
  registrationNumber: true,
  discoverable: true,
  sourceType: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.BusinessProfileSelect;

export async function getBusinessProfile(businessId: string) {
  const profile = await prisma.businessProfile.findUnique({
    where: { id: businessId },
    select: { ...businessSelect, fundingRequirement: true },
  });
  if (!profile) throw new NotFoundError('Business profile');
  return serialize(profile);
}

/**
 * Applies a partial update.
 *
 * Only keys actually present in the request are written, so a form that submits
 * one section cannot blank the fields it did not include.
 */
export async function updateBusinessProfile(businessId: string, input: UpdateBusinessProfileInput) {
  const data: Prisma.BusinessProfileUpdateInput = {};

  // Explicit per-key copying rather than a spread: a spread would also carry
  // any key that slipped past validation into the database write.
  for (const [k, v] of Object.entries(input)) {
    if (v !== undefined) {
      (data as Record<string, unknown>)[k] = v;
    }
  }

  const updated = await prisma.businessProfile.update({
    where: { id: businessId },
    data,
    select: { ...businessSelect, fundingRequirement: true },
  });

  await invalidateDerivedAnalysis(businessId);
  return serialize(updated);
}

export async function getFundingRequirement(businessId: string) {
  const requirement = await prisma.fundingRequirement.findUnique({ where: { businessId } });
  return requirement ? serialize(requirement) : null;
}

export async function upsertFundingRequirement(businessId: string, input: UpsertFundingRequirementInput) {
  const data = {
    amountRequired: input.amountRequired,
    currency: input.currency,
    purpose: input.purpose,
    fundingType: input.fundingType,
    preferredTimeline: input.preferredTimeline ?? null,
    preferredLocation: input.preferredLocation ?? null,
    additionalRequirements: input.additionalRequirements ?? null,
  };

  const requirement = await prisma.fundingRequirement.upsert({
    where: { businessId },
    create: { businessId, ...data },
    update: data,
  });

  await invalidateDerivedAnalysis(businessId);
  return serialize(requirement);
}

/**
 * Clears analysis that the changed inputs invalidate.
 *
 * Readiness and scheme matches are deleted rather than flagged: a score shown
 * next to inputs it was not computed from is worse than no score, and the UI
 * can honestly say "not yet calculated" and offer to recalculate.
 *
 * Proposals and their analyses are NOT touched — they describe a document the
 * user uploaded, which a profile edit does not change.
 */
export async function invalidateDerivedAnalysis(businessId: string): Promise<void> {
  await prisma.$transaction([
    prisma.fundingReadiness.deleteMany({ where: { businessId } }),
    prisma.schemeMatch.deleteMany({ where: { businessId } }),
    prisma.investorMatch.deleteMany({ where: { businessId } }),
  ]);
}

/**
 * Which profile sections are complete, for the dashboard progress indicator.
 *
 * Derived from the same field groups the readiness engine scores, so the
 * completion bar and the readiness breakdown cannot disagree.
 */
export async function getProfileCompletion(businessId: string): Promise<{
  overall: number;
  sections: Array<{ key: string; name: string; complete: number; total: number }>;
}> {
  const p = await prisma.businessProfile.findUnique({
    where: { id: businessId },
    select: { ...businessSelect, fundingRequirement: { select: { id: true } } },
  });
  if (!p) throw new NotFoundError('Business profile');

  const filled = (v: unknown): boolean => {
    if (v === null || v === undefined) return false;
    if (typeof v === 'string') return v.trim().length > 0;
    if (Array.isArray(v)) return v.length > 0;
    return true;
  };

  const sections = [
    {
      key: 'basics',
      name: 'Business Basics',
      fields: [p.businessName, p.businessType, p.industry, p.location, p.state, p.foundedYear, p.businessStage],
    },
    {
      key: 'narrative',
      name: 'Business Story',
      fields: [p.description, p.problem, p.solution, p.targetCustomer, p.productStatus],
    },
    {
      key: 'financials',
      name: 'Financials',
      fields: [p.annualRevenue, p.annualExpenses, p.profitLoss, p.existingFunding, p.existingDebt, p.growthRate],
    },
    {
      key: 'market',
      name: 'Market & Traction',
      fields: [p.customerCount, p.customers, p.partnerships, p.marketSize],
    },
    {
      key: 'team',
      name: 'Team',
      fields: [p.teamSize, p.founderExperience, p.teamStrength],
    },
    {
      key: 'registrations',
      name: 'Registrations',
      fields: [p.udyamRegistered, p.dpiitRecognised, p.gstRegistered],
    },
    {
      key: 'requirement',
      name: 'Funding Requirement',
      fields: [p.fundingRequirement],
    },
  ];

  const summarised = sections.map((s) => ({
    key: s.key,
    name: s.name,
    complete: s.fields.filter(filled).length,
    total: s.fields.length,
  }));

  const complete = summarised.reduce((sum, s) => sum + s.complete, 0);
  const total = summarised.reduce((sum, s) => sum + s.total, 0);

  return {
    overall: total === 0 ? 0 : Math.round((complete / total) * 100),
    sections: summarised,
  };
}
