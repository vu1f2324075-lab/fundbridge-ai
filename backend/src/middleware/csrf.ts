/**
 * CSRF protection — double-submit cookie.
 *
 * The session lives in an httpOnly cookie, which is what makes it safe from
 * XSS but also means the browser attaches it to cross-site requests. The
 * frontend runs on a different port from the API, so `SameSite` alone is not a
 * sufficient control here.
 *
 * On login the server sets a second, readable cookie holding a random token.
 * The frontend echoes it in `X-CSRF-Token`. An attacking page can cause the
 * browser to *send* cookies but cannot *read* them (same-origin policy), so it
 * cannot produce the matching header.
 *
 * Only state-changing methods are checked; GET/HEAD/OPTIONS are exempt, which
 * is why no GET endpoint in this API may mutate state.
 */
import type { RequestHandler } from 'express';
import type { Response } from 'express';
import { CsrfError } from '../lib/errors';
import { generateCsrfToken, safeCompare } from '../lib/tokens';
import { env } from '../config/env';

export const CSRF_COOKIE = 'fb_csrf';
export const CSRF_HEADER = 'x-csrf-token';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Readable by design — the frontend must be able to echo it back. */
export function issueCsrfCookie(res: Response): string {
  const token = generateCsrfToken();
  res.cookie(CSRF_COOKIE, token, {
    httpOnly: false,
    secure: env.isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
  return token;
}

export function clearCsrfCookie(res: Response): void {
  res.clearCookie(CSRF_COOKIE, { path: '/' });
}

/**
 * Routes that establish a session rather than acting on one.
 *
 * These are exempt unconditionally, not merely when no session cookie is
 * present. The difference matters: a user holding a stale `fb_session` cookie
 * whose `fb_csrf` cookie has gone (cleared separately, or expired at a
 * different time) would otherwise be unable to sign in at all — the session is
 * invalid so they land on the login page, but the login POST is treated as an
 * authenticated mutation and rejected. That is a lockout with a confusing
 * message and no way out except manually clearing cookies.
 *
 * Exempting them is safe because there is no existing state to protect: the
 * request's entire purpose is to replace whatever session is there. Brute-force
 * protection comes from the rate limiter mounted on these routes.
 */
const CSRF_EXEMPT_PATHS = new Set(['/api/auth/login', '/api/auth/register', '/api/auth/logout']);

export const verifyCsrf: RequestHandler = (req, _res, next) => {
  if (SAFE_METHODS.has(req.method)) return next();

  // Compared against the full mounted path, so a route elsewhere that merely
  // ends in /login cannot opt itself out.
  if (CSRF_EXEMPT_PATHS.has(req.originalUrl.split('?')[0] ?? '')) return next();

  const cookieToken = (req.cookies as Record<string, string> | undefined)?.[CSRF_COOKIE];
  const headerToken = req.header(CSRF_HEADER);

  // Any other mutation with no session cookie has no cross-site action to
  // forge either.
  const hasSession = Boolean((req.cookies as Record<string, string> | undefined)?.['fb_session']);
  if (!hasSession) return next();

  if (!cookieToken || !headerToken || !safeCompare(cookieToken, headerToken)) {
    return next(new CsrfError());
  }
  next();
};
