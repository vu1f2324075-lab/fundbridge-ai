/**
 * Government scheme dataset validation.
 *
 * Runs before import and refuses to pass a record that would put unverifiable
 * information in front of a user. The checks that matter most are not the
 * shape checks — they are the provenance ones:
 *
 *   - a VERIFIED record must cite an official government domain
 *   - a VERIFIED record must have a verification date
 *   - any field whose value was derived rather than quoted must say so
 *   - a funding figure must never appear without a source
 *
 * Writes datasets/metadata/government/validation_report.json and
 * duplicates_report.json. Exits non-zero when a record is invalid, so this can
 * gate an import in CI.
 *
 *   npm run data:validate
 */
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

const ROOT = path.resolve(__dirname, '../..');
const DATASET = path.join(ROOT, 'datasets/processed/government/government_schemes.json');
const METADATA_DIR = path.join(ROOT, 'datasets/metadata/government');

/**
 * Domains accepted as authoritative.
 *
 * Matched on the registrable suffix so a subdomain like
 * `seedfund.startupindia.gov.in` passes, while a lookalike such as
 * `startupindia.gov.in.example.com` does not.
 */
const OFFICIAL_SUFFIXES = ['.gov.in', '.nic.in', '.org.in'] as const;
const OFFICIAL_EXACT = ['gov.in', 'nic.in'] as const;

function isOfficialDomain(domain: string): boolean {
  const d = domain.toLowerCase().trim();
  if (OFFICIAL_EXACT.includes(d as (typeof OFFICIAL_EXACT)[number])) return true;
  return OFFICIAL_SUFFIXES.some((suffix) => d.endsWith(suffix));
}

const VERIFICATION_STATUSES = [
  'DRAFT',
  'NEEDS_VERIFICATION',
  'VERIFIED',
  'PUBLISHED',
  'NEEDS_REVERIFICATION',
  'ARCHIVED',
] as const;

const SCHEME_STATUSES = ['ACTIVE', 'INACTIVE', 'CLOSED', 'DISCONTINUED', 'UNKNOWN'] as const;

const SOURCE_TYPES = [
  'OFFICIAL_WEBPAGE',
  'OFFICIAL_PDF',
  'OFFICIAL_GUIDELINE',
  'OFFICIAL_NOTIFICATION',
  'OFFICIAL_APPLICATION_PORTAL',
  'OFFICIAL_FAQ',
  'OFFICIAL_CIRCULAR',
  'OFFICIAL_GAZETTE',
  'OTHER_OFFICIAL_DOCUMENT',
] as const;

const PROVENANCE = ['QUOTED', 'DERIVED', 'NOT_STATED'] as const;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'use YYYY-MM-DD');

const recordSchema = z
  .object({
    schemeId: z.string().regex(/^GOV-\d{4}$/, 'use GOV-NNNN'),
    slug: z.string().regex(/^[a-z0-9-]+$/),
    schemeName: z.string().min(3),
    officialSchemeName: z.string().min(3),
    provider: z.string().min(2),
    ministry: z.string().min(2).nullable(),
    department: z.string().min(2).nullable(),
    governmentLevel: z.enum(['CENTRAL', 'STATE']),
    state: z.string().nullable(),
    schemeType: z.string().min(2),

    targetBusinessTypes: z.array(z.string()),
    supportedIndustries: z.array(z.string()),
    supportedStages: z.array(z.string()),
    supportedLocations: z.array(z.string()),
    supportedFundingTypes: z.array(z.string()),
    supportedPurposes: z.array(z.string()),

    // Nullable on purpose: an unstated amount must be representable.
    minFunding: z.number().nonnegative().nullable(),
    maxFunding: z.number().nonnegative().nullable(),
    fundingAmountDescription: z.string().nullable(),

    eligibilityCriteria: z.array(z.string()),
    ineligibilityCriteria: z.array(z.string()).optional(),
    eligibilityRules: z.record(z.unknown()).optional(),

    documentRequirements: z.array(z.string()),
    applicationProcess: z.string().nullable(),
    applicationUrl: z.string().url().nullable(),

    officialSourceUrl: z.string().url(),
    sourceTitle: z.string().min(3),
    sourceType: z.enum(SOURCE_TYPES),
    sourceDomain: z.string().min(3),

    collectionDate: isoDate,
    lastVerifiedAt: isoDate.nullable(),
    verificationStatus: z.enum(VERIFICATION_STATUSES),
    schemeStatus: z.enum(SCHEME_STATUSES),
    dataVersion: z.string().min(3),
  })
  // Unknown keys are allowed: records carry *Note and *Provenance annotations
  // whose names vary, and rejecting them would discourage documenting
  // provenance.
  .passthrough();

