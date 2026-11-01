/**
 * Development seed.
 *
 * WHAT THIS DOES AND DOES NOT CREATE
 * ----------------------------------
 * It creates:
 *   - the scoring configuration rows the engines read (real configuration,
 *     not demo data)
 *   - an administrator account
 *   - one demo business and one demo investor, both marked `sourceType: SEED`
 *   - government scheme *stubs* at NEEDS_VERIFICATION
 *
 * It deliberately does NOT invent government scheme eligibility. Each stub
 * carries only facts that are not in doubt — the scheme's name, its
 * administering body, and the root URL of the official portal — and leaves
 * `eligibilityCriteria`, `requiredDocuments` and funding ranges EMPTY with
 * status NEEDS_VERIFICATION. Phase 3 populates them from official sources with
 * provenance. Guessing an eligibility rule here would be exactly the
 * fabrication the project forbids (master spec §13, §38, rule 2).
 *
 * Because every seeded row is marked SEED, the data-quality report and the
 * admin UI can tell it apart from verified reference data, and it can never be
 * mistaken for research evidence.
 *
 * Idempotent: safe to re-run. Uses upserts keyed on natural unique columns.
 *
 *   npm run db:seed
 */
import { PrismaClient, type Prisma } from '../backend/generated/prisma';
import bcrypt from 'bcryptjs';
import {
  CONFIG_DEFAULTS,
  CONFIG_KEYS,
  CONFIG_SCHEMAS,
  CONFIG_VERSION,
  type ConfigKey,
} from '../backend/src/config/matching';

const prisma = new PrismaClient();

/** Demo passwords are printed at the end; they are only ever used locally. */
const DEMO_PASSWORD = 'fundbridge-demo-2026';
const BCRYPT_COST = 12;

async function seedMatchingConfig(): Promise<number> {
  let count = 0;

  for (const key of Object.values(CONFIG_KEYS)) {
    const value = CONFIG_DEFAULTS[key as ConfigKey];

    // Validate before writing: the DB must never hold a weight set the engines
    // would reject at read time.
    const parsed = CONFIG_SCHEMAS[key as ConfigKey].safeParse(value);
    if (!parsed.success) {
      throw new Error(`refusing to seed invalid config "${key}"`);
    }

    await prisma.matchingConfig.upsert({
      where: { key_version: { key, version: 1 } },
      update: { value: parsed.data as Prisma.InputJsonValue, active: true },
      create: {
        key,
        version: 1,
        active: true,
        value: parsed.data as Prisma.InputJsonValue,
        notes: `Default shipped with ${CONFIG_VERSION}.`,
      },
    });
    count += 1;
  }

  return count;
}

async function seedAdmin(): Promise<string> {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, BCRYPT_COST);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@fundbridge.local' },
    update: {},
    create: {
      name: 'FundBridge Administrator',
      email: 'admin@fundbridge.local',
      passwordHash,
      role: 'ADMIN',
    },
    select: { id: true },
  });

  return admin.id;
}

/**
 * The demo business reuses the prototype's running example so the screens have
 * something recognisable to render. Financial figures here are illustrative
 * SEED values, not a real company's accounts.
 */
async function seedDemoBusiness(): Promise<void> {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, BCRYPT_COST);

  const user = await prisma.user.upsert({
    where: { email: 'owner@buildtech.local' },
    update: {},
    create: {
      name: 'Rahul Sharma',
      email: 'owner@buildtech.local',
      passwordHash,
      role: 'STARTUP',
    },
    select: { id: true },
  });

  const business = await prisma.businessProfile.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      businessName: 'BuildTech Solutions',
      businessType: 'PRIVATE_LIMITED',
      industry: 'Construction Technology',
      subIndustry: 'Equipment Management Software',
      location: 'Mumbai',
      state: 'Maharashtra',
      country: 'India',
      foundedYear: 2021,
      businessStage: 'GROWTH',
      teamSize: 12,
      description:
        'BuildTech Solutions provides technology-enabled solutions for construction companies to improve equipment management, project tracking and operational efficiency.',
      problem:
        'Construction firms lose working days to unplanned equipment downtime and have little visibility into utilisation across sites.',
      solution:
        'An IoT-and-mobile platform that tracks equipment condition and utilisation, and flags maintenance before failure.',
      targetCustomer: 'Mid-sized construction and infrastructure contractors operating multiple sites.',
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
      teamStrength: 'Two technical co-founders with construction-sector backgrounds; eight engineers; two in sales.',
      customers: ['Regional contractor (pilot)', 'Infrastructure firm (paid)'],
      partnerships: ['Equipment dealer network (Maharashtra)'],
      certifications: ['Udyam Registered'],
      intellectualProperty: [],
      udyamRegistered: true,
      dpiitRecognised: false,
      gstRegistered: true,
      discoverable: true,
      // Marks the whole row as development data.
      sourceType: 'SEED',
    },
    select: { id: true },
  });

  await prisma.fundingRequirement.upsert({
    where: { businessId: business.id },
    update: {},
    create: {
      businessId: business.id,
      amountRequired: 5_000_000,
      currency: 'INR',
      purpose: 'Business Expansion',
      fundingType: 'ANY_SUITABLE',
      preferredTimeline: '3-6 months',
      preferredLocation: 'Maharashtra',
      additionalRequirements: 'Open to a mix of grant and equity.',
    },
  });
}

