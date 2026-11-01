/**
 * Scoring configuration — weights, thresholds and controlled vocabularies.
 *
 * These are the *defaults*. At runtime the engines read the active row from the
 * `MatchingConfig` table, which an admin can change and which is version-stamped
 * onto every derived score via `configVersion`. That is what makes a stored
 * score reproducible, and what lets the research layer compare weightings
 * without editing code (master spec §16, §50).
 *
 * Nothing here may be duplicated in the frontend. The UI renders whatever
 * breakdown the API returns; it never knows a weight.
 */
import { z } from 'zod';

/** Bumped when the *shape* or default values change, so old scores stay traceable. */
export const CONFIG_VERSION = 'config-v1';

/** Bumped when scoring *logic* changes, independently of the weights. */
export const MODEL_VERSIONS = {
  schemeMatching: 'scheme-matching-v1',
  investorMatching: 'investor-matching-v1',
  readiness: 'readiness-v1',
  proposalAnalysis: 'proposal-analysis-v1',
} as const;

/**
 * Weights must sum to 1 within a small tolerance. A set that sums to 0.95
 * silently caps every score at 95 and would look like a scoring bug months
 * later, so it is rejected at load time instead.
 */
const WEIGHT_SUM_TOLERANCE = 1e-6;

function weightsSummingToOne<T extends z.ZodRawShape>(shape: T) {
  return z.object(shape).superRefine((val, ctx) => {
    const sum = Object.values(val as Record<string, number>).reduce((a, b) => a + b, 0);
    if (Math.abs(sum - 1) > WEIGHT_SUM_TOLERANCE) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `weights must sum to 1, got ${sum.toFixed(6)}`,
      });
    }
  });
}

const weight = z.number().min(0).max(1);

// ---------------------------------------------------------------------------
// Government scheme matching
// ---------------------------------------------------------------------------

export const schemeMatchingWeightsSchema = weightsSummingToOne({
  industry: weight,
  businessStage: weight,
  businessType: weight,
  location: weight,
  fundingRequirement: weight,
  purpose: weight,
  /**
   * Semantic relevance is weighted low on purpose. It is a discovery signal,
   * not evidence of eligibility — embeddings must never decide a legal
   * criterion (master spec §9).
   */
  semanticRelevance: weight,
});

export const schemeMatchingThresholdsSchema = z.object({
  /** Below this the scheme is not surfaced at all. */
  minimumScoreToSurface: z.number().int().min(0).max(100),
  /** At or above this, and with no blocking issue, status is POTENTIALLY_ELIGIBLE. */
  potentiallyEligible: z.number().int().min(0).max(100),
  /** At or above this, but with unknowns present, status is NEEDS_INFORMATION. */
  needsInformation: z.number().int().min(0).max(100),
  /** Maximum matches persisted per business, to bound recalculation cost. */
  maxMatchesPerBusiness: z.number().int().positive(),
});

// ---------------------------------------------------------------------------
// Investor matching
// ---------------------------------------------------------------------------

export const investorMatchingWeightsSchema = weightsSummingToOne({
  industry: weight,
  funding: weight,
  stage: weight,
  location: weight,
  fundingType: weight,
});

// ---------------------------------------------------------------------------
// Funding readiness
// ---------------------------------------------------------------------------

export const readinessWeightsSchema = weightsSummingToOne({
  businessProfile: weight,
  financialInformation: weight,
  marketValidation: weight,
  teamStrength: weight,
  proposalQuality: weight,
});

/**
 * Category bands. `min` is inclusive; the label is chosen by the highest band
 * whose `min` the score reaches.
 */
export const readinessCategoriesSchema = z
  .array(z.object({ min: z.number().int().min(0).max(100), label: z.string().min(1) }))
  .min(1)
  .refine((bands) => bands.some((b) => b.min === 0), { message: 'a band starting at 0 is required' });

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

export const DEFAULT_SCHEME_MATCHING_WEIGHTS = {
  industry: 0.25,
  businessStage: 0.2,
  businessType: 0.15,
  location: 0.1,
  fundingRequirement: 0.15,
  purpose: 0.1,
  semanticRelevance: 0.05,
} as const;

export const DEFAULT_SCHEME_MATCHING_THRESHOLDS = {
  minimumScoreToSurface: 35,
  potentiallyEligible: 70,
  needsInformation: 45,
  maxMatchesPerBusiness: 50,
} as const;

export const DEFAULT_INVESTOR_MATCHING_WEIGHTS = {
  industry: 0.3,
  funding: 0.25,
  stage: 0.2,
  location: 0.15,
  fundingType: 0.1,
} as const;