type SchemeRecord = z.infer<typeof recordSchema>;

interface Issue {
  schemeId: string;
  severity: 'ERROR' | 'WARNING';
  field: string;
  message: string;
}

/**
 * Provenance and honesty rules.
 *
 * These are the checks that make the dataset trustworthy, as distinct from
 * merely well-formed.
 */
function checkProvenance(record: SchemeRecord, raw: Record<string, unknown>): Issue[] {
  const issues: Issue[] = [];
  const id = record.schemeId;

  if (!isOfficialDomain(record.sourceDomain)) {
    issues.push({
      schemeId: id,
      severity: 'ERROR',
      field: 'sourceDomain',
      message: `"${record.sourceDomain}" is not an official government domain. A scheme record may not cite a non-government source as authoritative.`,
    });
  }

  try {
    const url = new URL(record.officialSourceUrl);
    if (!isOfficialDomain(url.hostname)) {
      issues.push({
        schemeId: id,
        severity: 'ERROR',
        field: 'officialSourceUrl',
        message: `Source URL host "${url.hostname}" is not an official government domain.`,
      });
    }
    if (url.protocol !== 'https:') {
      issues.push({
        schemeId: id,
        severity: 'WARNING',
        field: 'officialSourceUrl',
        message: 'Source URL is not HTTPS.',
      });
    }
  } catch {
    issues.push({ schemeId: id, severity: 'ERROR', field: 'officialSourceUrl', message: 'Malformed URL.' });
  }

  // A claim of verification requires a date.
  if (record.verificationStatus === 'VERIFIED' || record.verificationStatus === 'PUBLISHED') {
    if (!record.lastVerifiedAt) {
      issues.push({
        schemeId: id,
        severity: 'ERROR',
        field: 'lastVerifiedAt',
        message: `Status is ${record.verificationStatus} but no verification date is recorded.`,
      });
    }
    if (record.eligibilityCriteria.length === 0) {
      issues.push({
        schemeId: id,
        severity: 'ERROR',
        field: 'eligibilityCriteria',
        message: `Status is ${record.verificationStatus} but no eligibility criteria were recorded. An empty criteria list would be read by the matching engine as "unrestricted".`,
      });
    }
  }

  // A funding figure must be explainable.
  if ((record.minFunding !== null || record.maxFunding !== null) && !record.fundingAmountDescription) {
    issues.push({
      schemeId: id,
      severity: 'ERROR',
      field: 'fundingAmountDescription',
      message: 'A funding figure is present with no description stating where it came from.',
    });
  }

  if (record.minFunding !== null && record.maxFunding !== null && record.minFunding > record.maxFunding) {
    issues.push({
      schemeId: id,
      severity: 'ERROR',
      field: 'maxFunding',
      message: 'Minimum funding exceeds maximum funding.',
    });
  }

  // A derived field must declare itself. Silently derived values are how a
  // dataset stops being traceable.
  for (const key of Object.keys(raw)) {
    if (!key.endsWith('Provenance')) continue;
    const value = raw[key];
    if (typeof value !== 'string' || !PROVENANCE.includes(value as (typeof PROVENANCE)[number])) {
      issues.push({
        schemeId: id,
        severity: 'ERROR',
        field: key,
        message: `Provenance must be one of ${PROVENANCE.join(', ')}; got ${JSON.stringify(value)}.`,
      });
      continue;
    }
    if (value === 'DERIVED') {
      const base = key.replace(/Provenance$/, '');
      if (!(`${base}Note` in raw)) {
        issues.push({
          schemeId: id,
          severity: 'ERROR',
          field: key,
          message: `${base} is marked DERIVED but has no ${base}Note explaining the derivation.`,
        });
      }
    }
  }

  // A populated array with no provenance and no note is unattributed.
  for (const field of ['eligibilityCriteria', 'supportedPurposes'] as const) {
    const values = record[field];
    if (Array.isArray(values) && values.length > 0) {
      if (!(`${field}Provenance` in raw) && !(`${field}Note` in raw)) {
        issues.push({
          schemeId: id,
          severity: 'WARNING',
          field,
          message: `${field} is populated but carries neither a Provenance marker nor a Note.`,
        });
      }
    }
  }

  // Status must not be asserted without evidence.
  if (record.schemeStatus === 'ACTIVE' && !('schemeStatusNote' in raw)) {
    issues.push({
      schemeId: id,
      severity: 'WARNING',
      field: 'schemeStatus',
      message: 'ACTIVE is asserted with no note recording the evidence. A page existing is not evidence a scheme is open.',
    });
  }

  if (record.governmentLevel === 'STATE' && !record.state) {
    issues.push({
      schemeId: id,
      severity: 'ERROR',
      field: 'state',
      message: 'A STATE-level scheme must name its state.',
    });
  }

  return issues;
}

