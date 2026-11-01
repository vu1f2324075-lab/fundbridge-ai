/**
 * Funding-readiness engine.
 *
 * Answers "how prepared is this business to pursue funding?" — never "will this
 * business receive funding?". The distinction matters: readiness is a measure of
 * how complete and evidenced the business's own case is, which is entirely
 * within the user's control to improve.
 *
 * The engine is a pure function of (profile, requirement, proposal score,
 * weights). No database, no clock, no randomness — so it is directly testable
 * and a stored score can be recomputed exactly from the inputs and the
 * `configVersion` recorded alongside it.
 *
 * Every component returns the evidence behind its score: which fields counted,
 * which are missing, and a sentence explaining it. The UI renders that rather
 * than a bare number, which is what makes the score explainable instead of
 * oracular.
 */
import type { ReadinessWeights } from '../config/matching';
import { MODEL_VERSIONS } from '../config/matching';

/** The subset of a business profile readiness looks at. */
export interface ReadinessProfileInput {
  businessName?: string | null;
  businessType?: string | null;
  industry?: string | null;
  location?: string | null;
  state?: string | null;
  foundedYear?: number | null;
  businessStage?: string | null;
  teamSize?: number | null;
  description?: string | null;
  problem?: string | null;
  solution?: string | null;
  targetCustomer?: string | null;
  productStatus?: string | null;
  customerCount?: number | null;

  annualRevenue?: number | null;
  annualExpenses?: number | null;
  profitLoss?: number | null;
  existingFunding?: number | null;
  existingDebt?: number | null;
  growthRate?: number | null;
  marketSize?: number | null;

  founderExperience?: number | null;
  teamStrength?: string | null;
  customers?: string[];
  partnerships?: string[];
  certifications?: string[];
  intellectualProperty?: string[];

  udyamRegistered?: boolean | null;
  dpiitRecognised?: boolean | null;
  gstRegistered?: boolean | null;
}

export interface ReadinessRequirementInput {
  amountRequired?: number | null;
  purpose?: string | null;
  fundingType?: string | null;
  preferredTimeline?: string | null;
}

/**
 * Category bands, accepted as readonly so both the `as const` code defaults and
 * the mutable array Zod infers from the database satisfy the same signature.
 */
export type ReadinessCategoryBands = ReadonlyArray<{ readonly min: number; readonly label: string }>;

export interface ReadinessComponent {
  /** Stable key so the UI and action-plan generator can reference a component. */
  key: 'businessProfile' | 'financialInformation' | 'marketValidation' | 'teamStrength' | 'proposalQuality';
  name: string;
  /** 0-100 within this component. */
  score: number;
  /** Share of the overall score, from configuration. */
  weight: number;
  /** Points this component contributed overall, i.e. score x weight. */
  contribution: number;
  reason: string;
  /** Human-readable names of fields that would raise this score. */
  missing: string[];
}

export interface ReadinessResult {
  overallScore: number;
  category: string;
  components: ReadinessComponent[];
  missingInformation: string[];
  recommendations: string[];
  modelVersion: string;
}

/** A field that contributes to a component score. */
interface Check {
  label: string;
  /** Relative importance within its component. */
  points: number;
  satisfied: boolean;
}

/** Text counts as substantive only above a floor — "n/a" should not score. */
const MIN_NARRATIVE_CHARS = 60;

function hasText(value: string | null | undefined, min = MIN_NARRATIVE_CHARS): boolean {
  return typeof value === 'string' && value.trim().length >= min;
}

function hasNumber(value: number | null | undefined): boolean {
  return typeof value === 'number' && Number.isFinite(value);
}

function hasItems(value: string[] | undefined): boolean {
  return Array.isArray(value) && value.length > 0;
}

/**
 * Scores a component from its checks.
 *
 * Returns 0 with every check listed as missing when nothing is satisfied,
 * rather than a misleading partial score.
 */
function scoreChecks(checks: Check[]): { score: number; missing: string[] } {
  const total = checks.reduce((sum, c) => sum + c.points, 0);
  if (total === 0) return { score: 0, missing: [] };

  const earned = checks.filter((c) => c.satisfied).reduce((sum, c) => sum + c.points, 0);
  return {
    score: Math.round((earned / total) * 100),
    missing: checks.filter((c) => !c.satisfied).map((c) => c.label),
  };
}

function describe(score: number, strong: string, partial: string, weak: string): string {
  if (score >= 75) return strong;
  if (score >= 40) return partial;
  return weak;
}

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

