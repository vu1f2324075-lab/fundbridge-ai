/**
 * Authentication.
 *
 * Reads the session cookie, verifies the JWT, then loads the user from the
 * database. The database read is deliberate: it means a suspended account or a
 * changed role takes effect on the next request instead of whenever the token
 * expires, and it guarantees `req.user` reflects rows that actually exist.
 */
import type { RequestHandler } from 'express';
import { UnauthenticatedError, ForbiddenError } from '../lib/errors';
import { verifySessionToken } from '../lib/tokens';
import { prisma } from '../lib/prisma';
import type { AuthenticatedUser } from '../types/express';

export const SESSION_COOKIE = 'fb_session';

/**
 * Token source is the httpOnly cookie, not a readable header: JavaScript in the
 * page cannot read it, so an XSS bug cannot exfiltrate the session. The
 * `Authorization: Bearer` form is accepted too, but only outside production,
 * where it makes Postman and the API tests considerably easier to drive.
 */
function extractToken(req: Parameters<RequestHandler>[0]): string | null {
  const cookieToken = (req.cookies as Record<string, string> | undefined)?.[SESSION_COOKIE];
  if (cookieToken) return cookieToken;

  if (process.env.NODE_ENV !== 'production') {
    const header = req.header('authorization');
    if (header?.startsWith('Bearer ')) return header.slice(7).trim() || null;
  }
  return null;
}

async function loadUser(userId: string): Promise<AuthenticatedUser | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      businessProfile: { select: { id: true } },
      investorProfile: { select: { id: true } },
    },
  });
  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    role: user.role,
    status: user.status,
    ...(user.businessProfile ? { businessProfileId: user.businessProfile.id } : {}),
    ...(user.investorProfile ? { investorProfileId: user.investorProfile.id } : {}),
  };
}

/** Rejects the request unless a valid session is present. */
export const authenticate: RequestHandler = (req, _res, next) => {
  void (async () => {
    try {
      const token = extractToken(req);
      if (!token) throw new UnauthenticatedError();

      const payload = verifySessionToken(token);
      if (!payload) throw new UnauthenticatedError('Your session has expired. Please sign in again.');

      const user = await loadUser(payload.sub);
      // Token verified but the user is gone: treat as unauthenticated, never as
      // a server error.
      if (!user) throw new UnauthenticatedError('Your session is no longer valid. Please sign in again.');
      if (user.status === 'SUSPENDED') throw new ForbiddenError('This account has been suspended.');

      req.user = user;
      next();
    } catch (err) {
      next(err);
    }
  })();
};

/**
 * Populates `req.user` when a session exists but allows anonymous access.
 * Used by endpoints whose response is richer for signed-in users — never as a
 * substitute for `authenticate` on a protected route.
 */
export const optionalAuthenticate: RequestHandler = (req, _res, next) => {
  void (async () => {
    try {
      const token = extractToken(req);
      if (!token) return next();
      const payload = verifySessionToken(token);
      if (!payload) return next();
      const user = await loadUser(payload.sub);
      if (user && user.status !== 'SUSPENDED') req.user = user;
      next();
    } catch {
      // Optional authentication must never fail the request.
      next();
    }
  })();
};
