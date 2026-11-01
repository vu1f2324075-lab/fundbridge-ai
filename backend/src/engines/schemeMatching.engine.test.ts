import { describe, it, expect } from 'vitest';
import {
  matchSchemeToBusiness,
  type BusinessInput,
  type RequirementInput,
  type SchemeInput,
} from './schemeMatching.engine';
import { DEFAULT_SCHEME_MATCHING_THRESHOLDS, DEFAULT_SCHEME_MATCHING_WEIGHTS } from '../config/matching';

const weights = DEFAULT_SCHEME_MATCHING_WEIGHTS;
const thresholds = DEFAULT_SCHEME_MATCHING_THRESHOLDS;
const CURRENT_YEAR = 2026;

const business: BusinessInput = {
  businessType: 'PRIVATE_LIMITED',
  industry: 'Construction Technology',
  subIndustry: 'Equipment Management Software',
  businessStage: 'GROWTH',
  location: 'Mumbai',
  state: 'Maharashtra',
  country: 'India',
  foundedYear: 2021,
  teamSize: 12,
  annualRevenue: 3_500_000,
  udyamRegistered: true,
  dpiitRecognised: false,
  gstRegistered: true,
};

const requirement: RequirementInput = {
  amountRequired: 5_000_000,
  fundingType: 'ANY_SUITABLE',
  purpose: 'Business Expansion',
};

/** A scheme that matches the business on every stated criterion. */
const matchingScheme: SchemeInput = {
  id: 'scheme-1',
  name: 'Test Expansion Scheme',
  targetBusinessTypes: ['PRIVATE_LIMITED', 'LLP'],
  supportedIndustries: ['Construction Technology', 'Manufacturing'],
  supportedStages: ['GROWTH', 'EXPANSION'],
  supportedLocations: ['Maharashtra'],
  supportedFundingTypes: ['GRANT'],
  supportedPurposes: ['Business Expansion'],
  minFunding: 1_000_000,
  maxFunding: 10_000_000,
  eligibilityRules: {},
  eligibilityCriteria: ['Must be a registered enterprise'],
  requiredDocuments: ['Udyam certificate'],
};

const run = (
  scheme: Partial<SchemeInput> = {},
  biz: Partial<BusinessInput> = {},
  req: Partial<RequirementInput> = {},
  semanticScore: number | null = null,
) =>
  matchSchemeToBusiness({
    scheme: { ...matchingScheme, ...scheme },
    business: { ...business, ...biz },
    requirement: { ...requirement, ...req },
    semanticScore,
    weights,
    thresholds,
    currentYear: CURRENT_YEAR,
  });

describe('scoring', () => {
  it('scores a fully matching scheme at 100 and reports potential eligibility', () => {
    const result = run();
    expect(result.eligibilityScore).toBe(100);
    expect(result.status).toBe('POTENTIALLY_ELIGIBLE');
    expect(result.blockingIssues).toEqual([]);
    expect(result.missingCriteria).toEqual([]);
  });

  it('is deterministic', () => {
    expect(run()).toEqual(run());
  });

  it('renormalises weights so an absent semantic score does not cap the total', () => {
    // Semantic relevance is 5%. Without it the remaining factors must still be
    // able to reach 100, not 95.
    const withoutSemantic = run();
    expect(withoutSemantic.factors.some((f) => f.key === 'semanticRelevance')).toBe(false);
    expect(withoutSemantic.eligibilityScore).toBe(100);

    const withSemantic = run({}, {}, {}, 1);
    expect(withSemantic.factors.some((f) => f.key === 'semanticRelevance')).toBe(true);
    expect(withSemantic.eligibilityScore).toBe(100);

    // Factor weights always sum to 1 regardless of which are present.
    for (const r of [withoutSemantic, withSemantic]) {
      expect(r.factors.reduce((s, f) => s + f.weight, 0)).toBeCloseTo(1, 6);
    }
  });

  it('includes the semantic factor but labels it as a relevance signal only', () => {
    const result = run({}, {}, {}, 0.9);
    const semantic = result.factors.find((f) => f.key === 'semanticRelevance');
    expect(semantic?.score).toBe(0.9);
    expect(semantic?.reason).toMatch(/not evidence of eligibility/i);
  });

  it('clamps an out-of-range semantic score', () => {
    expect(run({}, {}, {}, 5).factors.find((f) => f.key === 'semanticRelevance')?.score).toBe(1);
    expect(run({}, {}, {}, -5).factors.find((f) => f.key === 'semanticRelevance')?.score).toBe(0);
  });
});

