/**
 * Business profile and funding requirement schemas.
 *
 * Two deliberate choices run through this file:
 *
 * - **Partial by design.** A user must be able to save progress without filling
 *   every field (master spec §9: identify required, optional and missing rather
 *   than forcing completeness). Only `businessName` is mandatory. Incompleteness
 *   is then surfaced honestly by the readiness engine instead of being blocked
 *   at the form.
 *
 * - **`null` means "cleared", `undefined` means "unchanged".** `.nullable()`
 *   lets a user erase a value they entered by mistake; omitting the key leaves
 *   it alone. Collapsing the two would make fields impossible to clear.
 */
import { z } from 'zod';
import { FUNDING_PURPOSE_VOCABULARY } from '../config/matching';

const CURRENT_YEAR = new Date().getUTCFullYear();

/** Trims, then treats an empty string as an explicit clear. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use at most ${max} characters`)
    .transform((v) => (v.length === 0 ? null : v))
    .nullable()
    .optional();

/**
 * Money. Capped at 1e15 because the column is Decimal(18,2); a larger value
 * would be a database error rather than a validation message.
 */
const money = z
  .number()
  .finite()
  .min(0, 'Cannot be negative')
  .max(1e15, 'Value is implausibly large')
  .nullable()
  .optional();

/** Profit/loss may legitimately be negative, unlike the other money fields. */
const signedMoney = z
  .number()
  .finite()
  .min(-1e15)
  .max(1e15, 'Value is implausibly large')
  .nullable()
  .optional();

const count = (max: number) => z.number().int().min(0).max(max).nullable().optional();

const stringList = (maxItems: number, maxLen = 200) =>
  z
    .array(z.string().trim().min(1).max(maxLen))
    .max(maxItems, `Use at most ${maxItems} entries`)
    // Blank entries from dynamic form rows are dropped rather than stored.
    .transform((arr) => arr.filter((s) => s.length > 0))
    .optional();

export const businessTypeEnum = z.enum([
  'PROPRIETORSHIP',
  'PARTNERSHIP',
  'LLP',
  'PRIVATE_LIMITED',
  'PUBLIC_LIMITED',
  'FPO',
  'SOCIETY',
  'TRUST',
  'SELF_HELP_GROUP',
  'OTHER',
]);

export const businessStageEnum = z.enum(['IDEA', 'PROTOTYPE', 'EARLY', 'GROWTH', 'EXPANSION', 'MATURE']);

export const productStatusEnum = z.enum(['CONCEPT', 'IN_DEVELOPMENT', 'PILOT', 'LAUNCHED', 'SCALING']);

export const fundingTypeEnum = z.enum([
  'EQUITY',
  'DEBT',
  'GRANT',
  'SUBSIDY',
  'LOAN',
  'GUARANTEE',
  'ANY_SUITABLE',
  'OTHER',
]);

export const updateBusinessProfileSchema = z
  .object({
    businessName: z.string().trim().min(2, 'Enter your business name').max(200).optional(),

    businessType: businessTypeEnum.nullable().optional(),
    industry: optionalText(120),
    subIndustry: optionalText(120),
    location: optionalText(120),
    state: optionalText(120),
    country: optionalText(120),
    foundedYear: z
      .number()
      .int()
      .min(1800, 'Enter a realistic year')
      // A future founding year would silently produce a negative business age
      // in the matching engine's age gates.
      .max(CURRENT_YEAR, 'The founding year cannot be in the future')
      .nullable()
      .optional(),
    businessStage: businessStageEnum.nullable().optional(),
    teamSize: count(1_000_000),

    description: optionalText(5000),
    problem: optionalText(5000),
    solution: optionalText(5000),
    targetCustomer: optionalText(2000),
    productStatus: productStatusEnum.nullable().optional(),
    customerCount: count(100_000_000),

    annualRevenue: money,
    annualExpenses: money,
    profitLoss: signedMoney,
    existingFunding: money,
    existingDebt: money,
    /** Stored as a fraction: 0.4 is 40% growth. */
    growthRate: z.number().finite().min(-1).max(1000).nullable().optional(),
    marketSize: money,

    founderExperience: count(100),
    teamStrength: optionalText(3000),
    customers: stringList(50),
    partnerships: stringList(50),
    certifications: stringList(50),
    intellectualProperty: stringList(50),

    udyamRegistered: z.boolean().nullable().optional(),
    dpiitRecognised: z.boolean().nullable().optional(),
    gstRegistered: z.boolean().nullable().optional(),
    registrationNumber: optionalText(100),

    discoverable: z.boolean().optional(),
  })
  // Rejects unexpected keys, so a client cannot post `sourceType: 'OFFICIAL_SOURCE'`
  // and launder seed data into verified reference data.
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields were provided to update' });

export const upsertFundingRequirementSchema = z
  .object({
    amountRequired: z
      .number()
      .finite()
      .positive('Enter the amount you need')
      .max(1e15, 'Value is implausibly large'),
    currency: z
      .string()
      .trim()
      .toUpperCase()
      .length(3, 'Use a three-letter currency code')
      .default('INR'),
    purpose: z.string().trim().min(3, 'Describe what the funding is for').max(500),
    fundingType: fundingTypeEnum,
    preferredTimeline: optionalText(120),
    preferredLocation: optionalText(120),
    additionalRequirements: optionalText(2000),
  })
  .strict();

/** Query parameters for the scheme catalogue. */
export const listSchemesQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    // Capped so a client cannot request an unbounded page and exhaust memory.
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().max(200).optional(),
    level: z.enum(['CENTRAL', 'STATE']).optional(),
    schemeType: z
      .enum(['GRANT', 'LOAN', 'EQUITY', 'SUBSIDY', 'GUARANTEE', 'INCUBATION', 'OTHER'])
      .optional(),
    industry: z.string().trim().max(120).optional(),
    sort: z.enum(['name', 'recentlyVerified']).default('name'),
  })
  .strict();

export const savedOpportunitySchema = z
  .object({
    opportunityType: z.enum(['INVESTOR', 'SCHEME']),
    opportunityId: z.string().trim().min(1).max(64),
    notes: optionalText(2000),
  })
  .strict();

export const updateActionItemSchema = z
  .object({
    status: z.enum(['TODO', 'IN_PROGRESS', 'COMPLETED', 'DISMISSED']).optional(),
    notes: optionalText(2000),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields were provided to update' });

export const createActionItemSchema = z
  .object({
    title: z.string().trim().min(3).max(200),
    description: optionalText(2000),
    priority: z.enum(['P1', 'P2', 'P3', 'P4', 'P5']).default('P3'),
    dueDate: z.coerce.date().nullable().optional(),
  })
  .strict();

export const idParamSchema = z.object({ id: z.string().trim().min(1).max(64) }).strict();

export const FUNDING_PURPOSES = FUNDING_PURPOSE_VOCABULARY;

export type UpdateBusinessProfileInput = z.infer<typeof updateBusinessProfileSchema>;
export type UpsertFundingRequirementInput = z.infer<typeof upsertFundingRequirementSchema>;
export type ListSchemesQuery = z.infer<typeof listSchemesQuerySchema>;
