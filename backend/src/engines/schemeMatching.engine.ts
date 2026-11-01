/**
 * Government-scheme matching engine.
 *
 * This is the component that must never overstate. Three principles shape it:
 *
 * 1. **Deterministic first.** Factual criteria are compared by rule. Semantic
 *    similarity is one low-weighted relevance signal, never evidence of
 *    eligibility (master spec §9, rule 9).
 *
 * 2. **Conservative under uncertainty.** A factor the *business* has not
 *    answered scores ZERO and is reported as missing information. It is not
 *    given half credit, which would invent a partial match. A displayed score is
 *    therefore a floor that can only rise as the user fills gaps — never an
 *    optimistic guess. Conversely, a factor the *scheme* does not restrict
 *    scores full credit, because an unrestricted criterion genuinely excludes
 *    nobody.
 *
 * 3. **Never an eligibility verdict.** Output is a potential-relevance score
 *    plus the evidence behind it. `MatchStatus` has no APPROVED member and the
 *    engine cannot emit one.
 *
 * Pure function: no database, no clock, no network. A stored match can be
 * recomputed exactly from its inputs plus the recorded `configVersion`.
 */
import { z } from 'zod';
import { MODEL_VERSIONS, type SchemeMatchingThresholds, type SchemeMatchingWeights } from '../config/matching';

export type MatchStatus =
  | 'POTENTIALLY_ELIGIBLE'
  | 'NEEDS_INFORMATION'
  | 'REVIEW_REQUIRED'
  | 'LIKELY_NOT_ELIGIBLE';

/**
 * Machine-checkable gates stored on `GovernmentScheme.eligibilityRules`.
 *
 * Only rules that were actually read off an official source should be present.
 * An absent rule means "this scheme does not state such a condition", which the
 * engine treats as no constraint — it must never be read as a condition the
 * business fails.
 */
export const eligibilityRulesSchema = z
  .object({
    requiresUdyamRegistration: z.boolean().optional(),
    requiresDpiitRecognition: z.boolean().optional(),
    requiresGstRegistration: z.boolean().optional(),
    maxBusinessAgeYears: z.number().positive().optional(),
    minBusinessAgeYears: z.number().nonnegative().optional(),
    maxAnnualRevenue: z.number().nonnegative().optional(),
    minAnnualRevenue: z.number().nonnegative().optional(),
    maxTeamSize: z.number().positive().optional(),
    minTeamSize: z.number().positive().optional(),
  })
  .strict();

export type EligibilityRules = z.infer<typeof eligibilityRulesSchema>;

export interface SchemeInput {
  id: string;
  name: string;
  targetBusinessTypes: string[];
  supportedIndustries: string[];
  supportedStages: string[];
  supportedLocations: string[];
  supportedFundingTypes: string[];
  supportedPurposes: string[];
  minFunding: number | null;
  maxFunding: number | null;
  eligibilityRules: unknown;
  eligibilityCriteria: string[];
  requiredDocuments: string[];
}

export interface BusinessInput {
  businessType: string | null;
  industry: string | null;
  subIndustry: string | null;
  businessStage: string | null;
  location: string | null;
  state: string | null;
  country: string | null;
  foundedYear: number | null;
  teamSize: number | null;
  annualRevenue: number | null;
  udyamRegistered: boolean | null;
  dpiitRecognised: boolean | null;
  gstRegistered: boolean | null;
}

export interface RequirementInput {
  amountRequired: number | null;
  fundingType: string | null;
  purpose: string | null;
}

/** Why a factor scored what it did — the authoritative explanation. */
export type FactorOutcome =
  /** Business value is within the scheme's stated set. */
  | 'MATCH'
  /** Business value is outside the scheme's stated set. */
  | 'MISMATCH'
  /** Scheme states no constraint, so nobody is excluded. */
  | 'UNRESTRICTED'
  /** Business has not supplied the value, so alignment cannot be assessed. */
  | 'UNKNOWN';

export interface MatchFactor {
  key: 'businessType' | 'industry' | 'businessStage' | 'location' | 'fundingRequirement' | 'purpose' | 'semanticRelevance';
  name: string;
  /** 0-1 within this factor. */
  score: number;
  weight: number;
  outcome: FactorOutcome;
  /** Plain-language statement of the comparison actually performed. */
  reason: string;
}

