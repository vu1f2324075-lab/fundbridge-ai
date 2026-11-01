/**
 * Funding readiness — orchestration around the pure engine.
 *
 * The service loads inputs, calls `calculateReadiness`, and persists the result
 * with the model and config versions that produced it. All judgement lives in
 * the engine; this file only moves data.
 */
import { prisma } from '../lib/prisma';
import { NotFoundError } from '../lib/errors';
import { decimalToNumber, serialize } from '../lib/serialize';
import { calculateReadiness, type ReadinessResult } from '../engines/readiness.engine';
import { getReadinessCategories, getReadinessWeights } from './config.service';
import type { Prisma } from '../../generated/prisma';

/**
 * Recomputes and stores readiness.
 *
 * Always recalculates rather than returning a cached row: the caller asked for
 * an analysis, and the inputs may have changed since the last one.
 */
export async function recalculateReadiness(businessId: string): Promise<ReadinessResult & { configVersion: string }> {
  const business = await prisma.businessProfile.findUnique({
    where: { id: businessId },
    include: {
      fundingRequirement: true,
      proposals: {
        // Only the latest analysed proposal counts; older ones describe
        // documents the user has since superseded.
        where: { status: 'ANALYSED' },
        orderBy: { createdAt: 'desc' },
        take: 1,
        include: { analyses: { orderBy: { createdAt: 'desc' }, take: 1 } },
      },
    },
  });
  if (!business) throw new NotFoundError('Business profile');

  const [weights, categories] = await Promise.all([getReadinessWeights(), getReadinessCategories()]);

  const latestAnalysis = business.proposals[0]?.analyses[0];
  // Null, not 0 — the engine distinguishes "no proposal analysed" from "a
  // proposal that scored zero" and explains them differently.
  const proposalScore = latestAnalysis ? latestAnalysis.overallScore : null;

  const result = calculateReadiness({
    profile: {
      businessName: business.businessName,
      businessType: business.businessType,
      industry: business.industry,
      location: business.location,
      state: business.state,
      foundedYear: business.foundedYear,
      businessStage: business.businessStage,
      teamSize: business.teamSize,
      description: business.description,
      problem: business.problem,
      solution: business.solution,
      targetCustomer: business.targetCustomer,
      productStatus: business.productStatus,
      customerCount: business.customerCount,
      annualRevenue: decimalToNumber(business.annualRevenue),
      annualExpenses: decimalToNumber(business.annualExpenses),
      profitLoss: decimalToNumber(business.profitLoss),
      existingFunding: decimalToNumber(business.existingFunding),
      existingDebt: decimalToNumber(business.existingDebt),
      growthRate: business.growthRate,
      marketSize: decimalToNumber(business.marketSize),
      founderExperience: business.founderExperience,
      teamStrength: business.teamStrength,
      customers: business.customers,
      partnerships: business.partnerships,
      certifications: business.certifications,
      intellectualProperty: business.intellectualProperty,
      udyamRegistered: business.udyamRegistered,
      dpiitRecognised: business.dpiitRecognised,
      gstRegistered: business.gstRegistered,
    },
    requirement: business.fundingRequirement
      ? {
          amountRequired: decimalToNumber(business.fundingRequirement.amountRequired),
          purpose: business.fundingRequirement.purpose,
          fundingType: business.fundingRequirement.fundingType,
          preferredTimeline: business.fundingRequirement.preferredTimeline,
        }
      : null,
    proposalScore,
    weights: weights.value,
    categories: categories.value,
  });

  // Both config rows are stamped; they are versioned together.
  // Two configuration rows feed this score. They are almost always on the
  // same version, and repeating it reads as a bug to anyone looking at the
  // stamp, so the pair is collapsed when it is identical.
  const configVersion =
    weights.configVersion === categories.configVersion
      ? weights.configVersion
      : `${weights.configVersion}+${categories.configVersion}`;

  const byKey = (k: ReadinessResult['components'][number]['key']) =>
    result.components.find((c) => c.key === k)?.score ?? 0;

  await prisma.fundingReadiness.upsert({
    where: { businessId },
    create: {
      businessId,
      overallScore: result.overallScore,
      category: result.category,
      businessProfileScore: byKey('businessProfile'),
      financialScore: byKey('financialInformation'),
      marketValidationScore: byKey('marketValidation'),
      teamScore: byKey('teamStrength'),
      proposalScore: byKey('proposalQuality'),
      components: result.components as unknown as Prisma.InputJsonValue,
      missingInformation: result.missingInformation,
      recommendations: result.recommendations,
      modelVersion: result.modelVersion,
      configVersion,
    },
    update: {
      overallScore: result.overallScore,
      category: result.category,
      businessProfileScore: byKey('businessProfile'),
      financialScore: byKey('financialInformation'),
      marketValidationScore: byKey('marketValidation'),
      teamScore: byKey('teamStrength'),
      proposalScore: byKey('proposalQuality'),
      components: result.components as unknown as Prisma.InputJsonValue,
      missingInformation: result.missingInformation,
      recommendations: result.recommendations,
      modelVersion: result.modelVersion,
      configVersion,
    },
  });

  return { ...result, configVersion };
}

/**
 * The stored readiness row, or null if none has been calculated.
 *
 * Returns null rather than computing on read, so the UI can distinguish "not
 * analysed yet" from a real score and offer the action explicitly instead of
 * showing a number the user never asked for.
 */
export async function getStoredReadiness(businessId: string) {
  const row = await prisma.fundingReadiness.findUnique({ where: { businessId } });
  return row ? serialize(row) : null;
}
