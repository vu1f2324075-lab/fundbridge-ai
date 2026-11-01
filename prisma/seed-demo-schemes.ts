/**
 * SYNTHETIC demo schemes — for development and demonstration only.
 *
 * WHY THIS IS SEPARATE FROM seed.ts
 * ---------------------------------
 * The matching engine cannot be demonstrated without PUBLISHED schemes carrying
 * eligibility data, but inventing eligibility rules and attributing them to a
 * real government programme is precisely what this project forbids (master spec
 * rule 2, §38).
 *
 * The resolution the spec itself prescribes (§32: "Synthetic data may be used
 * for UI development, database seeding, API testing... Clearly mark
 * sourceType = SYNTHETIC. Never present synthetic data as actual evidence."):
 *
 *   - every record is named with a leading "[DEMO]" so it is unmistakable in any
 *     list, table or screenshot
 *   - `sourceType` is SYNTHETIC, which the API exposes so the UI can badge it
 *   - `provider` says so again, in words
 *   - `officialSourceUrl` points at this file rather than impersonating a
 *     government domain
 *   - no record uses the name of a real scheme, ministry or programme
 *
 * These exist so the engine, the explanation UI and the action plan can be
 * exercised end to end. They are NOT evidence of anything and must never appear
 * in a research result. Real scheme records are collected from official sources
 * with provenance in phase 3.
 *
 *   npm run db:seed:demo          add them
 *   npm run db:seed:demo -- --remove   take them away again
 */
import { PrismaClient, type Prisma } from '../backend/generated/prisma';

const prisma = new PrismaClient();

const DEMO_PREFIX = '[DEMO]';
const SYNTHETIC_PROVIDER = 'Synthetic demonstration data — not a real programme';
const SYNTHETIC_URL = 'https://localhost/fundbridge/synthetic-demo-scheme';

const NOT_REAL =
  'SYNTHETIC DEMONSTRATION RECORD. This is not a real government scheme. Its eligibility rules, funding range and ' +
  'criteria were written to exercise the matching engine and must never be cited, applied for, or used as evidence.';

type DemoScheme = Omit<Prisma.GovernmentSchemeCreateInput, 'slug'> & { slug: string };

