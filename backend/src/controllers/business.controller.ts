/**
 * Business-side endpoints.
 *
 * Every handler scopes work to `req.user.businessProfileId`, which the
 * `requireOwnBusiness` guard resolved from the session. No handler reads a
 * business id from the URL or body, so there is no path by which one business
 * could address another's data.
 */
import type { Request, Response } from 'express';
import { asyncHandler, ok, noContent } from '../lib/http';
import { ForbiddenError } from '../lib/errors';
import * as businessService from '../services/business.service';
import * as readinessService from '../services/readiness.service';
import * as schemeService from '../services/scheme.service';
import * as actionPlanService from '../services/actionPlan.service';
import * as savedService from '../services/saved.service';
import * as proposalService from '../services/proposal.service';
import { env } from '../config/env';
import { recordAudit } from '../services/audit.service';
import { listSchemesQuerySchema } from '../validators/business';

/**
 * The guard guarantees this, but reading it through a helper keeps every
 * handler's narrowing honest rather than relying on a non-null assertion.
 */
function businessId(req: Request): string {
  const id = req.user?.businessProfileId;
  if (!id) throw new ForbiddenError('A business profile is required for this action.');
  return id;
}

// --- Profile ---------------------------------------------------------------

export const getProfile = asyncHandler(async (req: Request, res: Response) => {
  ok(res, { business: await businessService.getBusinessProfile(businessId(req)) });
});

export const updateProfile = asyncHandler(async (req: Request, res: Response) => {
  const id = businessId(req);
  const business = await businessService.updateBusinessProfile(id, req.body);

  await recordAudit({
    actorId: req.user?.id,
    action: 'business.updated',
    entity: 'BusinessProfile',
    entityId: id,
    // Field names only — never the values, which are commercially sensitive.
    metadata: { fields: Object.keys(req.body as object) },
    ip: req.ip,
  });

  ok(res, { business });
});

export const getCompletion = asyncHandler(async (req: Request, res: Response) => {
  ok(res, { completion: await businessService.getProfileCompletion(businessId(req)) });
});

// --- Funding requirement ---------------------------------------------------

export const getRequirement = asyncHandler(async (req: Request, res: Response) => {
  ok(res, { requirement: await businessService.getFundingRequirement(businessId(req)) });
});

export const upsertRequirement = asyncHandler(async (req: Request, res: Response) => {
  const requirement = await businessService.upsertFundingRequirement(businessId(req), req.body);
  ok(res, { requirement });
});

// --- Readiness -------------------------------------------------------------

export const getReadiness = asyncHandler(async (req: Request, res: Response) => {
  const readiness = await readinessService.getStoredReadiness(businessId(req));
  // Null is a meaningful answer: "not calculated yet". The UI offers the action
  // rather than showing a number the user never requested.
  ok(res, { readiness });
});

export const analyseReadiness = asyncHandler(async (req: Request, res: Response) => {
  ok(res, { readiness: await readinessService.recalculateReadiness(businessId(req)) });
});

// --- Schemes and matches ---------------------------------------------------

export const listSchemes = asyncHandler(async (req: Request, res: Response) => {
  const query = listSchemesQuerySchema.parse(req.query);
  const { items, meta } = await schemeService.listPublishedSchemes(query);
  res.status(200).json({ data: items, meta });
});

export const getScheme = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params['id'] as string;
  ok(res, { scheme: await schemeService.getPublishedScheme(id) });
});

export const listMatches = asyncHandler(async (req: Request, res: Response) => {
  ok(res, { matches: await schemeService.listSchemeMatches(businessId(req)) });
});

export const recalculateMatches = asyncHandler(async (req: Request, res: Response) => {
  const summary = await schemeService.recalculateSchemeMatches(businessId(req));
  const matches = await schemeService.listSchemeMatches(businessId(req));
  ok(res, { summary, matches });
});

