/**
 * Admin routes.
 *
 * `requireAdmin` is applied to the whole router rather than per route, so a new
 * endpoint cannot be added here without authorisation by omission.
 */
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { asyncHandler, ok } from '../lib/http';
import { ForbiddenError } from '../lib/errors';
import { authenticate } from '../middleware/authenticate';
import { requireAdmin } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { aiLimiter, sensitiveLimiter } from '../middleware/rateLimit';
import { idParamSchema } from '../validators/business';
import { CONFIG_KEYS, type ConfigKey } from '../config/matching';
import * as admin from '../services/admin.service';
import * as rag from '../services/rag.service';
import { listActiveConfig } from '../services/config.service';

export const adminRouter = Router();

adminRouter.use(authenticate, requireAdmin);

function actor(req: Request): { id: string; ip?: string | null } {
  if (!req.user) throw new ForbiddenError('Administrator access is required.');
  return { id: req.user.id, ip: req.ip ?? null };
}

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

const schemeStatusEnum = z.enum([
  'DRAFT',
  'NEEDS_VERIFICATION',
  'VERIFIED',
  'PUBLISHED',
  'NEEDS_REVERIFICATION',
  'ARCHIVED',
]);

// ---------------------------------------------------------------------------
// Dashboard and monitoring
// ---------------------------------------------------------------------------

adminRouter.get(
  '/status',
  asyncHandler(async (_req: Request, res: Response) => {
    ok(res, { status: await admin.getSystemStatus() });
  }),
);

adminRouter.get(
  '/data-quality',
  asyncHandler(async (_req: Request, res: Response) => {
    ok(res, { report: await admin.getDataQualityReport() });
  }),
);

adminRouter.get(
  '/security',
  asyncHandler(async (_req: Request, res: Response) => {
    ok(res, { overview: await admin.getSecurityOverview() });
  }),
);

// ---------------------------------------------------------------------------
// Schemes
// ---------------------------------------------------------------------------

adminRouter.get(
  '/schemes',
  validate({
    query: paginationSchema
      .extend({ status: schemeStatusEnum.optional(), search: z.string().trim().max(200).optional() })
      .strict(),
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const q = req.query as unknown as { page: number; limit: number; status?: never; search?: string };
    const { items, meta } = await admin.listSchemesForAdmin(q);
    res.status(200).json({ data: items, meta });
  }),
);

adminRouter.get(
  '/schemes/:id',
  validate({ params: idParamSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    ok(res, { scheme: await admin.getSchemeForAdmin(req.params['id'] as string) });
  }),
);

/**
 * Editable scheme fields.
 *
 * `status` is absent on purpose: lifecycle changes go through the transition
 * endpoint, which enforces the permitted moves and the completeness checks.
 */
const updateSchemeSchema = z
  .object({
    name: z.string().trim().min(2).max(300).optional(),
    provider: z.string().trim().min(2).max(200).optional(),
    ministry: z.string().trim().max(200).nullable().optional(),
    department: z.string().trim().max(200).nullable().optional(),
    level: z.enum(['CENTRAL', 'STATE']).optional(),
    schemeType: z.enum(['GRANT', 'LOAN', 'EQUITY', 'SUBSIDY', 'GUARANTEE', 'INCUBATION', 'OTHER']).optional(),
    description: z.string().trim().max(5000).nullable().optional(),
    fundingDescription: z.string().trim().max(2000).nullable().optional(),
    targetBusinessTypes: z.array(z.string()).max(20).optional(),
    supportedIndustries: z.array(z.string().trim().min(1).max(120)).max(50).optional(),
    supportedStages: z.array(z.string()).max(10).optional(),
    supportedLocations: z.array(z.string().trim().min(1).max(120)).max(50).optional(),
    supportedFundingTypes: z.array(z.string()).max(10).optional(),
    supportedPurposes: z.array(z.string().trim().min(1).max(120)).max(30).optional(),
    minFunding: z.number().min(0).max(1e15).nullable().optional(),
    maxFunding: z.number().min(0).max(1e15).nullable().optional(),
    eligibilityCriteria: z.array(z.string().trim().min(1).max(600)).max(40).optional(),
    requiredDocuments: z.array(z.string().trim().min(1).max(300)).max(40).optional(),
    applicationProcess: z.string().trim().max(5000).nullable().optional(),
    applicationUrl: z.string().url().max(600).nullable().optional(),
    officialSourceUrl: z.string().url().max(600).optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
    reason: z.string().trim().max(300).optional(),
  })
  .strict()
  .refine(
    (v) =>
      v.minFunding === undefined ||
      v.maxFunding === undefined ||
      v.minFunding === null ||
      v.maxFunding === null ||
      v.minFunding <= v.maxFunding,
    { path: ['maxFunding'], message: 'Maximum funding must be at least the minimum' },
  );