/** Freshness. Configurable; not deleted automatically. */
const STALE_AFTER_DAYS = Number(process.env['SCHEME_REVERIFY_DAYS'] ?? 180);

function checkFreshness(record: SchemeRecord): Issue[] {
  if (!record.lastVerifiedAt) return [];
  const verified = new Date(record.lastVerifiedAt).getTime();
  const ageDays = (Date.now() - verified) / (1000 * 60 * 60 * 24);
  if (ageDays > STALE_AFTER_DAYS) {
    return [
      {
        schemeId: record.schemeId,
        severity: 'WARNING',
        field: 'lastVerifiedAt',
        message: `Last verified ${Math.round(ageDays)} days ago, over the ${STALE_AFTER_DAYS}-day threshold. Should move to NEEDS_REVERIFICATION.`,
      },
    ];
  }
  return [];
}

/** Normalised key for duplicate detection. */
function normaliseName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function findDuplicates(records: SchemeRecord[]) {
  const byName = new Map<string, string[]>();
  const bySlug = new Map<string, string[]>();
  const byUrl = new Map<string, string[]>();

  for (const r of records) {
    const push = (map: Map<string, string[]>, key: string) => {
      const list = map.get(key) ?? [];
      list.push(r.schemeId);
      map.set(key, list);
    };
    push(byName, normaliseName(r.schemeName));
    push(bySlug, r.slug);
    push(byUrl, r.officialSourceUrl.replace(/\/$/, ''));
  }

  const candidates: Array<{ reason: string; key: string; schemeIds: string[] }> = [];
  for (const [label, map] of [
    ['normalised name', byName],
    ['slug', bySlug],
    ['source URL', byUrl],
  ] as const) {
    for (const [key, ids] of map) {
      // Not deleted — flagged for human review, because two schemes can
      // legitimately share a portal URL.
      if (ids.length > 1) candidates.push({ reason: label, key, schemeIds: ids });
    }
  }
  return candidates;
}

