/**
 * Investor matching engine.
 *
 * Same discipline as scheme matching: deterministic factors, conservative under
 * uncertainty, weights renormalised over what could actually be assessed, and no
 * language model anywhere near the score.
 *
 * The difference is what the output means. A scheme has published eligibility
 * criteria, so a mismatch can be a blocking issue. An investor has *preferences*,
 * which are not rules — so this engine never emits a blocker, and its language is
 * "fit" rather than "eligibility". Calling a preference mismatch an
 * ineligibility would misrepresent both parties.
 */
import { MODEL_VERSIONS, type InvestorMatchingWeights } from '../config/matching';

export interface InvestorInput {
  id: string;
  investorName: string;
  investorType: string;
  industries: string[];
  preferredStages: string[];
  preferredLocations: string[];
  fundingTypes: string[];
  minInvestment: number | null;
  maxInvestment: number | null;
}

export interface BusinessSideInput {
  industry: string | null;
  subIndustry: string | null;
  businessStage: string | null;
  location: string | null;
  state: string | null;
  country: string | null;
}

export interface FundingSideInput {
  amountRequired: number | null;
  fundingType: string | null;
}

export type FitOutcome = 'MATCH' | 'MISMATCH' | 'UNSTATED' | 'UNKNOWN';

export interface InvestorFactor {
  key: 'industry' | 'funding' | 'stage' | 'location' | 'fundingType';
  name: string;
  score: number;
  weight: number;
  outcome: FitOutcome;
  reason: string;
}

export interface InvestorMatchResult {
  investorId: string;
  overallScore: number;
  factors: InvestorFactor[];
  matchedFactors: string[];
  missingFactors: string[];
  explanation: {
    investorName: string;
    overallScore: number;
    factors: InvestorFactor[];
    matchedFactors: string[];
    missingFactors: string[];
    disclaimer: string;
  };
  modelVersion: string;
}

export const INVESTOR_DISCLAIMER =
  'This is a potential-fit indicator based on the preferences this investor has stated and the information on your profile. It is not an offer, a commitment, or any indication that investment will follow.';