const demoSchemes: DemoScheme[] = [
  {
    slug: 'demo-growth-stage-technology-grant',
    name: `${DEMO_PREFIX} Growth-Stage Technology Grant`,
    provider: SYNTHETIC_PROVIDER,
    ministry: 'Synthetic Demonstration Ministry',
    level: 'CENTRAL',
    schemeType: 'GRANT',
    description:
      'A synthetic scheme supporting growth-stage technology businesses that are expanding operations, ' +
      'adopting new technology, or scaling an existing product with demonstrated customers.',
    targetBusinessTypes: ['PRIVATE_LIMITED', 'LLP'],
    supportedIndustries: ['Technology', 'Construction Technology', 'Information Technology', 'Manufacturing'],
    supportedStages: ['GROWTH', 'EXPANSION'],
    supportedLocations: ['India'],
    supportedFundingTypes: ['GRANT'],
    supportedPurposes: ['Business Expansion', 'Technology Adoption', 'Product Development'],
    minFunding: 1_000_000,
    maxFunding: 10_000_000,
    fundingDescription: 'Synthetic range of ₹10 lakh to ₹1 crore.',
    // Exercises the satisfied-gate path: the demo business IS Udyam registered.
    eligibilityRules: { requiresUdyamRegistration: true, maxBusinessAgeYears: 10 },
    eligibilityCriteria: [
      'Udyam registration required (synthetic condition)',
      'Business no more than 10 years old (synthetic condition)',
      'Demonstrated paying customers (synthetic condition)',
    ],
    requiredDocuments: ['Udyam certificate', 'Audited financial statements', 'Project proposal'],
    applicationProcess: 'Synthetic process. There is no real application for this record.',
    applicationUrl: null,
    officialSourceUrl: SYNTHETIC_URL,
    status: 'PUBLISHED',
    source: 'Synthetic demo data',
    sourceType: 'SYNTHETIC',
    notes: NOT_REAL,
  },
  {
    slug: 'demo-micro-enterprise-working-capital-loan',
    name: `${DEMO_PREFIX} Micro-Enterprise Working Capital Loan`,
    provider: SYNTHETIC_PROVIDER,
    ministry: 'Synthetic Demonstration Ministry',
    level: 'CENTRAL',
    schemeType: 'LOAN',
    description:
      'A synthetic working-capital facility for micro and small enterprises across all sectors, with no ' +
      'industry restriction.',
    targetBusinessTypes: [],
    // Deliberately empty: exercises the UNRESTRICTED path, where an unstated
    // criterion correctly excludes nobody.
    supportedIndustries: [],
    supportedStages: ['EARLY', 'GROWTH'],
    supportedLocations: ['India'],
    supportedFundingTypes: ['LOAN', 'DEBT'],
    supportedPurposes: ['Working Capital', 'Equipment Purchase'],
    minFunding: 50_000,
    maxFunding: 1_000_000,
    fundingDescription: 'Synthetic range of ₹50 thousand to ₹10 lakh.',
    eligibilityRules: { requiresUdyamRegistration: true, maxAnnualRevenue: 50_000_000 },
    eligibilityCriteria: [
      'Udyam registration required (synthetic condition)',
      'Annual revenue below ₹5 crore (synthetic condition)',
    ],
    requiredDocuments: ['Udyam certificate', 'Bank statements', 'GST returns'],
    applicationProcess: 'Synthetic process. There is no real application for this record.',
    applicationUrl: null,
    officialSourceUrl: SYNTHETIC_URL,
    status: 'PUBLISHED',
    source: 'Synthetic demo data',
    sourceType: 'SYNTHETIC',
    notes: NOT_REAL,
  },
  {
    slug: 'demo-early-stage-innovation-seed-fund',
    name: `${DEMO_PREFIX} Early-Stage Innovation Seed Fund`,
    provider: SYNTHETIC_PROVIDER,
    ministry: 'Synthetic Demonstration Ministry',
    level: 'CENTRAL',
    schemeType: 'EQUITY',
    description:
      'A synthetic seed fund for very early-stage innovation-led startups that hold a formal startup ' +
      'recognition.',
    targetBusinessTypes: ['PRIVATE_LIMITED'],
    supportedIndustries: ['Technology', 'HealthTech', 'FinTech', 'AgriTech'],
    supportedStages: ['IDEA', 'PROTOTYPE', 'EARLY'],
    supportedLocations: ['India'],
    supportedFundingTypes: ['EQUITY', 'GRANT'],
    supportedPurposes: ['Product Development', 'Research and Development'],
    minFunding: 500_000,
    maxFunding: 5_000_000,
    fundingDescription: 'Synthetic range of ₹5 lakh to ₹50 lakh.',
    // Exercises the BLOCKING path: the demo business has dpiitRecognised: false,
    // so this must come back LIKELY_NOT_ELIGIBLE with a stated reason — and must
    // do so even though other factors align.
    eligibilityRules: { requiresDpiitRecognition: true, maxBusinessAgeYears: 5 },
    eligibilityCriteria: [
      'Formal startup recognition required (synthetic condition)',
      'Business no more than 5 years old (synthetic condition)',
    ],
    requiredDocuments: ['Recognition certificate', 'Pitch deck', 'Incorporation certificate'],
    applicationProcess: 'Synthetic process. There is no real application for this record.',
    applicationUrl: null,
    officialSourceUrl: SYNTHETIC_URL,
    status: 'PUBLISHED',
    source: 'Synthetic demo data',
    sourceType: 'SYNTHETIC',
    notes: NOT_REAL,
  },
  {
    slug: 'demo-maharashtra-manufacturing-subsidy',
    name: `${DEMO_PREFIX} State Manufacturing Subsidy`,
    provider: SYNTHETIC_PROVIDER,
    department: 'Synthetic Demonstration Department',
    level: 'STATE',
    schemeType: 'SUBSIDY',
    description:
      'A synthetic state-level capital subsidy for manufacturing units, used to demonstrate state-level ' +
      'matching and an industry mismatch.',
    targetBusinessTypes: ['PROPRIETORSHIP', 'PARTNERSHIP', 'PRIVATE_LIMITED'],
    // Exercises the MISMATCH path for the demo business, which is in
    // Construction Technology.
    supportedIndustries: ['Manufacturing', 'Textiles', 'Food Processing'],
    supportedStages: ['EARLY', 'GROWTH', 'EXPANSION', 'MATURE'],
    supportedLocations: ['Maharashtra'],
    supportedFundingTypes: ['SUBSIDY'],
    supportedPurposes: ['Equipment Purchase', 'Infrastructure'],
    minFunding: 200_000,
    maxFunding: 2_500_000,
    fundingDescription: 'Synthetic range of ₹2 lakh to ₹25 lakh.',
    eligibilityRules: { requiresUdyamRegistration: true },
    eligibilityCriteria: ['Udyam registration required (synthetic condition)', 'Unit located in the state'],
    requiredDocuments: ['Udyam certificate', 'Land or lease documents', 'Machinery quotations'],
    applicationProcess: 'Synthetic process. There is no real application for this record.',
    applicationUrl: null,
    officialSourceUrl: SYNTHETIC_URL,
    status: 'PUBLISHED',
    source: 'Synthetic demo data',
    sourceType: 'SYNTHETIC',
    notes: NOT_REAL,
  },
  {
    slug: 'demo-credit-guarantee-facility',
    name: `${DEMO_PREFIX} Collateral-Free Credit Guarantee Facility`,
    provider: SYNTHETIC_PROVIDER,
    ministry: 'Synthetic Demonstration Ministry',
    level: 'CENTRAL',
    schemeType: 'GUARANTEE',
    description:
      'A synthetic guarantee facility covering lender risk on collateral-free credit, with no stated ' +
      'industry, stage or funding-range restriction.',
    targetBusinessTypes: [],
    supportedIndustries: [],
    supportedStages: [],
    supportedLocations: ['India'],
    supportedFundingTypes: ['GUARANTEE', 'LOAN'],
    supportedPurposes: [],
    // No stated range: exercises the UNRESTRICTED funding path, where a scheme
    // that does not state a range cannot be said to mismatch one.
    minFunding: null,
    maxFunding: null,
    fundingDescription: 'Synthetic record with no stated funding range.',
    eligibilityRules: {},
    eligibilityCriteria: ['Credit extended by a participating lender (synthetic condition)'],
    requiredDocuments: ['Lender sanction letter'],
    applicationProcess: 'Synthetic process. There is no real application for this record.',
    applicationUrl: null,
    officialSourceUrl: SYNTHETIC_URL,
    status: 'PUBLISHED',
    source: 'Synthetic demo data',
    sourceType: 'SYNTHETIC',
    notes: NOT_REAL,
  },
];

async function add(): Promise<void> {
  for (const scheme of demoSchemes) {
    await prisma.governmentScheme.upsert({
      where: { slug: scheme.slug },
      update: scheme,
      create: scheme,
    });
  }

  console.log(`Added ${demoSchemes.length} SYNTHETIC demo schemes:\n`);
  for (const s of demoSchemes) console.log(`  ${s.name}`);
  console.log('\nEach is marked sourceType=SYNTHETIC and named "[DEMO]".');
  console.log('They exercise the matching engine. They are NOT real schemes and');
  console.log('must never be cited or used as a research result.');
  console.log('\nRemove them with:  npm run db:seed:demo -- --remove');
}

async function remove(): Promise<void> {
  const { count } = await prisma.governmentScheme.deleteMany({
    where: { sourceType: 'SYNTHETIC' },
  });
  console.log(`Removed ${count} synthetic demo schemes.`);
}

const shouldRemove = process.argv.includes('--remove');

(shouldRemove ? remove() : add())
  .catch((err) => {
    console.error('\nFailed:', err);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
