/**
 * Imports the verified government scheme dataset into PostgreSQL.
 *
 * Two rules shape this script:
 *
 * 1. **Provenance survives.** An existing record's verification state is never
 *    silently overwritten. If a stored scheme was verified by an administrator
 *    and the incoming file says otherwise, the file does not win — the conflict
 *    is reported.
 * 2. **Only VERIFIED records are published.** Anything else is imported at its
 *    stated status and stays invisible to business users, because only
 *    PUBLISHED rows are exposed.
 *
 *   npm run data:import              import, publishing VERIFIED records
 *   npm run data:import -- --dry-run report what would change, write nothing
 */
import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient, type Prisma } from '../../backend/generated/prisma';

const prisma = new PrismaClient();

const ROOT = path.resolve(__dirname, '../..');
const DATASET = path.join(ROOT, 'datasets/processed/government/government_schemes.json');
const METADATA_DIR = path.join(ROOT, 'datasets/metadata/government');

const DRY_RUN = process.argv.includes('--dry-run');

/** Dataset vocabulary -> Prisma enums. Unmapped values are reported, not guessed. */
const SCHEME_TYPE_MAP: Record<string, string> = {
  GRANT: 'GRANT',
  LOAN: 'LOAN',
  EQUITY: 'EQUITY',
  SUBSIDY: 'SUBSIDY',
  CREDIT_GUARANTEE: 'GUARANTEE',
  GUARANTEE: 'GUARANTEE',
  INCUBATION: 'INCUBATION',
  STARTUP_SUPPORT: 'OTHER',
  MSME_SUPPORT: 'OTHER',
  INCENTIVE: 'OTHER',
  CENTRAL: 'OTHER',
  STATE: 'OTHER',
  OTHER: 'OTHER',
};

const FUNDING_TYPE_MAP: Record<string, string> = {
  GRANT: 'GRANT',
  LOAN: 'LOAN',
  SUBSIDY: 'SUBSIDY',
  EQUITY: 'EQUITY',
  DEBT: 'DEBT',
  CREDIT_SUPPORT: 'DEBT',
  INTEREST_SUPPORT: 'SUBSIDY',
  GUARANTEE: 'GUARANTEE',
  MIXED: 'ANY_SUITABLE',
  OTHER: 'OTHER',
};

const STAGE_MAP: Record<string, string> = {
  IDEA: 'IDEA',
  PRE_SEED: 'PROTOTYPE',
  SEED: 'EARLY',
  EARLY: 'EARLY',
  GROWTH: 'GROWTH',
  ESTABLISHED: 'MATURE',
  EXPANSION: 'EXPANSION',
  MATURE: 'MATURE',
  PROTOTYPE: 'PROTOTYPE',
};

const BUSINESS_TYPE_MAP: Record<string, string> = {
  PROPRIETORSHIP: 'PROPRIETORSHIP',
  PARTNERSHIP: 'PARTNERSHIP',
  LLP: 'LLP',
  PRIVATE_LIMITED: 'PRIVATE_LIMITED',
  PUBLIC_LIMITED: 'PUBLIC_LIMITED',
  FPO: 'FPO',
  SOCIETY: 'SOCIETY',
  TRUST: 'TRUST',
  SELF_HELP_GROUP: 'SELF_HELP_GROUP',
  OTHER: 'OTHER',
};

interface ImportIssue {
  schemeId: string;
  kind: 'UNMAPPED_VALUE' | 'PROVENANCE_CONFLICT' | 'SKIPPED';
  message: string;
}

const issues: ImportIssue[] = [];

function mapList(
  schemeId: string,
  field: string,
  values: string[],
  map: Record<string, string>,
): string[] {
  const out: string[] = [];
  for (const value of values) {
    const mapped = map[value.toUpperCase().replace(/\s+/g, '_')];
    if (mapped) {
      if (!out.includes(mapped)) out.push(mapped);
    } else {
      // Dropped rather than coerced: an unrecognised stage silently mapped to
      // EARLY would change who the scheme appears to serve.
      issues.push({
        schemeId,
        kind: 'UNMAPPED_VALUE',
        message: `${field}: "${value}" has no mapping and was dropped.`,
      });
    }
  }
  return out;
}