describe('unrestricted criteria score full credit', () => {
  it('treats an empty scheme list as excluding nobody', () => {
    const result = run({ supportedIndustries: [], supportedStages: [], targetBusinessTypes: [], supportedLocations: [], supportedPurposes: [] });
    for (const f of result.factors) {
      if (f.key !== 'fundingRequirement' && f.key !== 'semanticRelevance') {
        expect(f.outcome).toBe('UNRESTRICTED');
        expect(f.score).toBe(1);
      }
    }
    expect(result.eligibilityScore).toBe(100);
  });

  it('says so in the explanation rather than claiming a match', () => {
    const result = run({ supportedIndustries: [] });
    const industry = result.factors.find((f) => f.key === 'industry');
    expect(industry?.reason).toMatch(/does not restrict/i);
  });
});

describe('unknown business data scores zero, not partial credit', () => {
  it('scores an unprovided industry at zero and reports it as missing', () => {
    const result = run({}, { industry: null, subIndustry: null });
    const industry = result.factors.find((f) => f.key === 'industry');

    expect(industry?.outcome).toBe('UNKNOWN');
    // Half credit here would invent a partial match the data does not support.
    expect(industry?.score).toBe(0);
    expect(result.missingCriteria.some((m) => /industry/i.test(m))).toBe(true);
  });

  it('forces NEEDS_INFORMATION even when the remaining score is high', () => {
    const result = run({}, { industry: null, subIndustry: null });
    expect(result.eligibilityScore).toBeGreaterThan(thresholds.potentiallyEligible);
    // The score is a floor, so it must not be presented as potential eligibility.
    expect(result.status).toBe('NEEDS_INFORMATION');
  });

  it('reports an unstated funding requirement as unknown rather than mismatched', () => {
    const result = run({}, {}, { amountRequired: null });
    const funding = result.factors.find((f) => f.key === 'fundingRequirement');
    expect(funding?.outcome).toBe('UNKNOWN');
    expect(result.status).toBe('NEEDS_INFORMATION');
  });
});

describe('industry matching', () => {
  it('matches through the sub-industry when the primary industry does not match', () => {
    const result = run(
      { supportedIndustries: ['Equipment Management Software'] },
      { industry: 'Technology', subIndustry: 'Equipment Management Software' },
    );
    expect(result.factors.find((f) => f.key === 'industry')?.outcome).toBe('MATCH');
  });

  it('ignores case, spacing and punctuation differences', () => {
    for (const variant of ['fintech', 'Fin-Tech', 'FIN TECH', 'Fin  Tech']) {
      const result = run({ supportedIndustries: ['FinTech'] }, { industry: variant, subIndustry: null });
      expect(result.factors.find((f) => f.key === 'industry')?.outcome).toBe('MATCH');
    }
  });

  it('matches a broader scheme category containing the business industry', () => {
    const result = run({ supportedIndustries: ['Information Technology'] }, { industry: 'Technology', subIndustry: null });
    expect(result.factors.find((f) => f.key === 'industry')?.outcome).toBe('MATCH');
  });

  it('reports a genuine mismatch', () => {
    const result = run({ supportedIndustries: ['Textiles'] }, { industry: 'Construction Technology', subIndustry: null });
    expect(result.factors.find((f) => f.key === 'industry')?.outcome).toBe('MISMATCH');
  });
});

describe('location matching', () => {
  it('matches at any geographic level', () => {
    expect(run({ supportedLocations: ['Mumbai'] }).factors.find((f) => f.key === 'location')?.outcome).toBe('MATCH');
    expect(run({ supportedLocations: ['Maharashtra'] }).factors.find((f) => f.key === 'location')?.outcome).toBe('MATCH');
    expect(run({ supportedLocations: ['India'] }).factors.find((f) => f.key === 'location')?.outcome).toBe('MATCH');
  });

  it('reports a mismatch for an unrelated state', () => {
    expect(run({ supportedLocations: ['Kerala'] }).factors.find((f) => f.key === 'location')?.outcome).toBe('MISMATCH');
  });

  it('reports unknown when no geography is on the profile', () => {
    const result = run({ supportedLocations: ['Kerala'] }, { location: null, state: null, country: null });
    expect(result.factors.find((f) => f.key === 'location')?.outcome).toBe('UNKNOWN');
  });
});

describe('funding range', () => {
  it('matches a requirement inside the range', () => {
    expect(run().factors.find((f) => f.key === 'fundingRequirement')?.score).toBe(1);
  });

  it('grades a requirement above the ceiling by the fraction coverable', () => {
    // Ceiling 1,000,000 against a 5,000,000 need covers one fifth.
    const result = run({ minFunding: 0, maxFunding: 1_000_000 });
    const funding = result.factors.find((f) => f.key === 'fundingRequirement');
    expect(funding?.outcome).toBe('MISMATCH');
    expect(funding?.score).toBeCloseTo(0.2, 6);
  });

  it('grades a requirement below the floor by how close it comes', () => {
    const result = run({ minFunding: 10_000_000, maxFunding: 50_000_000 });
    const funding = result.factors.find((f) => f.key === 'fundingRequirement');
    expect(funding?.outcome).toBe('MISMATCH');
    expect(funding?.score).toBeCloseTo(0.5, 6);
  });

  it('treats a scheme with no stated range as unrestricted', () => {
    const result = run({ minFunding: null, maxFunding: null });
    expect(result.factors.find((f) => f.key === 'fundingRequirement')?.outcome).toBe('UNRESTRICTED');
  });

  it('handles an open-ended maximum', () => {
    const result = run({ minFunding: 1_000, maxFunding: null });
    expect(result.factors.find((f) => f.key === 'fundingRequirement')?.outcome).toBe('MATCH');
  });

  it('treats a zero or negative requirement as unknown rather than dividing by it', () => {
    for (const amount of [0, -100]) {
      const result = run({}, {}, { amountRequired: amount });
      expect(result.factors.find((f) => f.key === 'fundingRequirement')?.outcome).toBe('UNKNOWN');
      expect(Number.isFinite(result.eligibilityScore)).toBe(true);
    }
  });
});