export interface SchemeMatchResult {
  schemeId: string;
  /** 0-100, weighted over the factors that could be assessed. */
  eligibilityScore: number;
  status: MatchStatus;
  factors: MatchFactor[];
  matchedCriteria: string[];
  missingCriteria: string[];
  /** Stated conditions the business demonstrably fails. */
  blockingIssues: string[];
  /** Serialised explanation the UI and the LLM verbaliser both read. */
  explanation: {
    schemeName: string;
    eligibilityScore: number;
    status: MatchStatus;
    factors: MatchFactor[];
    matchedCriteria: string[];
    missingCriteria: string[];
    blockingIssues: string[];
    /** Criteria text from the official record, for the user to verify. */
    statedCriteria: string[];
    requiredDocuments: string[];
    disclaimer: string;
  };
  modelVersion: string;
}

export const MATCH_DISCLAIMER =
  'This is a potential-relevance indicator produced by comparing your profile with the stored scheme record. It is not an eligibility decision. Verify current requirements with the official source before applying.';

// ---------------------------------------------------------------------------
// Normalisation
// ---------------------------------------------------------------------------

/**
 * Loose comparison key. Collapses case, whitespace and punctuation so
 * "Fin-Tech", "fin tech" and "FinTech" compare equal without needing every
 * variant enumerated in the controlled vocabulary.
 */