function key(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function listOutcome(value: string | null, candidates: string[]): FitOutcome {
  // An investor who states no preference has not excluded anyone, but nor
  // have they expressed a fit — so this is UNSTATED, scored neutrally, and
  // labelled as such rather than counted as a match.
  if (candidates.length === 0) return 'UNSTATED';
  if (!value) return 'UNKNOWN';

  const target = key(value);
  const normalised = candidates.map(key);
  if (normalised.includes(target)) return 'MATCH';
  if (normalised.some((c) => c.includes(target) || target.includes(c))) return 'MATCH';
  return 'MISMATCH';
}

/**
 * An unstated preference scores 0.5, not 1.
 *
 * Full credit would rank an investor who has filled in nothing above one who has
 * stated preferences that genuinely align. Zero would be unfair to an investor
 * who is simply open. Half is the honest reading of "no information", and the
 * outcome label makes it visible.
 */
function outcomeScore(outcome: FitOutcome): number {
  switch (outcome) {
    case 'MATCH':
      return 1;
    case 'UNSTATED':
      return 0.5;
    case 'MISMATCH':
    case 'UNKNOWN':
      return 0;
  }
}

function industryFactor(business: BusinessSideInput, investor: InvestorInput): Omit<InvestorFactor, 'weight'> {
  let outcome = listOutcome(business.industry, investor.industries);
  if (outcome === 'MISMATCH' && business.subIndustry) {
    if (listOutcome(business.subIndustry, investor.industries) === 'MATCH') outcome = 'MATCH';
  }

  const reason =
    outcome === 'UNSTATED'
      ? 'This investor has not stated preferred industries.'
      : outcome === 'UNKNOWN'
        ? 'Your industry is not on your profile, so industry fit cannot be assessed.'
        : outcome === 'MATCH'
          ? `Your industry is among this investor's stated focus areas.`
          : `Your industry is not among this investor's stated focus areas.`;

  return { key: 'industry', name: 'Industry', score: outcomeScore(outcome), outcome, reason };
}

function stageFactor(business: BusinessSideInput, investor: InvestorInput): Omit<InvestorFactor, 'weight'> {
  const outcome = listOutcome(business.businessStage, investor.preferredStages);
  const reason =
    outcome === 'UNSTATED'
      ? 'This investor has not stated preferred business stages.'
      : outcome === 'UNKNOWN'
        ? 'Your business stage is not on your profile, so stage fit cannot be assessed.'
        : outcome === 'MATCH'
          ? 'Your business stage is among the stages this investor prefers.'
          : 'Your business stage is outside the stages this investor prefers.';

  return { key: 'stage', name: 'Business Stage', score: outcomeScore(outcome), outcome, reason };
}

function locationFactor(business: BusinessSideInput, investor: InvestorInput): Omit<InvestorFactor, 'weight'> {
  if (investor.preferredLocations.length === 0) {
    return {
      key: 'location',
      name: 'Location',
      score: 0.5,
      outcome: 'UNSTATED',
      reason: 'This investor has not stated preferred locations.',
    };
  }

  const candidates = [business.location, business.state, business.country].filter(
    (v): v is string => typeof v === 'string' && v.trim().length > 0,
  );
  if (candidates.length === 0) {
    return {
      key: 'location',
      name: 'Location',
      score: 0,
      outcome: 'UNKNOWN',
      reason: 'Your location is not on your profile, so location fit cannot be assessed.',
    };
  }

  const matched = candidates.some((c) => listOutcome(c, investor.preferredLocations) === 'MATCH');
  return {
    key: 'location',
    name: 'Location',
    score: matched ? 1 : 0,
    outcome: matched ? 'MATCH' : 'MISMATCH',
    reason: matched
      ? `Your location is within this investor's stated geography.`
      : `Your location is outside this investor's stated geography.`,
  };
}

/**
 * Cheque-size compatibility, graded rather than binary.
 *
 * A requirement somewhat above an investor's ceiling may still fit as part of a
 * round, so it scores partially. Far outside, it does not.
 */
function fundingFactor(requirement: FundingSideInput, investor: InvestorInput): Omit<InvestorFactor, 'weight'> {
  const hasRange = investor.minInvestment !== null || investor.maxInvestment !== null;
  if (!hasRange) {
    return {
      key: 'funding',
      name: 'Investment Size',
      score: 0.5,
      outcome: 'UNSTATED',
      reason: 'This investor has not stated an investment range.',
    };
  }

  const amount = requirement.amountRequired;
  if (amount === null || !Number.isFinite(amount) || amount <= 0) {
    return {
      key: 'funding',
      name: 'Investment Size',
      score: 0,
      outcome: 'UNKNOWN',
      reason: 'You have not stated how much funding you need, so fit cannot be assessed.',
    };
  }

  const min = investor.minInvestment ?? 0;
  const max = investor.maxInvestment ?? Number.POSITIVE_INFINITY;

  if (amount >= min && amount <= max) {
    return {
      key: 'funding',
      name: 'Investment Size',
      score: 1,
      outcome: 'MATCH',
      reason: `Your requirement falls within this investor's stated range.`,
    };
  }

  if (amount > max) {
    return {
      key: 'funding',
      name: 'Investment Size',
      score: Math.max(0, Math.min(1, max / amount)),
      outcome: 'MISMATCH',
      reason: `Your requirement is above this investor's stated maximum, so they could fund only part of it.`,
    };
  }

  return {
    key: 'funding',
    name: 'Investment Size',
    score: Math.max(0, Math.min(1, amount / min)),
    outcome: 'MISMATCH',
    reason: `Your requirement is below this investor's stated minimum.`,
  };
}

function fundingTypeFactor(requirement: FundingSideInput, investor: InvestorInput): Omit<InvestorFactor, 'weight'> {
  // "Any suitable" is genuinely compatible with whatever the investor offers,
  // so it is treated as a match rather than as an unknown.
  if (requirement.fundingType === 'ANY_SUITABLE') {
    return {
      key: 'fundingType',
      name: 'Funding Type',
      score: 1,
      outcome: 'MATCH',
      reason: 'You are open to any suitable funding type.',
    };
  }

  const outcome = listOutcome(requirement.fundingType, investor.fundingTypes);
  const reason =
    outcome === 'UNSTATED'
      ? 'This investor has not stated which funding types they offer.'
      : outcome === 'UNKNOWN'
        ? 'You have not stated a preferred funding type.'
        : outcome === 'MATCH'
          ? 'Your preferred funding type is among those this investor offers.'
          : 'Your preferred funding type is not among those this investor offers.';

  return { key: 'fundingType', name: 'Funding Type', score: outcomeScore(outcome), outcome, reason };
}

export function matchInvestorToBusiness(input: {
  investor: InvestorInput;
  business: BusinessSideInput;
  requirement: FundingSideInput;
  weights: InvestorMatchingWeights;
}): InvestorMatchResult {
  const { investor, business, requirement, weights } = input;

  const base = [
    industryFactor(business, investor),
    fundingFactor(requirement, investor),
    stageFactor(business, investor),
    locationFactor(business, investor),
    fundingTypeFactor(requirement, investor),
  ];

  const weightByKey: Record<InvestorFactor['key'], number> = {
    industry: weights.industry,
    funding: weights.funding,
    stage: weights.stage,
    location: weights.location,
    fundingType: weights.fundingType,
  };

  const total = base.reduce((sum, f) => sum + weightByKey[f.key], 0);
  const factors: InvestorFactor[] = base.map((f) => ({
    ...f,
    weight: total > 0 ? weightByKey[f.key] / total : 0,
  }));

  const overallScore = Math.round(factors.reduce((sum, f) => sum + f.score * f.weight, 0) * 100);

  const matchedFactors = factors.filter((f) => f.outcome === 'MATCH').map((f) => f.reason);
  const missingFactors = factors
    .filter((f) => f.outcome === 'UNKNOWN' || f.outcome === 'UNSTATED')
    .map((f) => f.reason);

  return {
    investorId: investor.id,
    overallScore,
    factors,
    matchedFactors,
    missingFactors,
    explanation: {
      investorName: investor.investorName,
      overallScore,
      factors,
      matchedFactors,
      missingFactors,
      disclaimer: INVESTOR_DISCLAIMER,
    },
    modelVersion: MODEL_VERSIONS.investorMatching,
  };
}
