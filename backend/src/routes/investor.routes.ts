/**
 * Investor routes.
 *
 * `requireOwnInvestorProfile` is applied to the router, so every endpoint is
 * scoped to the caller's own investor profile and a business account cannot
 * reach any of them.
 */
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { asyncHandler, noContent, ok } from '../lib/http';
import { ForbiddenError } from '../lib/errors';
import { authenticate } from '../middleware/authenticate';
import { requireOwnInvestorProfile } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { aiLimiter } from '../middleware/rateLimit';
import { idParamSchema } from '../validators/business';
import * as investor from '../services/investor.service';

export const investorRouter = Router();

investorRouter.use(authenticate, requireOwnInvestorProfile);

function investorId(req: Request): string {
  const id = req.user?.investorProfileId;
  if (!id) throw new ForbiddenError('An investor profile is required for this action.');
  return id;
}

const investorTypeEnum = z.enum([
  'ANGEL',
  'VENTURE_CAPITAL',
  'PRIVATE_EQUITY',
  'FAMILY_OFFICE',
  'CORPORATE',
  'IMPACT',
  'FUND',
  'OTHER',
]);

const updateProfileSchema = z
  .object({
    investorName: z.string().trim().min(2).max(200).optional(),
    investorType: investorTypeEnum.optional(),
    description: z.string().trim().max(3000).nullable().optional(),
    minInvestment: z.number().min(0).max(1e15).nullable().optional(),
    maxInvestment: z.number().min(0).max(1e15).nullable().optional(),
    industries: z.array(z.string().trim().min(1).max(120)).max(50).optional(),
    preferredStages: z
      .array(z.enum(['IDEA', 'PROTOTYPE', 'EARLY', 'GROWTH', 'EXPANSION', 'MATURE']))
      .max(6)
      .optional(),
    preferredLocations: z.array(z.string().trim().min(1).max(120)).max(50).optional(),
    fundingTypes: z
      .array(z.enum(['EQUITY', 'DEBT', 'GRANT', 'SUBSIDY', 'LOAN', 'GUARANTEE', 'ANY_SUITABLE', 'OTHER']))
      .max(8)
      .optional(),
    investmentPreferences: z.string().trim().max(3000).nullable().optional(),
    website: z.string().url().max(300).nullable().optional(),
    active: z.boolean().optional(),
  })
  .strict()
  // `verification` is absent by design: an investor cannot mark themselves
  // verified. Only an administrator can.
  .refine(
    (v) =>
      v.minInvestment === undefined ||
      v.maxInvestment === undefined ||
      v.minInvestment === null ||
      v.maxInvestment === null ||
      v.minInvestment <= v.maxInvestment,
    { path: ['maxInvestment'], message: 'Maximum investment must be at least the minimum' },
  );

const discoverQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    industry: z.string().trim().max(120).optional(),
    businessStage: z.enum(['IDEA', 'PROTOTYPE', 'EARLY', 'GROWTH', 'EXPANSION', 'MATURE']).optional(),
    state: z.string().trim().max(120).optional(),
    minAmount: z.coerce.number().min(0).optional(),
    maxAmount: z.coerce.number().min(0).optional(),
    search: z.string().trim().max(200).optional(),
  })
  .strict();

const shortlistSchema = z
  .object({
    businessId: z.string().trim().min(1).max(64),
    notes: z.string().trim().max(2000).nullable().optional(),
  })
  .strict();

const updateShortlistSchema = z
  .object({
    status: z.enum(['WATCHING', 'CONTACTED', 'IN_REVIEW', 'PASSED']).optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields were provided to update' });

// --- Dashboard and profile -------------------------------------------------

investorRouter.get(
  '/dashboard',
  asyncHandler(async (req: Request, res: Response) => {
    ok(res, { dashboard: await investor.getInvestorDashboard(investorId(req)) });
  }),
);

investorRouter.get(
  '/profile',
  asyncHandler(async (req: Request, res: Response) => {
    ok(res, { investor: await investor.getInvestorProfile(investorId(req)) });
  }),
);

investorRouter.put(
  '/profile',
  validate({ body: updateProfileSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    ok(res, { investor: await investor.updateInvestorProfile(investorId(req), req.body) });
  }),
);

// --- Discovery -------------------------------------------------------------

investorRouter.get(
  '/discover',
  validate({ query: discoverQuerySchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const q = req.query as unknown as Parameters<typeof investor.discoverBusinesses>[0];
    const { items, meta } = await investor.discoverBusinesses(q);
    res.status(200).json({ data: items, meta });
  }),
);

investorRouter.get(
  '/businesses/:id',
  validate({ params: idParamSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    ok(res, { business: await investor.getBusinessForInvestor(req.params['id'] as string) });
  }),
);

// --- Matching --------------------------------------------------------------

investorRouter.get(
  '/matches',
  asyncHandler(async (req: Request, res: Response) => {
    ok(res, { matches: await investor.listInvestorMatches(investorId(req)) });
  }),
);

investorRouter.post(
  '/matches/recalculate',
  aiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const id = investorId(req);
    const summary = await investor.recalculateInvestorMatches(id);
    ok(res, { summary, matches: await investor.listInvestorMatches(id) });
  }),
);

// --- Shortlist -------------------------------------------------------------

investorRouter.get(
  '/shortlist',
  asyncHandler(async (req: Request, res: Response) => {
    ok(res, { shortlist: await investor.listShortlist(investorId(req)) });
  }),
);

investorRouter.post(
  '/shortlist',
  validate({ body: shortlistSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const { businessId, notes } = req.body as { businessId: string; notes?: string | null };
    ok(res, { entry: await investor.addToShortlist(investorId(req), businessId, notes) }, 201);
  }),
);

investorRouter.patch(
  '/shortlist/:id',
  validate({ params: idParamSchema, body: updateShortlistSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    ok(res, {
      entry: await investor.updateShortlistEntry(
        investorId(req),
        req.params['id'] as string,
        req.body as { status?: string; notes?: string | null },
      ),
    });
  }),
);

investorRouter.delete(
  '/shortlist/:id',
  validate({ params: idParamSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    await investor.removeFromShortlist(investorId(req), req.params['id'] as string);
    noContent(res);
  }),
);