function key(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function listMatches(businessValue: string | null, schemeValues: string[]): FactorOutcome {
  if (schemeValues.length === 0) return 'UNRESTRICTED';
  if (!businessValue) return 'UNKNOWN';

  const target = key(businessValue);
  const normalised = schemeValues.map(key);

  if (normalised.includes(target)) return 'MATCH';
  // Substring both ways: "technology" should match "information technology",
  // and a scheme listing "all sectors" should not need every sector spelled out.
  if (normalised.some((v) => v.includes(target) || target.includes(v))) return 'MATCH';
  return 'MISMATCH';
}

/** Treats an UNRESTRICTED criterion as fully satisfied; see principle 2. */
function outcomeToScore(outcome: FactorOutcome): number {
  switch (outcome) {
    case 'MATCH':
    case 'UNRESTRICTED':
      return 1;
    case 'MISMATCH':
    case 'UNKNOWN':
      return 0;
  }
}

// ---------------------------------------------------------------------------
// Factors
// ---------------------------------------------------------------------------

function industryFactor(business: BusinessInput, scheme: SchemeInput): Omit<MatchFactor, 'weight'> {
  // A sub-industry match counts: a scheme targeting "Construction Technology"
  // should match a business whose industry is "Technology" with that
  // sub-industry.
  let outcome = listMatches(business.industry, scheme.supportedIndustries);
  if (outcome === 'MISMATCH' && business.subIndustry) {
    const viaSub = listMatches(business.subIndustry, scheme.supportedIndustries);
    if (viaSub === 'MATCH') outcome = 'MATCH';
  }

  const reason =
    outcome === 'UNRESTRICTED'
      ? 'This scheme does not restrict eligibility by industry.'
      : outcome === 'UNKNOWN'
        ? 'Your industry has not been provided, so industry alignment cannot be assessed.'
        : outcome === 'MATCH'
          ? `Your industry (${business.industry ?? ''}) is among the sectors this scheme supports.`
          : `Your industry (${business.industry ?? ''}) is not among the sectors listed for this scheme.`;

  return { key: 'industry', name: 'Industry', score: outcomeToScore(outcome), outcome, reason };
}

function stageFactor(business: BusinessInput, scheme: SchemeInput): Omit<MatchFactor, 'weight'> {
  const outcome = listMatches(business.businessStage, scheme.supportedStages);
  const reason =
    outcome === 'UNRESTRICTED'
      ? 'This scheme does not restrict eligibility by business stage.'
      : outcome === 'UNKNOWN'
        ? 'Your business stage has not been provided, so stage alignment cannot be assessed.'
        : outcome === 'MATCH'
          ? `Your business stage is among the stages this scheme supports.`
          : `This scheme lists stages that do not include your current stage.`;

  return { key: 'businessStage', name: 'Business Stage', score: outcomeToScore(outcome), outcome, reason };
}

function businessTypeFactor(business: BusinessInput, scheme: SchemeInput): Omit<MatchFactor, 'weight'> {
  const outcome = listMatches(business.businessType, scheme.targetBusinessTypes);
  const reason =
    outcome === 'UNRESTRICTED'
      ? 'This scheme does not restrict eligibility by legal business type.'
      : outcome === 'UNKNOWN'
        ? 'Your legal business type has not been provided, so this cannot be assessed.'
        : outcome === 'MATCH'
          ? 'Your legal business type is among the types this scheme supports.'
          : 'Your legal business type is not among the types listed for this scheme.';

  return { key: 'businessType', name: 'Business Type', score: outcomeToScore(outcome), outcome, reason };
}

function locationFactor(business: BusinessInput, scheme: SchemeInput): Omit<MatchFactor, 'weight'> {
  if (scheme.supportedLocations.length === 0) {
    return {
      key: 'location',
      name: 'Location',
      score: 1,
      outcome: 'UNRESTRICTED',
      reason: 'This scheme does not restrict eligibility by location.',
    };
  }

  // Any geographic level may satisfy a location constraint: a scheme covering
  // "India" matches a Mumbai business, and one covering "Maharashtra" matches it
  // via state.
  const candidates = [business.location, business.state, business.country].filter(
    (v): v is string => typeof v === 'string' && v.trim().length > 0,
  );

  if (candidates.length === 0) {
    return {
      key: 'location',
      name: 'Location',
      score: 0,
      outcome: 'UNKNOWN',
      reason: 'Your location has not been provided, so location eligibility cannot be assessed.',
    };
  }

  const matched = candidates.some((c) => listMatches(c, scheme.supportedLocations) === 'MATCH');
  return {
    key: 'location',
    name: 'Location',
    score: matched ? 1 : 0,
    outcome: matched ? 'MATCH' : 'MISMATCH',
    reason: matched
      ? 'Your location falls within the area this scheme covers.'
      : 'Your location does not appear to fall within the area this scheme covers.',
  };
}

/**
 * Funding-amount compatibility.
 *
 * Graded rather than binary: a requirement somewhat above a scheme's ceiling is
 * still partially relevant (the scheme could fund part of the need), whereas one
 * far outside the range is not. Scored on how much of the requirement the
 * scheme's range could plausibly cover.
 */
function fundingFactor(scheme: SchemeInput, requirement: RequirementInput): Omit<MatchFactor, 'weight'> {
  const hasRange = scheme.minFunding !== null || scheme.maxFunding !== null;

  if (!hasRange) {
    return {
      key: 'fundingRequirement',
      name: 'Funding Requirement',
      score: 1,
      outcome: 'UNRESTRICTED',
      reason: 'This scheme record does not state a funding range.',
    };
  }

  const amount = requirement.amountRequired;
  if (amount === null || !Number.isFinite(amount) || amount <= 0) {
    return {
      key: 'fundingRequirement',
      name: 'Funding Requirement',
      score: 0,
      outcome: 'UNKNOWN',
      reason: 'You have not stated how much funding you need, so compatibility cannot be assessed.',
    };
  }

  const min = scheme.minFunding ?? 0;
  const max = scheme.maxFunding ?? Number.POSITIVE_INFINITY;

  if (amount >= min && amount <= max) {
    return {
      key: 'fundingRequirement',
      name: 'Funding Requirement',
      score: 1,
      outcome: 'MATCH',
      reason: 'Your stated funding requirement falls within this scheme’s funding range.',
    };
  }

  if (amount > max) {
    // Proportion of the requirement the ceiling could cover.
    const covered = max / amount;
    return {
      key: 'fundingRequirement',
      name: 'Funding Requirement',
      score: Math.max(0, Math.min(1, covered)),
      outcome: 'MISMATCH',
      reason: 'Your requirement exceeds this scheme’s maximum, so it could cover only part of the amount.',
    };
  }

  // Below the floor: the scheme would over-fund, which usually means the
  // business is not the intended recipient.
  const ratio = amount / min;
  return {
    key: 'fundingRequirement',
    name: 'Funding Requirement',
    score: Math.max(0, Math.min(1, ratio)),
    outcome: 'MISMATCH',
    reason: 'Your requirement is below this scheme’s minimum funding amount.',
  };
}

function purposeFactor(scheme: SchemeInput, requirement: RequirementInput): Omit<MatchFactor, 'weight'> {
  const outcome = listMatches(requirement.purpose, scheme.supportedPurposes);
  const reason =
    outcome === 'UNRESTRICTED'
      ? 'This scheme record does not restrict the purpose funding may be used for.'
      : outcome === 'UNKNOWN'
        ? 'You have not stated your funding purpose, so purpose alignment cannot be assessed.'
        : outcome === 'MATCH'
          ? 'Your stated funding purpose is among the purposes this scheme supports.'
          : 'Your stated funding purpose is not among those listed for this scheme.';

  return { key: 'purpose', name: 'Funding Purpose', score: outcomeToScore(outcome), outcome, reason };
}

// ---------------------------------------------------------------------------
// Hard eligibility gates
// ---------------------------------------------------------------------------

interface GateResult {
  blocking: string[];
  unknown: string[];
  satisfied: string[];
}

/**
 * Evaluates the scheme's machine-checkable conditions.
 *
 * Separates three outcomes deliberately: a condition the business *fails* is
 * blocking, one it has *not answered* is missing information, and one it *meets*
 * is evidence for the match. Collapsing the first two would either hide a real
 * blocker or invent one.
 */
function evaluateGates(business: BusinessInput, rules: EligibilityRules, currentYear: number): GateResult {
  const blocking: string[] = [];
  const unknown: string[] = [];
  const satisfied: string[] = [];

  const flag = (
    required: boolean | undefined,
    actual: boolean | null,
    label: string,
  ): void => {
    if (required !== true) return;
    if (actual === null || actual === undefined) unknown.push(label);
    else if (actual) satisfied.push(label);
    else blocking.push(`${label} is required by this scheme, and your profile records that you do not have it.`);
  };

  flag(rules.requiresUdyamRegistration, business.udyamRegistered, 'Udyam registration');
  flag(rules.requiresDpiitRecognition, business.dpiitRecognised, 'DPIIT recognition');
  flag(rules.requiresGstRegistration, business.gstRegistered, 'GST registration');

  if (rules.maxBusinessAgeYears !== undefined || rules.minBusinessAgeYears !== undefined) {
    if (business.foundedYear === null) {
      unknown.push('Year the business was founded');
    } else {
      const age = currentYear - business.foundedYear;
      if (rules.maxBusinessAgeYears !== undefined && age > rules.maxBusinessAgeYears) {
        blocking.push(
          `This scheme applies to businesses up to ${rules.maxBusinessAgeYears} years old; yours is approximately ${age}.`,
        );
      } else if (rules.minBusinessAgeYears !== undefined && age < rules.minBusinessAgeYears) {
        blocking.push(
          `This scheme applies to businesses at least ${rules.minBusinessAgeYears} years old; yours is approximately ${age}.`,
        );
      } else {
        satisfied.push('Business age falls within the scheme’s stated range');
      }
    }
  }

  if (rules.maxAnnualRevenue !== undefined || rules.minAnnualRevenue !== undefined) {
    if (business.annualRevenue === null) {
      unknown.push('Annual revenue');
    } else if (rules.maxAnnualRevenue !== undefined && business.annualRevenue > rules.maxAnnualRevenue) {
      blocking.push('Your annual revenue is above the maximum this scheme states.');
    } else if (rules.minAnnualRevenue !== undefined && business.annualRevenue < rules.minAnnualRevenue) {
      blocking.push('Your annual revenue is below the minimum this scheme states.');
    } else {
      satisfied.push('Annual revenue falls within the scheme’s stated range');
    }
  }

  if (rules.maxTeamSize !== undefined || rules.minTeamSize !== undefined) {
    if (business.teamSize === null) {
      unknown.push('Team size');
    } else if (rules.maxTeamSize !== undefined && business.teamSize > rules.maxTeamSize) {
      blocking.push('Your team size is above the maximum this scheme states.');
    } else if (rules.minTeamSize !== undefined && business.teamSize < rules.minTeamSize) {
      blocking.push('Your team size is below the minimum this scheme states.');
    } else {
      satisfied.push('Team size falls within the scheme’s stated range');
    }
  }

  return { blocking, unknown, satisfied };
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export function matchSchemeToBusiness(input: {
  scheme: SchemeInput;
  business: BusinessInput;
  requirement: RequirementInput;
  /**
   * Cosine similarity in [0,1] from the AI service, or null when embeddings are
   * unavailable. Null excludes the factor and renormalises the remaining
   * weights, so an offline AI service lowers confidence but never silently caps
   * the score below 100.
   */
  semanticScore?: number | null;
  weights: SchemeMatchingWeights;
  thresholds: SchemeMatchingThresholds;
  /** Injected rather than read from the clock, so the engine stays pure. */
  currentYear: number;
}): SchemeMatchResult {
  const { scheme, business, requirement, semanticScore = null, weights, thresholds, currentYear } = input;

  const base: Array<Omit<MatchFactor, 'weight'>> = [
    industryFactor(business, scheme),
    stageFactor(business, scheme),
    businessTypeFactor(business, scheme),
    locationFactor(business, scheme),
    fundingFactor(scheme, requirement),
    purposeFactor(scheme, requirement),
  ];

  if (semanticScore !== null && Number.isFinite(semanticScore)) {
    const bounded = Math.max(0, Math.min(1, semanticScore));
    base.push({
      key: 'semanticRelevance',
      name: 'Semantic Relevance',
      score: bounded,
      outcome: bounded >= 0.5 ? 'MATCH' : 'MISMATCH',
      reason:
        'Similarity between your business description and this scheme’s description. A relevance signal only — not evidence of eligibility.',
    });
  }

  const weightByKey: Record<MatchFactor['key'], number> = {
    industry: weights.industry,
    businessStage: weights.businessStage,
    businessType: weights.businessType,
    location: weights.location,
    fundingRequirement: weights.fundingRequirement,
    purpose: weights.purpose,
    semanticRelevance: weights.semanticRelevance,
  };

  // Renormalise over the factors actually present, so omitting the semantic
  // factor does not cap the score at (1 - semanticWeight).
  const totalWeight = base.reduce((sum, f) => sum + weightByKey[f.key], 0);
  const factors: MatchFactor[] = base.map((f) => ({
    ...f,
    weight: totalWeight > 0 ? weightByKey[f.key] / totalWeight : 0,
  }));

  const eligibilityScore = Math.round(factors.reduce((sum, f) => sum + f.score * f.weight, 0) * 100);

  // Gates
  const parsedRules = eligibilityRulesSchema.safeParse(scheme.eligibilityRules ?? {});
  const rules: EligibilityRules = parsedRules.success ? parsedRules.data : {};
  const gates = evaluateGates(business, rules, currentYear);

  const matchedCriteria = [
    ...factors.filter((f) => f.outcome === 'MATCH').map((f) => f.reason),
    ...gates.satisfied,
  ];

  const missingCriteria = [
    ...factors.filter((f) => f.outcome === 'UNKNOWN').map((f) => f.reason),
    ...gates.unknown.map((u) => `${u} has not been provided, and this scheme states a condition that depends on it.`),
  ];

  // A scheme record whose rules failed validation is flagged for review rather
  // than silently matched on partial criteria.
  const blockingIssues = [...gates.blocking];
  if (!parsedRules.success) {
    blockingIssues.push(
      'This scheme’s stored eligibility rules could not be interpreted and need administrator review.',
    );
  }

  const status = determineStatus({
    score: eligibilityScore,
    blockingCount: blockingIssues.length,
    missingCount: missingCriteria.length,
    mismatchCount: factors.filter((f) => f.outcome === 'MISMATCH').length,
    thresholds,
  });

  return {
    schemeId: scheme.id,
    eligibilityScore,
    status,
    factors,
    matchedCriteria,
    missingCriteria,
    blockingIssues,
    explanation: {
      schemeName: scheme.name,
      eligibilityScore,
      status,
      factors,
      matchedCriteria,
      missingCriteria,
      blockingIssues,
      statedCriteria: scheme.eligibilityCriteria,
      requiredDocuments: scheme.requiredDocuments,
      disclaimer: MATCH_DISCLAIMER,
    },
    modelVersion: MODEL_VERSIONS.schemeMatching,
  };
}

function determineStatus(input: {
  score: number;
  blockingCount: number;
  missingCount: number;
  mismatchCount: number;
  thresholds: SchemeMatchingThresholds;
}): MatchStatus {
  const { score, blockingCount, missingCount, mismatchCount, thresholds } = input;

  // A demonstrably failed stated condition dominates the score. A high score
  // with a blocker would be actively misleading.
  if (blockingCount > 0) return 'LIKELY_NOT_ELIGIBLE';

  // Unanswered conditions mean the score is a floor, so it cannot be presented
  // as potential eligibility however high it is.
  if (missingCount > 0) return 'NEEDS_INFORMATION';

  if (score >= thresholds.potentiallyEligible && mismatchCount === 0) return 'POTENTIALLY_ELIGIBLE';
  if (score >= thresholds.needsInformation) return 'REVIEW_REQUIRED';
  return 'REVIEW_REQUIRED';
}

/** Human-readable label. Deliberately avoids any word implying a decision. */
export const STATUS_LABELS: Record<MatchStatus, string> = {
  POTENTIALLY_ELIGIBLE: 'Potentially Eligible',
  NEEDS_INFORMATION: 'Needs Information',
  REVIEW_REQUIRED: 'Review Required',
  LIKELY_NOT_ELIGIBLE: 'Likely Not Eligible',
};
