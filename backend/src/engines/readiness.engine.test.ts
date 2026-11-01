import { describe, it, expect } from 'vitest';
import { calculateReadiness, type ReadinessProfileInput } from './readiness.engine';
import { DEFAULT_READINESS_CATEGORIES, DEFAULT_READINESS_WEIGHTS } from '../config/matching';

const weights = DEFAULT_READINESS_WEIGHTS;
const categories = DEFAULT_READINESS_CATEGORIES;

const NARRATIVE =
  'A sufficiently long description that clears the substantive-text threshold used by the engine for narrative fields.';

/** A profile with everything the engine looks for. */
const completeProfile: ReadinessProfileInput = {
  businessName: 'BuildTech Solutions',
  businessType: 'PRIVATE_LIMITED',
  industry: 'Construction Technology',
  location: 'Mumbai',
  state: 'Maharashtra',
  foundedYear: 2021,
  businessStage: 'GROWTH',
  teamSize: 12,
  description: NARRATIVE,
  problem: NARRATIVE,
  solution: NARRATIVE,
  targetCustomer: 'Mid-sized construction contractors operating multiple sites.',
  productStatus: 'LAUNCHED',
  customerCount: 14,
  annualRevenue: 3_500_000,
  annualExpenses: 3_400_000,
  profitLoss: 100_000,
  existingFunding: 1_000_000,
  existingDebt: 0,
  growthRate: 0.4,
  marketSize: 1_200_000_000,
  founderExperience: 7,
  teamStrength: 'Two technical co-founders with construction-sector backgrounds and eight engineers.',
  customers: ['Regional contractor'],
  partnerships: ['Equipment dealer network'],
  certifications: ['Udyam Registered'],
  intellectualProperty: ['Pending patent'],
  udyamRegistered: true,
  dpiitRecognised: false,
  gstRegistered: true,
};

const run = (profile: ReadinessProfileInput, proposalScore: number | null = null) =>
  calculateReadiness({ profile, proposalScore, weights, categories });

describe('calculateReadiness', () => {
  it('scores an empty profile at zero and lists what is missing', () => {
    const result = run({});
    expect(result.overallScore).toBe(0);
    expect(result.category).toBe('Needs Significant Improvement');
    expect(result.missingInformation.length).toBeGreaterThan(10);
  });

  it('never exceeds 100 even with a perfect profile and proposal', () => {
    const result = run(completeProfile, 100);
    expect(result.overallScore).toBe(100);
    expect(result.category).toBe('Strong');
  });

  it('is deterministic — identical input gives identical output', () => {
    expect(run(completeProfile, 70)).toEqual(run(completeProfile, 70));
  });

  it('returns every component with its weight and contribution', () => {
    const result = run(completeProfile, 80);
    expect(result.components.map((c) => c.key)).toEqual([
      'businessProfile',
      'financialInformation',
      'marketValidation',
      'teamStrength',
      'proposalQuality',
    ]);
    // Weights come from configuration, not from the engine.
    const sum = result.components.reduce((s, c) => s + c.weight, 0);
    expect(sum).toBeCloseTo(1, 6);
  });

  it('weights components as configured', () => {
    // Financial is 25% of the total. A profile with only financial data complete
    // should land near 25.
    const financialOnly: ReadinessProfileInput = {
      annualRevenue: 1,
      annualExpenses: 1,
      profitLoss: 1,
      existingFunding: 1,
      existingDebt: 1,
      growthRate: 1,
    };
    const result = run(financialOnly);
    const financial = result.components.find((c) => c.key === 'financialInformation');
    expect(financial?.score).toBe(100);
    expect(result.overallScore).toBe(25);
  });

  it('scores proposal quality at zero when no proposal has been analysed, and says why', () => {
    const result = run(completeProfile, null);
    const proposal = result.components.find((c) => c.key === 'proposalQuality');

    expect(proposal?.score).toBe(0);
    expect(proposal?.reason).toMatch(/no proposal has been analysed/i);
    // Must not be silently treated as average, which would inflate readiness
    // for a business that has uploaded nothing.
    expect(result.overallScore).toBe(80);
  });

  it('passes a real proposal score straight through, bounded to 0-100', () => {
    expect(run(completeProfile, 65).components.find((c) => c.key === 'proposalQuality')?.score).toBe(65);
    expect(run(completeProfile, 140).components.find((c) => c.key === 'proposalQuality')?.score).toBe(100);
    expect(run(completeProfile, -20).components.find((c) => c.key === 'proposalQuality')?.score).toBe(0);
  });

  it('does not credit placeholder text for narrative fields', () => {
    const placeholder = run({ ...completeProfile, description: 'n/a', problem: '-', solution: 'TBD' });
    const full = run(completeProfile);
    expect(placeholder.overallScore).toBeLessThan(full.overallScore);
  });

  it('does not credit a zero customer count as demand evidence', () => {
    const zero = run({ ...completeProfile, customerCount: 0 });
    const some = run({ ...completeProfile, customerCount: 5 });
    expect(zero.overallScore).toBeLessThan(some.overallScore);
  });

  it('treats an unanswered registration question differently from an answered "no"', () => {
    // Knowing the business is NOT Udyam-registered is information; not knowing
    // is a gap, because schemes gate on it.
    const answered = run({ ...completeProfile, udyamRegistered: false });
    const unanswered = run({ ...completeProfile, udyamRegistered: null });
    expect(unanswered.overallScore).toBeLessThan(answered.overallScore);
  });

  it('gives every component a reason, and lists missing fields only when imperfect', () => {
    const result = run(completeProfile, 100);
    for (const c of result.components) {
      expect(c.reason.length).toBeGreaterThan(20);
      if (c.score === 100) expect(c.missing).toEqual([]);
    }
  });

  it('builds recommendations from actual gaps, worst contribution first', () => {
    const result = run({ ...completeProfile, annualRevenue: null, annualExpenses: null, profitLoss: null,
      existingFunding: null, existingDebt: null, growthRate: null });

    expect(result.recommendations.length).toBeGreaterThan(0);
    expect(result.recommendations.some((r) => r.startsWith('Financial Information'))).toBe(true);
  });

  it('produces no recommendations when nothing is missing', () => {
    expect(run(completeProfile, 100).recommendations).toEqual([]);
  });

  it('de-duplicates missing information across components', () => {
    const result = run({});
    expect(new Set(result.missingInformation).size).toBe(result.missingInformation.length);
  });

  it('stamps the model version so a stored score is traceable', () => {
    expect(run(completeProfile).modelVersion).toBe('readiness-v1');
  });
});

describe('category bands', () => {
  // Boundaries are inclusive on the lower edge; an off-by-one here would
  // mislabel a business's readiness.
  it.each([
    [0, 'Needs Significant Improvement'],
    [39, 'Needs Significant Improvement'],
    [40, 'Developing'],
    [59, 'Developing'],
    [60, 'Moderate'],
    [74, 'Moderate'],
    [75, 'Good'],
    [89, 'Good'],
    [90, 'Strong'],
    [100, 'Strong'],
  ])('scores %i as "%s"', (score, label) => {
    // Drive the overall score directly through the proposal component by giving
    // it full weight.
    const result = calculateReadiness({
      profile: {},
      proposalScore: score,
      weights: {
        businessProfile: 0,
        financialInformation: 0,
        marketValidation: 0,
        teamStrength: 0,
        proposalQuality: 1,
      },
      categories,
    });
    expect(result.overallScore).toBe(score);
    expect(result.category).toBe(label);
  });
});
