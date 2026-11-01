import { describe, it, expect } from 'vitest';
import {
  matchInvestorToBusiness,
  type BusinessSideInput,
  type FundingSideInput,
  type InvestorInput,
} from './investorMatching.engine';
import { DEFAULT_INVESTOR_MATCHING_WEIGHTS } from '../config/matching';

const weights = DEFAULT_INVESTOR_MATCHING_WEIGHTS;

const investor: InvestorInput = {
  id: 'inv-1',
  investorName: 'Test Ventures',
  investorType: 'VENTURE_CAPITAL',
  industries: ['Technology', 'Construction Technology'],
  preferredStages: ['EARLY', 'GROWTH'],
  preferredLocations: ['Maharashtra', 'India'],
  fundingTypes: ['EQUITY'],
  minInvestment: 2_500_000,
  maxInvestment: 10_000_000,
};

const business: BusinessSideInput = {
  industry: 'Construction Technology',
  subIndustry: 'Equipment Management Software',
  businessStage: 'GROWTH',
  location: 'Mumbai',
  state: 'Maharashtra',
  country: 'India',
};

const requirement: FundingSideInput = { amountRequired: 5_000_000, fundingType: 'EQUITY' };

const run = (
  inv: Partial<InvestorInput> = {},
  biz: Partial<BusinessSideInput> = {},
  req: Partial<FundingSideInput> = {},
) =>
  matchInvestorToBusiness({
    investor: { ...investor, ...inv },
    business: { ...business, ...biz },
    requirement: { ...requirement, ...req },
    weights,
  });

describe('scoring', () => {
  it('scores a full match at 100', () => {
    const result = run();
    expect(result.overallScore).toBe(100);
    expect(result.missingFactors).toEqual([]);
  });

  it('is deterministic', () => {
    expect(run()).toEqual(run());
  });

  it('always produces factor weights summing to 1', () => {
    expect(run().factors.reduce((s, f) => s + f.weight, 0)).toBeCloseTo(1, 6);
  });

  it('returns all five factors', () => {
    expect(run().factors.map((f) => f.key).sort()).toEqual([
      'fundingType',
      'funding',
      'industry',
      'location',
      'stage',
    ].sort());
  });

  it('stamps the model version', () => {
    expect(run().modelVersion).toBe('investor-matching-v1');
  });
});

describe('unstated preferences score neutrally, not fully', () => {
  it('scores an unstated industry preference at half', () => {
    const result = run({ industries: [] });
    const industry = result.factors.find((f) => f.key === 'industry');

    expect(industry?.outcome).toBe('UNSTATED');
    // Full credit would rank an investor who filled in nothing above one whose
    // stated preferences genuinely align.
    expect(industry?.score).toBe(0.5);
  });

  it('ranks a genuine match above an investor who stated nothing', () => {
    const stated = run();
    const blank = run({ industries: [], preferredStages: [], preferredLocations: [], fundingTypes: [], minInvestment: null, maxInvestment: null });
    expect(stated.overallScore).toBeGreaterThan(blank.overallScore);
  });

  it('reports unstated preferences as missing factors', () => {
    const result = run({ industries: [] });
    expect(result.missingFactors.some((m) => /not stated preferred industries/i.test(m))).toBe(true);
  });
});

describe('unknown business data scores zero', () => {
  it('scores an unprovided industry at zero, distinct from unstated', () => {
    const result = run({}, { industry: null, subIndustry: null });
    const industry = result.factors.find((f) => f.key === 'industry');
    expect(industry?.outcome).toBe('UNKNOWN');
    expect(industry?.score).toBe(0);
  });

  it('distinguishes the investor stating nothing from the business providing nothing', () => {
    const investorBlank = run({ industries: [] }).factors.find((f) => f.key === 'industry');
    const businessBlank = run({}, { industry: null, subIndustry: null }).factors.find((f) => f.key === 'industry');
    expect(investorBlank?.outcome).toBe('UNSTATED');
    expect(businessBlank?.outcome).toBe('UNKNOWN');
    expect(investorBlank?.score).toBeGreaterThan(businessBlank?.score ?? 1);
  });
});