describe('hard eligibility gates', () => {
  it('blocks when a required registration is recorded as absent', () => {
    const result = run({ eligibilityRules: { requiresDpiitRecognition: true } });
    // The business has dpiitRecognised: false.
    expect(result.blockingIssues.length).toBe(1);
    expect(result.blockingIssues[0]).toMatch(/DPIIT/);
    expect(result.status).toBe('LIKELY_NOT_ELIGIBLE');
  });

  it('lets a blocker override a high score, which would otherwise mislead', () => {
    const result = run({ eligibilityRules: { requiresDpiitRecognition: true } });
    expect(result.eligibilityScore).toBe(100);
    expect(result.status).toBe('LIKELY_NOT_ELIGIBLE');
  });

  it('distinguishes an unanswered condition from a failed one', () => {
    const unanswered = run({ eligibilityRules: { requiresDpiitRecognition: true } }, { dpiitRecognised: null });
    expect(unanswered.blockingIssues).toEqual([]);
    expect(unanswered.missingCriteria.some((m) => /DPIIT/.test(m))).toBe(true);
    expect(unanswered.status).toBe('NEEDS_INFORMATION');
  });

  it('counts a satisfied condition as evidence for the match', () => {
    const result = run({ eligibilityRules: { requiresUdyamRegistration: true } });
    expect(result.matchedCriteria.some((m) => /Udyam/.test(m))).toBe(true);
    expect(result.blockingIssues).toEqual([]);
  });

  it('treats an absent rule as no constraint, not as a failed condition', () => {
    const result = run({ eligibilityRules: {} }, { udyamRegistered: false, dpiitRecognised: false, gstRegistered: false });
    expect(result.blockingIssues).toEqual([]);
    expect(result.status).toBe('POTENTIALLY_ELIGIBLE');
  });

  it('enforces a maximum business age', () => {
    // Founded 2021, current year 2026 -> about 5 years old.
    const ok = run({ eligibilityRules: { maxBusinessAgeYears: 10 } });
    expect(ok.blockingIssues).toEqual([]);

    const tooOld = run({ eligibilityRules: { maxBusinessAgeYears: 3 } });
    expect(tooOld.blockingIssues[0]).toMatch(/up to 3 years old/);
  });

  it('enforces a revenue ceiling', () => {
    const result = run({ eligibilityRules: { maxAnnualRevenue: 1_000_000 } });
    expect(result.blockingIssues[0]).toMatch(/revenue is above/);
  });

  it('flags a scheme whose stored rules cannot be interpreted, instead of matching on partial criteria', () => {
    const result = run({ eligibilityRules: { someUnknownRule: 'nonsense' } });
    expect(result.blockingIssues.some((b) => /administrator review/i.test(b))).toBe(true);
    expect(result.status).toBe('LIKELY_NOT_ELIGIBLE');
  });
});

describe('explanation object', () => {
  it('carries the evidence, the stated criteria and the disclaimer', () => {
    const result = run();
    expect(result.explanation.schemeName).toBe('Test Expansion Scheme');
    expect(result.explanation.eligibilityScore).toBe(result.eligibilityScore);
    expect(result.explanation.statedCriteria).toEqual(['Must be a registered enterprise']);
    expect(result.explanation.requiredDocuments).toEqual(['Udyam certificate']);
    expect(result.explanation.disclaimer).toMatch(/not an eligibility decision/i);
  });

  it('gives every factor a reason describing the comparison performed', () => {
    for (const f of run({}, {}, {}, 0.8).factors) {
      expect(f.reason.length).toBeGreaterThan(20);
    }
  });

  it('never claims a guarantee or an approval', () => {
    const serialised = JSON.stringify(run().explanation).toLowerCase();
    for (const banned of ['guarantee', 'guaranteed', 'approved', 'you are eligible', 'will receive']) {
      expect(serialised).not.toContain(banned);
    }
  });

  it('stamps the model version', () => {
    expect(run().modelVersion).toBe('scheme-matching-v1');
  });
});