function businessProfileComponent(p: ReadinessProfileInput): Omit<ReadinessComponent, 'weight' | 'contribution'> {
  const checks: Check[] = [
    { label: 'Business name', points: 1, satisfied: hasText(p.businessName, 2) },
    { label: 'Legal business type', points: 2, satisfied: Boolean(p.businessType) },
    { label: 'Industry', points: 2, satisfied: Boolean(p.industry) },
    { label: 'Location and state', points: 2, satisfied: Boolean(p.location) && Boolean(p.state) },
    { label: 'Year founded', points: 1, satisfied: hasNumber(p.foundedYear) },
    { label: 'Business stage', points: 2, satisfied: Boolean(p.businessStage) },
    { label: 'Business description', points: 3, satisfied: hasText(p.description) },
    { label: 'Problem statement', points: 3, satisfied: hasText(p.problem) },
    { label: 'Solution description', points: 3, satisfied: hasText(p.solution) },
    { label: 'Product or service status', points: 2, satisfied: Boolean(p.productStatus) },
    // Registration status gates eligibility for many government schemes, so its
    // absence genuinely reduces readiness rather than being cosmetic.
    { label: 'Udyam registration status', points: 2, satisfied: p.udyamRegistered !== null && p.udyamRegistered !== undefined },
    { label: 'GST registration status', points: 1, satisfied: p.gstRegistered !== null && p.gstRegistered !== undefined },
  ];

  const { score, missing } = scoreChecks(checks);
  return {
    key: 'businessProfile',
    name: 'Business Profile',
    score,
    missing,
    reason: describe(
      score,
      'Your profile covers the core facts a funder or scheme assessor looks for first.',
      'The essentials are present, but some profile fields that schemes commonly check are still blank.',
      'Key profile information is missing, which limits how accurately your business can be matched.',
    ),
  };
}

function financialComponent(p: ReadinessProfileInput): Omit<ReadinessComponent, 'weight' | 'contribution'> {
  const checks: Check[] = [
    { label: 'Annual revenue', points: 3, satisfied: hasNumber(p.annualRevenue) },
    { label: 'Annual expenses', points: 3, satisfied: hasNumber(p.annualExpenses) },
    { label: 'Profit or loss', points: 2, satisfied: hasNumber(p.profitLoss) },
    { label: 'Existing funding raised', points: 2, satisfied: hasNumber(p.existingFunding) },
    { label: 'Existing debt', points: 2, satisfied: hasNumber(p.existingDebt) },
    { label: 'Growth rate', points: 2, satisfied: hasNumber(p.growthRate) },
  ];

  const { score, missing } = scoreChecks(checks);
  return {
    key: 'financialInformation',
    name: 'Financial Information',
    score,
    missing,
    reason: describe(
      score,
      'Your financial position is documented well enough to support a funding conversation.',
      'Headline figures are available, but the financial picture is incomplete.',
      'Financial information is largely absent. Most funders and schemes treat this as a prerequisite.',
    ),
  };
}

function marketComponent(p: ReadinessProfileInput): Omit<ReadinessComponent, 'weight' | 'contribution'> {
  const checks: Check[] = [
    { label: 'Target customer definition', points: 3, satisfied: hasText(p.targetCustomer, 30) },
    // A customer count is the strongest single piece of demand evidence, so it
    // carries the most weight here.
    { label: 'Customer count', points: 4, satisfied: hasNumber(p.customerCount) && (p.customerCount ?? 0) > 0 },
    { label: 'Named customers or pilots', points: 3, satisfied: hasItems(p.customers) },
    { label: 'Partnerships', points: 2, satisfied: hasItems(p.partnerships) },
    { label: 'Market size estimate', points: 2, satisfied: hasNumber(p.marketSize) },
  ];

  const { score, missing } = scoreChecks(checks);
  return {
    key: 'marketValidation',
    name: 'Market Validation',
    score,
    missing,
    reason: describe(
      score,
      'You can point to measurable evidence that customers want what you are building.',
      'There is some demand evidence, but it is thin — assessors look for measurable traction.',
      'Market validation evidence is missing. Claims about demand carry little weight without it.',
    ),
  };
}