export const DEFAULT_READINESS_WEIGHTS = {
  businessProfile: 0.2,
  financialInformation: 0.25,
  marketValidation: 0.2,
  teamStrength: 0.15,
  proposalQuality: 0.2,
} as const;

export const DEFAULT_READINESS_CATEGORIES = [
  { min: 0, label: 'Needs Significant Improvement' },
  { min: 40, label: 'Developing' },
  { min: 60, label: 'Moderate' },
  { min: 75, label: 'Good' },
  { min: 90, label: 'Strong' },
] as const;

/**
 * Controlled industry vocabulary. Extensible by design — the normaliser maps
 * variants ("Fin Tech", "Financial Technology") onto these rather than letting
 * them become separate categories (master spec §60).
 */
export const INDUSTRY_VOCABULARY = [
  'Technology',
  'Information Technology',
  'FinTech',
  'HealthTech',
  'EdTech',
  'AgriTech',
  'Construction Technology',
  'Manufacturing',
  'Retail',
  'Logistics',
  'Food Processing',
  'Textiles',
  'Renewable Energy',
  'Handicrafts',
  'Tourism and Hospitality',
  'Professional Services',
  'Other',
] as const;

/** Funding purposes the matcher understands. */
export const FUNDING_PURPOSE_VOCABULARY = [
  'Product Development',
  'Working Capital',
  'Equipment Purchase',
  'Business Expansion',
  'Marketing',
  'Research and Development',
  'Hiring',
  'Infrastructure',
  'Technology Adoption',
  'Export Promotion',
  'Other',
] as const;

// ---------------------------------------------------------------------------
// Config keys and validation registry
// ---------------------------------------------------------------------------

export const CONFIG_KEYS = {
  schemeMatchingWeights: 'scheme_matching_weights',
  schemeMatchingThresholds: 'scheme_matching_thresholds',
  investorMatchingWeights: 'investor_matching_weights',
  readinessWeights: 'readiness_weights',
  readinessCategories: 'readiness_categories',
} as const;

export type ConfigKey = (typeof CONFIG_KEYS)[keyof typeof CONFIG_KEYS];

/**
 * Schema per config key, so an admin-supplied JSON blob is validated before it
 * can be stored — an invalid weight set must never reach the scoring engines.
 */
export const CONFIG_SCHEMAS: Record<ConfigKey, z.ZodTypeAny> = {
  [CONFIG_KEYS.schemeMatchingWeights]: schemeMatchingWeightsSchema,
  [CONFIG_KEYS.schemeMatchingThresholds]: schemeMatchingThresholdsSchema,
  [CONFIG_KEYS.investorMatchingWeights]: investorMatchingWeightsSchema,
  [CONFIG_KEYS.readinessWeights]: readinessWeightsSchema,
  [CONFIG_KEYS.readinessCategories]: readinessCategoriesSchema,
};

export const CONFIG_DEFAULTS: Record<ConfigKey, unknown> = {
  [CONFIG_KEYS.schemeMatchingWeights]: DEFAULT_SCHEME_MATCHING_WEIGHTS,
  [CONFIG_KEYS.schemeMatchingThresholds]: DEFAULT_SCHEME_MATCHING_THRESHOLDS,
  [CONFIG_KEYS.investorMatchingWeights]: DEFAULT_INVESTOR_MATCHING_WEIGHTS,
  [CONFIG_KEYS.readinessWeights]: DEFAULT_READINESS_WEIGHTS,
  [CONFIG_KEYS.readinessCategories]: DEFAULT_READINESS_CATEGORIES,
};

export type SchemeMatchingWeights = z.infer<typeof schemeMatchingWeightsSchema>;
export type SchemeMatchingThresholds = z.infer<typeof schemeMatchingThresholdsSchema>;
export type InvestorMatchingWeights = z.infer<typeof investorMatchingWeightsSchema>;
export type ReadinessWeights = z.infer<typeof readinessWeightsSchema>;
export type ReadinessCategories = z.infer<typeof readinessCategoriesSchema>;

/**
 * Validates every default at module load. A typo in a weight becomes a startup
 * failure rather than a quietly wrong score in production.
 */
export function assertDefaultsValid(): void {
  for (const [key, schema] of Object.entries(CONFIG_SCHEMAS)) {
    const result = schema.safeParse(CONFIG_DEFAULTS[key as ConfigKey]);
    if (!result.success) {
      throw new Error(`Invalid default for "${key}": ${result.error.issues.map((i) => i.message).join('; ')}`);
    }
  }
}

assertDefaultsValid();
