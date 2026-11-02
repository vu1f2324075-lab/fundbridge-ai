/**
 * Auth endpoints.
 *
 * The session cookie is httpOnly, so no handler here ever returns the token in
 * a response body — a token the page can read is a token XSS can steal.
 */
import type { Request, Response } from 'express';
import { sessionCookieOptions, clearCookieOptions } from '../config/cookies';
import { asyncHandler, ok, noContent } from '../lib/http';
import { signSessionToken } from '../lib/tokens';
import { SESSION_COOKIE } from '../middleware/authenticate';
import { issueCsrfCookie, clearCsrfCookie } from '../middleware/csrf';
import { UnauthenticatedError } from '../lib/errors';
import * as authService from '../services/auth.service';
import { recordAudit } from '../services/audit.service';
import type { Role } from '../../generated/prisma';

function setSessionCookie(res: Response, userId: string, role: Role): void {
  res.cookie(SESSION_COOKIE, signSessionToken({ sub: userId, role }), sessionCookieOptions);
}

export const register = asyncHandler(async (req: Request, res: Response) => {
  const user = await authService.registerUser(req.body);

  setSessionCookie(res, user.id, user.role);
  const csrfToken = issueCsrfCookie(res);

  await recordAudit({
    actorId: user.id,
    action: 'auth.register',
    entity: 'User',
    entityId: user.id,
    metadata: { role: user.role },
    ip: req.ip,
  });

  ok(res, { user, csrfToken }, 201);
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body as { email: string; password: string };

  try {
    const user = await authService.authenticateUser(email, password);

    setSessionCookie(res, user.id, user.role);
    const csrfToken = issueCsrfCookie(res);

    await recordAudit({
      actorId: user.id,
      action: 'auth.login',
      entity: 'User',
      entityId: user.id,
      ip: req.ip,
    });

    ok(res, { user, csrfToken });
  } catch (err) {
    // Failures are audited without the attempted password, and without an
    // actorId, since no session was established.
    await recordAudit({
      action: 'auth.login_failed',
      entity: 'User',
      metadata: { emailAttempted: email },
      ip: req.ip,
    });
    throw err;
  }
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.id;

  res.clearCookie(SESSION_COOKIE, clearCookieOptions);
  clearCsrfCookie(res);

  if (userId) {
    await recordAudit({ actorId: userId, action: 'auth.logout', entity: 'User', entityId: userId, ip: req.ip });
  }

  noContent(res);
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthenticatedError();
  const user = await authService.getUserById(req.user.id);
  if (!user) throw new UnauthenticatedError();
  ok(res, { user });
});

export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthenticatedError();
  const { currentPassword, newPassword } = req.body as { currentPassword: string; newPassword: string };

  await authService.changePassword(req.user.id, currentPassword, newPassword);

  // The session cookie is reissued so the new credentials take effect
  // immediately for this client.
  setSessionCookie(res, req.user.id, req.user.role);

  await recordAudit({
    actorId: req.user.id,
    action: 'auth.password_changed',
    entity: 'User',
    entityId: req.user.id,
    ip: req.ip,
  });

  noContent(res);
});