function teamComponent(p: ReadinessProfileInput): Omit<ReadinessComponent, 'weight' | 'contribution'> {
  const checks: Check[] = [
    { label: 'Team size', points: 2, satisfied: hasNumber(p.teamSize) && (p.teamSize ?? 0) > 0 },
    { label: 'Founder experience (years)', points: 3, satisfied: hasNumber(p.founderExperience) },
    { label: 'Team strengths description', points: 3, satisfied: hasText(p.teamStrength, 40) },
    { label: 'Certifications', points: 1, satisfied: hasItems(p.certifications) },
    { label: 'Intellectual property', points: 1, satisfied: hasItems(p.intellectualProperty) },
  ];

  const { score, missing } = scoreChecks(checks);
  return {
    key: 'teamStrength',
    name: 'Team Strength',
    score,
    missing,
    reason: describe(
      score,
      'Your team information communicates relevant capability to deliver the plan.',
      'Basic team information is present, but its relevance to this business is not fully evidenced.',
      'Team information is missing, so your capability to execute cannot be assessed.',
    ),
  };
}

/**
 * Proposal quality.
 *
 * `proposalScore` is the overall score from the most recent completed proposal
 * analysis, or null when no proposal has been analysed. Null scores 0 and says
 * why — it is never silently treated as average, which would inflate readiness
 * for a business that has uploaded nothing.
 */
function proposalComponent(
  proposalScore: number | null,
  requirement: ReadinessRequirementInput | null,
): Omit<ReadinessComponent, 'weight' | 'contribution'> {
  if (proposalScore === null) {
    const missing = ['Uploaded and analysed funding proposal'];
    if (!requirement || !hasNumber(requirement.amountRequired)) missing.push('Stated funding requirement');

    return {
      key: 'proposalQuality',
      name: 'Proposal Quality',
      score: 0,
      missing,
      reason: 'No proposal has been analysed yet, so this component cannot contribute to your readiness score.',
    };
  }

  const bounded = Math.max(0, Math.min(100, Math.round(proposalScore)));
  return {
    key: 'proposalQuality',
    name: 'Proposal Quality',
    score: bounded,
    missing: bounded >= 75 ? [] : ['Address the weaknesses identified in your proposal analysis'],
    reason: describe(
      bounded,
      'Your most recent proposal analysis scored well on clarity, completeness and justification.',
      'Your proposal analysis found a workable document with specific areas to strengthen.',
      'Your proposal analysis found significant gaps. Improving it is the fastest way to raise this score.',
    ),
  };
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

function categorise(score: number, categories: ReadinessCategoryBands): string {
  // Highest band whose floor the score reaches.
  const sorted = [...categories].sort((a, b) => b.min - a.min);
  return sorted.find((band) => score >= band.min)?.label ?? sorted[sorted.length - 1]?.label ?? 'Unknown';
}

/**
 * Turns the lowest-scoring components into concrete next steps.
 *
 * Driven by actual missing fields, so the advice is specific to this business
 * rather than generic encouragement.
 */
function buildRecommendations(components: ReadinessComponent[]): string[] {
  return components
    .filter((c) => c.score < 75 && c.missing.length > 0)
    // Weakest contribution first: the biggest available gain.
    .sort((a, b) => a.score * a.weight - b.score * b.weight)
    .slice(0, 4)
    .map((c) => {
      const items = c.missing.slice(0, 3).join(', ');
      return `${c.name}: add ${items.toLowerCase()}.`;
    });
}

export function calculateReadiness(input: {
  profile: ReadinessProfileInput;
  requirement?: ReadinessRequirementInput | null;
  /** Overall score of the latest proposal analysis, or null if none exists. */
  proposalScore?: number | null;
  weights: ReadinessWeights;
  categories: ReadinessCategoryBands;
}): ReadinessResult {
  const { profile, requirement = null, proposalScore = null, weights, categories } = input;

  const raw = [
    businessProfileComponent(profile),
    financialComponent(profile),
    marketComponent(profile),
    teamComponent(profile),
    proposalComponent(proposalScore, requirement),
  ];

  const weightByKey: Record<ReadinessComponent['key'], number> = {
    businessProfile: weights.businessProfile,
    financialInformation: weights.financialInformation,
    marketValidation: weights.marketValidation,
    teamStrength: weights.teamStrength,
    proposalQuality: weights.proposalQuality,
  };

  const components: ReadinessComponent[] = raw.map((c) => {
    const weight = weightByKey[c.key];
    return {
      ...c,
      weight,
      // Rounded for display only; the overall total uses the unrounded value.
      contribution: Math.round(c.score * weight * 10) / 10,
    };
  });

  const overallScore = Math.round(components.reduce((sum, c) => sum + c.score * weightByKey[c.key], 0));

  // De-duplicated across components, preserving the order they were surfaced in.
  const missingInformation = [...new Set(components.flatMap((c) => c.missing))];

  return {
    overallScore,
    category: categorise(overallScore, categories),
    components,
    missingInformation,
    recommendations: buildRecommendations(components),
    modelVersion: MODEL_VERSIONS.readiness,
  };
}