async function seedDemoInvestor(): Promise<void> {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, BCRYPT_COST);

  const user = await prisma.user.upsert({
    where: { email: 'team@alphaventures.local' },
    update: {},
    create: {
      name: 'Alpha Ventures Team',
      email: 'team@alphaventures.local',
      passwordHash,
      role: 'INVESTOR',
    },
    select: { id: true },
  });

  await prisma.investorProfile.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      investorName: 'Alpha Ventures',
      investorType: 'VENTURE_CAPITAL',
      description: 'Technology-focused early and growth stage investment firm. Development seed record.',
      minInvestment: 2_500_000,
      maxInvestment: 10_000_000,
      industries: ['Technology', 'Construction Technology', 'Manufacturing'],
      preferredStages: ['EARLY', 'GROWTH'],
      preferredLocations: ['Mumbai', 'Maharashtra', 'India'],
      fundingTypes: ['EQUITY'],
      investmentPreferences: 'B2B software with demonstrated paying customers.',
      // An invented firm must never look verified.
      verification: 'UNVERIFIED',
      source: 'Development seed data',
      sourceType: 'SEED',
      active: true,
    },
  });
}

/**
 * Scheme stubs.
 *
 * `officialSourceUrl` is the root of each programme's official portal — not a
 * deep link, which would risk citing a page that has moved. Every substantive
 * field is left empty on purpose and the status says so.
 */
const SCHEME_STUBS: Array<{
  slug: string;
  name: string;
  provider: string;
  ministry: string;
  level: 'CENTRAL' | 'STATE';
  schemeType: 'GRANT' | 'LOAN' | 'EQUITY' | 'SUBSIDY' | 'GUARANTEE' | 'INCUBATION' | 'OTHER';
  officialSourceUrl: string;
}> = [
  {
    slug: 'startup-india-seed-fund-scheme',
    name: 'Startup India Seed Fund Scheme',
    provider: 'Startup India',
    ministry: 'Department for Promotion of Industry and Internal Trade',
    level: 'CENTRAL',
    schemeType: 'GRANT',
    officialSourceUrl: 'https://www.startupindia.gov.in/',
  },
  {
    slug: 'pmegp',
    name: "Prime Minister's Employment Generation Programme (PMEGP)",
    provider: 'Khadi and Village Industries Commission',
    ministry: 'Ministry of Micro, Small and Medium Enterprises',
    level: 'CENTRAL',
    schemeType: 'SUBSIDY',
    officialSourceUrl: 'https://www.kviconline.gov.in/',
  },
  {
    slug: 'pradhan-mantri-mudra-yojana',
    name: 'Pradhan Mantri MUDRA Yojana',
    provider: 'Micro Units Development and Refinance Agency',
    ministry: 'Ministry of Finance',
    level: 'CENTRAL',
    schemeType: 'LOAN',
    officialSourceUrl: 'https://www.mudra.org.in/',
  },
  {
    slug: 'cgtmse',
    name: 'Credit Guarantee Fund Trust for Micro and Small Enterprises (CGTMSE)',
    provider: 'CGTMSE',
    ministry: 'Ministry of Micro, Small and Medium Enterprises',
    level: 'CENTRAL',
    schemeType: 'GUARANTEE',
    officialSourceUrl: 'https://www.cgtmse.in/',
  },
  {
    slug: 'stand-up-india',
    name: 'Stand-Up India',
    provider: 'Stand-Up India',
    ministry: 'Department of Financial Services',
    level: 'CENTRAL',
    schemeType: 'LOAN',
    officialSourceUrl: 'https://www.standupmitra.in/',
  },
];

async function seedSchemeStubs(): Promise<number> {
  for (const stub of SCHEME_STUBS) {
    await prisma.governmentScheme.upsert({
      where: { slug: stub.slug },
      // Never overwrite a record an admin has since verified and filled in.
      update: {},
      create: {
        ...stub,
        description: null,
        // Empty, not guessed. Phase 3 fills these from official sources.
        targetBusinessTypes: [],
        supportedIndustries: [],
        supportedStages: [],
        supportedLocations: [],
        supportedFundingTypes: [],
        supportedPurposes: [],
        minFunding: null,
        maxFunding: null,
        fundingDescription: null,
        eligibilityRules: undefined,
        eligibilityCriteria: [],
        requiredDocuments: [],
        applicationProcess: null,
        applicationUrl: null,
        status: 'NEEDS_VERIFICATION',
        source: 'Development seed stub',
        sourceType: 'SEED',
        lastVerifiedAt: null,
        notes:
          'SEED STUB. Name, administering body and official portal only. Eligibility, funding range, documents and application process have NOT been collected and must be entered from the official source before this scheme is published. Not eligible for matching while status is NEEDS_VERIFICATION.',
      },
    });
  }
  return SCHEME_STUBS.length;
}

async function main(): Promise<void> {
  console.log('Seeding FundBridge development data...\n');

  const configCount = await seedMatchingConfig();
  console.log(`  scoring configuration : ${configCount} keys (version 1, active)`);

  await seedAdmin();
  console.log('  administrator         : admin@fundbridge.local');

  await seedDemoBusiness();
  console.log('  demo business         : BuildTech Solutions  [SEED]');

  await seedDemoInvestor();
  console.log('  demo investor         : Alpha Ventures       [SEED]');

  const schemeCount = await seedSchemeStubs();
  console.log(`  scheme stubs          : ${schemeCount}  [SEED, NEEDS_VERIFICATION]`);

  console.log('\nDemo accounts (local development only):');
  console.log(`  admin@fundbridge.local      / ${DEMO_PASSWORD}   (ADMIN)`);
  console.log(`  owner@buildtech.local       / ${DEMO_PASSWORD}   (STARTUP)`);
  console.log(`  team@alphaventures.local    / ${DEMO_PASSWORD}   (INVESTOR)`);
  console.log('\nScheme stubs carry NO eligibility data and are not matchable.');
  console.log('Collecting verified scheme records from official sources is phase 3.');
}

main()
  .catch((err) => {
    console.error('\nSeed failed:', err);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