adminRouter.put(
  '/schemes/:id',
  sensitiveLimiter,
  validate({ params: idParamSchema, body: updateSchemeSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const { reason, ...fields } = req.body as Record<string, unknown> & { reason?: string };
    ok(res, {
      scheme: await admin.updateScheme(req.params['id'] as string, fields, actor(req), reason),
    });
  }),
);

adminRouter.post(
  '/schemes/:id/transition',
  sensitiveLimiter,
  validate({
    params: idParamSchema,
    body: z.object({ status: schemeStatusEnum, reason: z.string().trim().max(300).optional() }).strict(),
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const { status, reason } = req.body as { status: never; reason?: string };
    const result = await admin.transitionScheme(req.params['id'] as string, status, actor(req), reason);
    ok(res, result);
  }),
);

adminRouter.get(
  '/schemes/:id/revisions',
  validate({ params: idParamSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    ok(res, { revisions: await admin.getSchemeRevisions(req.params['id'] as string) });
  }),
);

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

adminRouter.get(
  '/users',
  validate({
    query: paginationSchema
      .extend({
        role: z.enum(['STARTUP', 'INVESTOR', 'ADMIN']).optional(),
        search: z.string().trim().max(200).optional(),
      })
      .strict(),
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const q = req.query as unknown as { page: number; limit: number; role?: string; search?: string };
    const { items, meta } = await admin.listUsers(q);
    res.status(200).json({ data: items, meta });
  }),
);

adminRouter.post(
  '/users/:id/status',
  sensitiveLimiter,
  validate({
    params: idParamSchema,
    body: z.object({ status: z.enum(['ACTIVE', 'SUSPENDED']) }).strict(),
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const { status } = req.body as { status: 'ACTIVE' | 'SUSPENDED' };
    ok(res, { user: await admin.setUserStatus(req.params['id'] as string, status, actor(req)) });
  }),
);

// ---------------------------------------------------------------------------
// Matching configuration
// ---------------------------------------------------------------------------

adminRouter.get(
  '/matching-config',
  asyncHandler(async (_req: Request, res: Response) => {
    ok(res, { config: await listActiveConfig() });
  }),
);

adminRouter.put(
  '/matching-config',
  sensitiveLimiter,
  validate({
    body: z
      .object({
        key: z.enum(Object.values(CONFIG_KEYS) as [string, ...string[]]),
        // Validated against the per-key schema inside the service, which is
        // where the weights-sum-to-one rule lives.
        value: z.unknown(),
        notes: z.string().trim().max(300).optional(),
      })
      .strict(),
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const { key, value, notes } = req.body as { key: ConfigKey; value: unknown; notes?: string };
    ok(res, { config: await admin.updateMatchingConfig(key, value, actor(req), notes) });
  }),
);

adminRouter.get(
  '/matching-config/:key/history',
  validate({ params: z.object({ key: z.enum(Object.values(CONFIG_KEYS) as [string, ...string[]]) }).strict() }),
  asyncHandler(async (req: Request, res: Response) => {
    ok(res, { history: await admin.getConfigHistory(req.params['key'] as ConfigKey) });
  }),
);

// ---------------------------------------------------------------------------
// RAG knowledge base
// ---------------------------------------------------------------------------

adminRouter.get(
  '/rag/stats',
  asyncHandler(async (_req: Request, res: Response) => {
    ok(res, { stats: await rag.getIndexStats() });
  }),
);

/**
 * Re-indexes every published scheme.
 *
 * Rate-limited as an AI operation: it embeds every chunk in the corpus and is by
 * far the most expensive thing an administrator can trigger.
 */
adminRouter.post(
  '/rag/reindex',
  aiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const result = await rag.reindexAll();
    ok(res, { result, actorId: actor(req).id });
  }),
);

adminRouter.post(
  '/rag/schemes/:id/index',
  aiLimiter,
  validate({ params: idParamSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    ok(res, { result: await rag.indexScheme(req.params['id'] as string) });
  }),
);

adminRouter.post(
  '/rag/clear',
  sensitiveLimiter,
  asyncHandler(async (_req: Request, res: Response) => {
    ok(res, { result: await rag.clearIndex() });
  }),
);

adminRouter.get(
  '/audit-logs',
  validate({
    query: paginationSchema
      .extend({
        action: z.string().trim().max(60).optional(),
        entity: z.string().trim().max(60).optional(),
      })
      .strict(),
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const q = req.query as unknown as { page: number; limit: number; action?: string; entity?: string };
    const { items, meta } = await admin.listAuditLogs(q);
    res.status(200).json({ data: items, meta });
  }),
);