function main(): void {
  if (!fs.existsSync(DATASET)) {
    console.error(`Dataset not found at ${DATASET}`);
    process.exit(1);
  }

  const parsed = JSON.parse(fs.readFileSync(DATASET, 'utf8')) as {
    datasetVersion: string;
    records: Array<Record<string, unknown>>;
  };

  const issues: Issue[] = [];
  const valid: SchemeRecord[] = [];

  for (const raw of parsed.records) {
    const result = recordSchema.safeParse(raw);
    if (!result.success) {
      for (const issue of result.error.issues) {
        issues.push({
          schemeId: String(raw['schemeId'] ?? 'unknown'),
          severity: 'ERROR',
          field: issue.path.join('.') || '(root)',
          message: issue.message,
        });
      }
      continue;
    }
    issues.push(...checkProvenance(result.data, raw));
    issues.push(...checkFreshness(result.data));
    valid.push(result.data);
  }

  const errors = issues.filter((i) => i.severity === 'ERROR');
  const warnings = issues.filter((i) => i.severity === 'WARNING');
  const invalidIds = new Set(errors.map((e) => e.schemeId));
  const duplicates = findDuplicates(valid);

  const byStatus = (status: string) => valid.filter((r) => r.verificationStatus === status).length;

  const report = {
    datasetVersion: parsed.datasetVersion,
    generatedAt: new Date().toISOString().slice(0, 10),
    totalRecords: parsed.records.length,
    validRecords: valid.length - invalidIds.size,
    invalidRecords: invalidIds.size,
    errors: errors.length,
    warnings: warnings.length,
    byVerificationStatus: {
      DRAFT: byStatus('DRAFT'),
      NEEDS_VERIFICATION: byStatus('NEEDS_VERIFICATION'),
      VERIFIED: byStatus('VERIFIED'),
      PUBLISHED: byStatus('PUBLISHED'),
      NEEDS_REVERIFICATION: byStatus('NEEDS_REVERIFICATION'),
      ARCHIVED: byStatus('ARCHIVED'),
    },
    completeness: {
      missingApplicationUrl: valid.filter((r) => !r.applicationUrl).length,
      missingFundingRange: valid.filter((r) => r.minFunding === null && r.maxFunding === null).length,
      missingEligibility: valid.filter((r) => r.eligibilityCriteria.length === 0).length,
      missingDocuments: valid.filter((r) => r.documentRequirements.length === 0).length,
      missingApplicationProcess: valid.filter((r) => !r.applicationProcess).length,
    },
    duplicateCandidates: duplicates.length,
    issues,
  };

  fs.mkdirSync(METADATA_DIR, { recursive: true });
  fs.writeFileSync(path.join(METADATA_DIR, 'validation_report.json'), JSON.stringify(report, null, 2) + '\n');
  fs.writeFileSync(
    path.join(METADATA_DIR, 'duplicates_report.json'),
    JSON.stringify(
      {
        generatedAt: report.generatedAt,
        note: 'Candidates only. Nothing is removed automatically — two schemes can legitimately share a portal URL.',
        candidates: duplicates,
      },
      null,
      2,
    ) + '\n',
  );

  console.log(`\nDataset ${parsed.datasetVersion}`);
  console.log(`  records read     : ${report.totalRecords}`);
  console.log(`  valid            : ${report.validRecords}`);
  console.log(`  invalid          : ${report.invalidRecords}`);
  console.log(`  errors           : ${report.errors}`);
  console.log(`  warnings         : ${report.warnings}`);
  console.log(`  duplicates flagged: ${report.duplicateCandidates}`);
  console.log('');
  console.log('  verification status:');
  for (const [k, v] of Object.entries(report.byVerificationStatus)) {
    if (v > 0) console.log(`    ${k.padEnd(22)}${v}`);
  }

  if (issues.length > 0) {
    console.log('');
    for (const i of issues) {
      console.log(`  [${i.severity}] ${i.schemeId} ${i.field}: ${i.message}`);
    }
  }

  console.log(`\nReports written to datasets/metadata/government/\n`);

  if (errors.length > 0) process.exit(1);
}

main();