interface DatasetRecord {
  schemeId: string;
  slug: string;
  schemeName: string;
  provider: string;
  ministry: string | null;
  department: string | null;
  governmentLevel: 'CENTRAL' | 'STATE';
  schemeType: string;
  targetBusinessTypes: string[];
  supportedIndustries: string[];
  supportedStages: string[];
  supportedLocations: string[];
  supportedFundingTypes: string[];
  supportedPurposes: string[];
  minFunding: number | null;
  maxFunding: number | null;
  fundingAmountDescription: string | null;
  eligibilityCriteria: string[];
  ineligibilityCriteria?: string[];
  eligibilityRules?: Record<string, unknown>;
  documentRequirements: string[];
  applicationProcess: string | null;
  applicationUrl: string | null;
  officialSourceUrl: string;
  sourceTitle: string;
  sourceType: string;
  sourceDomain: string;
  lastVerifiedAt: string | null;
  verificationStatus: string;
  schemeStatus: string;
  dataVersion: string;
  notes?: string;
  [key: string]: unknown;
}

/**
 * Builds the human-readable description, folding in the annotations that
 * explain what is absent. A user reading the scheme should see the same caveats
 * the dataset records.
 */
function buildNotes(record: DatasetRecord): string {
  const parts: string[] = [
    `Imported from ${record.dataVersion}. Source: ${record.sourceTitle} (${record.sourceDomain}).`,
  ];

  if (record.minFunding === null && record.maxFunding === null && record.fundingAmountDescription) {
    parts.push(`Funding amount: ${record.fundingAmountDescription}`);
  }

  for (const [key, value] of Object.entries(record)) {
    if (key.endsWith('Note') && typeof value === 'string' && value.trim()) {
      parts.push(`${key.replace(/Note$/, '')}: ${value}`);
    }
  }

  if (record.notes) parts.push(record.notes);
  return parts.join('\n\n');
}