export const getMatch = asyncHandler(async (req: Request, res: Response) => {
  const schemeId = req.params['id'] as string;
  ok(res, { match: await schemeService.getSchemeMatch(businessId(req), schemeId) });
});

// --- Action plan -----------------------------------------------------------

export const listActionPlan = asyncHandler(async (req: Request, res: Response) => {
  ok(res, { items: await actionPlanService.listActionPlan(businessId(req)) });
});

export const generateActionPlan = asyncHandler(async (req: Request, res: Response) => {
  const id = businessId(req);
  const summary = await actionPlanService.regenerateActionPlan(id);
  ok(res, { summary, items: await actionPlanService.listActionPlan(id) });
});

export const createActionItem = asyncHandler(async (req: Request, res: Response) => {
  ok(res, { item: await actionPlanService.createManualActionItem(businessId(req), req.body) }, 201);
});

export const updateActionItem = asyncHandler(async (req: Request, res: Response) => {
  const itemId = req.params['id'] as string;
  ok(res, { item: await actionPlanService.updateActionItem(businessId(req), itemId, req.body) });
});

export const deleteActionItem = asyncHandler(async (req: Request, res: Response) => {
  await actionPlanService.deleteActionItem(businessId(req), req.params['id'] as string);
  noContent(res);
});

// --- Saved opportunities ---------------------------------------------------

export const listSaved = asyncHandler(async (req: Request, res: Response) => {
  ok(res, { saved: await savedService.listSavedOpportunities(req.user!.id) });
});

export const createSaved = asyncHandler(async (req: Request, res: Response) => {
  ok(res, { saved: await savedService.saveOpportunity(req.user!.id, req.body) }, 201);
});

export const deleteSaved = asyncHandler(async (req: Request, res: Response) => {
  await savedService.deleteSavedOpportunity(req.user!.id, req.params['id'] as string);
  noContent(res);
});

// --- Dashboard -------------------------------------------------------------

/**
 * Everything the dashboard shows, in one request.
 *
 * Assembled from stored values only — nothing is computed here, so the
 * dashboard cannot display a number that differs from the detail page for the
 * same thing. Every field may legitimately be null/zero, which the UI renders
 * as "not calculated yet" rather than as a result (master spec §41).
 */
export const getDashboard = asyncHandler(async (req: Request, res: Response) => {
  const id = businessId(req);

  const [completion, readiness, matches, actionItems, saved, requirement, proposals] = await Promise.all([
    businessService.getProfileCompletion(id),
    readinessService.getStoredReadiness(id),
    schemeService.listSchemeMatches(id),
    actionPlanService.listActionPlan(id),
    savedService.listSavedOpportunities(req.user!.id),
    businessService.getFundingRequirement(id),
    proposalService.listProposals(id),
  ]);

  const openItems = actionItems.filter((i) => i.status === 'TODO' || i.status === 'IN_PROGRESS');
  // Most recent first, as listProposals already orders them.
  const analysedProposals = proposals.filter((p) => p.status === 'ANALYSED');

  ok(res, {
    dashboard: {
      completion,
      readiness,
      requirement,
      schemeMatches: {
        total: matches.length,
        potentiallyEligible: matches.filter((m) => m.status === 'POTENTIALLY_ELIGIBLE').length,
        needsInformation: matches.filter((m) => m.status === 'NEEDS_INFORMATION').length,
        top: matches.slice(0, 5),
      },
      actionPlan: {
        total: actionItems.length,
        open: openItems.length,
        highPriority: openItems.filter((i) => i.priority === 'P1').length,
      },
      savedCount: saved.length,
      // Real counts, read from the proposals this business has uploaded.
      // `available` reflects whether the AI service is configured, since
      // extraction and analysis depend on it — not a hardcoded flag.
      proposal: {
        uploaded: proposals.length,
        analysed: analysedProposals.length,
        latestScore: analysedProposals[0]?.analyses?.[0]?.overallScore ?? null,
        available: env.aiServiceEnabled,
      },
    },
  });
});
