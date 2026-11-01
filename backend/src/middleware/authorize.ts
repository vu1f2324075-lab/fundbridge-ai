/**
 * Authorisation — role checks and ownership checks.
 *
 * This is the authoritative layer (spec §29: "Do not trust frontend
 * authorization"). Route protection in React is UX; these guards decide.
 *
 * Two distinct questions are kept separate:
 *   requireRole   — "may this *kind* of user call this endpoint at all?"
 *   requireOwner* — "does this *specific* row belong to this user?"
 * Passing the first never implies the second: a STARTUP user reaching a
 * business endpoint still has to own the business row being addressed.
 */
import type { RequestHandler } from 'express';
import { ForbiddenError, NotFoundError, UnauthenticatedError } from '../lib/errors';
import { prisma } from '../lib/prisma';
import type { Role } from '../../generated/prisma';

/** Restricts a route to the listed roles. */
export function requireRole(...roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) return next(new UnauthenticatedError());
    if (!roles.includes(req.user.role)) {
      // The message does not confirm which role would be required.
      return next(new ForbiddenError('You do not have access to this resource.'));
    }
    next();
  };
}

export const requireAdmin = requireRole('ADMIN');
export const requireStartup = requireRole('STARTUP');
export const requireInvestor = requireRole('INVESTOR');

/**
 * Asserts the signed-in user has a business profile and attaches its id.
 * Handlers then scope queries by `req.businessId` rather than by any id taken
 * from the URL or body — the pattern that makes cross-tenant reads impossible.
 */
export const requireOwnBusiness: RequestHandler = (req, _res, next) => {
  if (!req.user) return next(new UnauthenticatedError());
  if (req.user.role !== 'STARTUP') {
    return next(new ForbiddenError('Only business accounts can access this resource.'));
  }
  if (!req.user.businessProfileId) {
    return next(new NotFoundError('Business profile'));
  }
  next();
};

export const requireOwnInvestorProfile: RequestHandler = (req, _res, next) => {
  if (!req.user) return next(new UnauthenticatedError());
  if (req.user.role !== 'INVESTOR') {
    return next(new ForbiddenError('Only investor accounts can access this resource.'));
  }
  if (!req.user.investorProfileId) {
    return next(new NotFoundError('Investor profile'));
  }
  next();
};

/**
 * Verifies a proposal belongs to the caller's business.
 *
 * Returns 404 rather than 403 when the row belongs to someone else, so the
 * endpoint cannot be used to discover which proposal ids exist. Admins bypass
 * the ownership test but not the existence test.
 */
export function requireProposalOwnership(paramName = 'id'): RequestHandler {
  return (req, _res, next) => {
    void (async () => {
      try {
        if (!req.user) throw new UnauthenticatedError();
        const proposalId = req.params[paramName];
        if (!proposalId) throw new NotFoundError('Proposal');

        const proposal = await prisma.proposal.findUnique({
          where: { id: proposalId },
          select: { id: true, businessId: true },
        });
        if (!proposal) throw new NotFoundError('Proposal');

        if (req.user.role === 'ADMIN') return next();
        if (proposal.businessId !== req.user.businessProfileId) throw new NotFoundError('Proposal');

        next();
      } catch (err) {
        next(err);
      }
    })();
  };
}

/**
 * Verifies a row on a model that has a direct `userId` column belongs to the
 * caller. Used for saved opportunities and notifications.
 *
 * The model is selected by an explicit switch rather than by indexing the
 * Prisma client dynamically: the delegate types differ per model, and an
 * explicit branch keeps the query fully type-checked.
 */
export function requireUserOwnedRecord(
  model: 'savedOpportunity' | 'notification',
  paramName = 'id',
): RequestHandler {
  return (req, _res, next) => {
    void (async () => {
      try {
        if (!req.user) throw new UnauthenticatedError();
        const id = req.params[paramName];
        if (!id) throw new NotFoundError('Record');

        const row =
          model === 'savedOpportunity'
            ? await prisma.savedOpportunity.findUnique({ where: { id }, select: { userId: true } })
            : await prisma.notification.findUnique({ where: { id }, select: { userId: true } });

        // 404 for both "absent" and "someone else's", so the endpoint cannot be
        // used to probe which ids exist.
        if (!row) throw new NotFoundError('Record');
        if (row.userId !== req.user.id && req.user.role !== 'ADMIN') throw new NotFoundError('Record');

        next();
      } catch (err) {
        next(err);
      }
    })();
  };
}