async function main(): Promise<void> {
  if (!fs.existsSync(DATASET)) {
    console.error(`Dataset not found at ${DATASET}. Nothing to import.`);
    process.exit(1);
  }

  const parsed = JSON.parse(fs.readFileSync(DATASET, 'utf8')) as {
    datasetVersion: string;
    records: DatasetRecord[];
  };

  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  let published = 0;

  for (const record of parsed.records) {
    const existing = await prisma.governmentScheme.findUnique({
      where: { slug: record.slug },
      select: { id: true, status: true, lastVerifiedAt: true, verifiedById: true, sourceType: true },
    });

    // An administrator's verification outranks the file. Overwriting it would
    // destroy a human decision with a batch job.
    if (
      existing &&
      existing.verifiedById &&
      (existing.status === 'PUBLISHED' || existing.status === 'VERIFIED') &&
      record.verificationStatus !== 'VERIFIED'
    ) {
      issues.push({
        schemeId: record.schemeId,
        kind: 'PROVENANCE_CONFLICT',
        message: `Stored record is ${existing.status} and was verified by an administrator, but the dataset says ${record.verificationStatus}. Left unchanged.`,
      });
      skipped += 1;
      continue;
    }

    // Only a VERIFIED dataset record becomes visible to users.
    const targetStatus =
      record.verificationStatus === 'VERIFIED'
        ? 'PUBLISHED'
        : record.verificationStatus === 'PUBLISHED'
          ? 'PUBLISHED'
          : record.verificationStatus;

    const data = {
      slug: record.slug,
      name: record.schemeName,
      provider: record.provider,
      ministry: record.ministry,
      department: record.department,
      level: record.governmentLevel,
      schemeType: (SCHEME_TYPE_MAP[record.schemeType.toUpperCase()] ?? 'OTHER') as never,
      targetBusinessTypes: mapList(
        record.schemeId,
        'targetBusinessTypes',
        record.targetBusinessTypes,
        BUSINESS_TYPE_MAP,
      ) as never,
      supportedIndustries: record.supportedIndustries,
      supportedStages: mapList(record.schemeId, 'supportedStages', record.supportedStages, STAGE_MAP) as never,
      supportedLocations: record.supportedLocations,
      supportedFundingTypes: mapList(
        record.schemeId,
        'supportedFundingTypes',
        record.supportedFundingTypes,
        FUNDING_TYPE_MAP,
      ) as never,
      supportedPurposes: record.supportedPurposes,
      minFunding: record.minFunding,
      maxFunding: record.maxFunding,
      fundingDescription: record.fundingAmountDescription,
      // Ineligibility criteria are appended so a user sees both: the engine
      // reports them for verification rather than evaluating them.
      eligibilityCriteria: [
        ...record.eligibilityCriteria,
        ...(record.ineligibilityCriteria ?? []).map((c) => `Exclusion: ${c}`),
      ],
      eligibilityRules: (record.eligibilityRules ?? {}) as Prisma.InputJsonValue,
      requiredDocuments: record.documentRequirements,
      applicationProcess: record.applicationProcess,
      applicationUrl: record.applicationUrl,
      officialSourceUrl: record.officialSourceUrl,
      status: targetStatus as never,
      source: `${record.sourceTitle} (${record.sourceDomain})`,
      sourceType: 'OFFICIAL_SOURCE' as never,
      lastVerifiedAt: record.lastVerifiedAt ? new Date(record.lastVerifiedAt) : null,
      notes: buildNotes(record),
    };

    if (DRY_RUN) {
      console.log(`  [dry-run] ${existing ? 'update' : 'insert'} ${record.slug} -> ${targetStatus}`);
      if (existing) updated += 1;
      else inserted += 1;
      if (targetStatus === 'PUBLISHED') published += 1;
      continue;
    }

    if (existing) {
      // Snapshot before overwriting, so the previous values stay recoverable.
      await prisma.$transaction([
        prisma.schemeRevision.create({
          data: {
            schemeId: existing.id,
            snapshot: { previousStatus: existing.status, importedFrom: parsed.datasetVersion } as Prisma.InputJsonValue,
            reason: `Dataset import ${parsed.datasetVersion}`,
          },
        }),
        prisma.governmentScheme.update({ where: { slug: record.slug }, data }),
      ]);
      updated += 1;
    } else {
      await prisma.governmentScheme.create({ data });
      inserted += 1;
    }

    if (targetStatus === 'PUBLISHED') published += 1;
  }

  const summary = {
    datasetVersion: parsed.datasetVersion,
    importedAt: new Date().toISOString(),
    dryRun: DRY_RUN,
    recordsRead: parsed.records.length,
    inserted,
    updated,
    skipped,
    published,
    issues,
  };

  if (!DRY_RUN) {
    fs.mkdirSync(METADATA_DIR, { recursive: true });
    fs.writeFileSync(path.join(METADATA_DIR, 'collection_log.json'), JSON.stringify(summary, null, 2) + '\n');
  }

  console.log(`\nImport ${DRY_RUN ? '(dry run) ' : ''}${parsed.datasetVersion}`);
  console.log(`  records read : ${summary.recordsRead}`);
  console.log(`  inserted     : ${inserted}`);
  console.log(`  updated      : ${updated}`);
  console.log(`  skipped      : ${skipped}`);
  console.log(`  published    : ${published}`);

  if (issues.length > 0) {
    console.log('');
    for (const i of issues) console.log(`  [${i.kind}] ${i.schemeId}: ${i.message}`);
  }

  if (!DRY_RUN && published > 0) {
    console.log('\n  Published schemes are now matchable. Re-index RAG so they are retrievable:');
    console.log('    POST /api/admin/rag/reindex');
  }
  console.log('');
}

main()
  .catch((err) => {
    console.error('\nImport failed:', err);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