describe('industry matching', () => {
  it('matches via sub-industry', () => {
    const result = run(
      { industries: ['Equipment Management Software'] },
      { industry: 'Manufacturing', subIndustry: 'Equipment Management Software' },
    );
    expect(result.factors.find((f) => f.key === 'industry')?.outcome).toBe('MATCH');
  });

  it('ignores case and punctuation', () => {
    for (const variant of ['fintech', 'Fin-Tech', 'FIN TECH']) {
      const result = run({ industries: ['FinTech'] }, { industry: variant, subIndustry: null });
      expect(result.factors.find((f) => f.key === 'industry')?.outcome).toBe('MATCH');
    }
  });

  it('reports a real mismatch', () => {
    const result = run({ industries: ['Textiles'] }, { industry: 'Technology', subIndustry: null });
    expect(result.factors.find((f) => f.key === 'industry')?.outcome).toBe('MISMATCH');
  });
});

describe('investment size', () => {
  it('matches inside the range', () => {
    expect(run().factors.find((f) => f.key === 'funding')?.score).toBe(1);
  });

  it('grades above the ceiling by the fraction coverable', () => {
    const result = run({ minInvestment: 0, maxInvestment: 1_000_000 });
    expect(result.factors.find((f) => f.key === 'funding')?.score).toBeCloseTo(0.2, 6);
  });

  it('grades below the floor by how close it comes', () => {
    const result = run({ minInvestment: 10_000_000, maxInvestment: 50_000_000 });
    expect(result.factors.find((f) => f.key === 'funding')?.score).toBeCloseTo(0.5, 6);
  });

  it('treats a zero or missing requirement as unknown without dividing by it', () => {
    for (const amount of [0, null]) {
      const result = run({}, {}, { amountRequired: amount });
      expect(result.factors.find((f) => f.key === 'funding')?.outcome).toBe('UNKNOWN');
      expect(Number.isFinite(result.overallScore)).toBe(true);
    }
  });

  it('handles an open-ended maximum', () => {
    const result = run({ minInvestment: 1_000, maxInvestment: null });
    expect(result.factors.find((f) => f.key === 'funding')?.outcome).toBe('MATCH');
  });
});

describe('funding type', () => {
  it('treats "any suitable" as compatible with whatever the investor offers', () => {
    const result = run({ fundingTypes: ['DEBT'] }, {}, { fundingType: 'ANY_SUITABLE' });
    const factor = result.factors.find((f) => f.key === 'fundingType');
    expect(factor?.outcome).toBe('MATCH');
    expect(factor?.score).toBe(1);
  });

  it('reports a mismatch when types differ', () => {
    const result = run({ fundingTypes: ['DEBT'] }, {}, { fundingType: 'EQUITY' });
    expect(result.factors.find((f) => f.key === 'fundingType')?.outcome).toBe('MISMATCH');
  });
});

describe('location', () => {
  it('matches at city, state or country level', () => {
    for (const locations of [['Mumbai'], ['Maharashtra'], ['India']]) {
      expect(run({ preferredLocations: locations }).factors.find((f) => f.key === 'location')?.outcome).toBe('MATCH');
    }
  });

  it('reports a mismatch for an unrelated geography', () => {
    expect(run({ preferredLocations: ['Kerala'] }).factors.find((f) => f.key === 'location')?.outcome).toBe('MISMATCH');
  });
});

describe('explanation and language', () => {
  it('never emits a blocking issue, because a preference is not a rule', () => {
    const result = run({ industries: ['Textiles'], fundingTypes: ['DEBT'] }, {}, { fundingType: 'EQUITY' });
    // The result shape has no blockingIssues field at all — an investor
    // preference mismatch is not an ineligibility.
    expect('blockingIssues' in result).toBe(false);
  });

  it('frames the result as fit, never as eligibility or a commitment', () => {
    const serialised = JSON.stringify(run().explanation).toLowerCase();
    for (const banned of ['guarantee', 'guaranteed', 'approved', 'eligible', 'will invest', 'committed']) {
      expect(serialised).not.toContain(banned);
    }
    expect(serialised).toContain('not an offer');
  });

  it('gives every factor a reason', () => {
    for (const f of run().factors) {
      expect(f.reason.length).toBeGreaterThan(20);
    }
  });

  it('carries the disclaimer', () => {
    expect(run().explanation.disclaimer).toMatch(/not an offer, a commitment/i);
  });
});
