/**
 * Business-side routes.
 *
 * Guard order on every route is: authenticate -> role/ownership -> validate.
 * Authorisation runs before validation deliberately — an unauthorised caller
 * should get 401/403 without learning anything about the expected request shape.
 */
import { Router } from 'express';
import * as controller from '../controllers/business.controller';
import { authenticate } from '../middleware/authenticate';
import { requireOwnBusiness, requireRole } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { aiLimiter } from '../middleware/rateLimit';
import {
  createActionItemSchema,
  idParamSchema,
  savedOpportunitySchema,
  updateActionItemSchema,
  updateBusinessProfileSchema,
  upsertFundingRequirementSchema,
} from '../validators/business';

export const businessRouter = Router();

// Everything below requires a signed-in business owner.
businessRouter.use(authenticate, requireOwnBusiness);

businessRouter.get('/dashboard', controller.getDashboard);

businessRouter.get('/profile', controller.getProfile);
businessRouter.put('/profile', validate({ body: updateBusinessProfileSchema }), controller.updateProfile);
businessRouter.get('/profile/completion', controller.getCompletion);

businessRouter.get('/funding-requirement', controller.getRequirement);
businessRouter.put(
  '/funding-requirement',
  validate({ body: upsertFundingRequirementSchema }),
  controller.upsertRequirement,
);

businessRouter.get('/readiness', controller.getReadiness);
// Rate-limited as an analysis endpoint: it recomputes every component.
businessRouter.post('/readiness/analyse', aiLimiter, controller.analyseReadiness);

businessRouter.get('/matches/schemes', controller.listMatches);
// Scores every published scheme, so it is the most expensive endpoint here.
businessRouter.post('/matches/schemes/recalculate', aiLimiter, controller.recalculateMatches);
businessRouter.get('/matches/schemes/:id', validate({ params: idParamSchema }), controller.getMatch);

businessRouter.get('/action-plan', controller.listActionPlan);
businessRouter.post('/action-plan/generate', aiLimiter, controller.generateActionPlan);
businessRouter.post('/action-plan', validate({ body: createActionItemSchema }), controller.createActionItem);
businessRouter.patch(
  '/action-plan/:id',
  validate({ params: idParamSchema, body: updateActionItemSchema }),
  controller.updateActionItem,
);
businessRouter.delete('/action-plan/:id', validate({ params: idParamSchema }), controller.deleteActionItem);

/**
 * Saved opportunities.
 *
 * Keyed by user rather than business, so the same routes will serve investors
 * saving businesses. Scoped to the caller inside the service.
 */
export const savedRouter = Router();
savedRouter.use(authenticate, requireRole('STARTUP', 'INVESTOR'));
savedRouter.get('/', controller.listSaved);
savedRouter.post('/', validate({ body: savedOpportunitySchema }), controller.createSaved);
savedRouter.delete('/:id', validate({ params: idParamSchema }), controller.deleteSaved);

/**
 * Scheme catalogue.
 *
 * Readable by any signed-in user: the published catalogue is reference
 * information, not anyone's private data. Only PUBLISHED records are returned,
 * enforced in the service.
 */
export const schemeRouter = Router();
schemeRouter.use(authenticate);
schemeRouter.get('/', controller.listSchemes);
schemeRouter.get('/:id', validate({ params: idParamSchema }), controller.getScheme);
