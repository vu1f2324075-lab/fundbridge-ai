/**
 * Cookie attributes — one definition, used everywhere.
 *
 * Both the session cookie and the CSRF cookie previously repeated `secure`,
 * `sameSite` and `path` at their call sites, and the two `clearCookie` calls
 * repeated none of them. That is a drift hazard with a specific failure mode:
 * a cookie is removed by name, domain and path, so a `clearCookie` that omits
 * the domain the cookie was set with leaves the cookie in place and logout
 * silently does nothing.
 *
 * ## Why `sameSite` is configurable
 *
 * In development the API and the frontend share `localhost`, so `lax` works and
 * is the safer default. In production they usually do not. On Render they land
 * on `*.onrender.com` subdomains, and `onrender.com` is on the Public Suffix
 * List — which makes `fundbridge-web.onrender.com` and
 * `fundbridge-api.onrender.com` *different sites*, not sibling subdomains of
 * one. A `lax` cookie is therefore not sent on any API call from the frontend,
 * and the failure is quiet and confusing: login succeeds, sets the cookie, and
 * every request after it arrives unauthenticated.
 *
 * `none` is what makes a cross-site session cookie work, and it requires
 * `Secure`, which is why `COOKIE_SAMESITE=none` is rejected outside production
 * (see env.ts). It also switches off the CSRF protection that `lax` provides
 * for free, so the double-submit token in `middleware/csrf.ts` stops being
 * defence in depth and becomes the only thing standing between a cross-site
 * POST and a state change. That token is already mandatory on every unsafe
 * method, which is what makes `none` acceptable here rather than merely
 * convenient.
 *
 * Serving both from one origin (a proxy or a rewrite) is the better
 * arrangement where it is available: keep `lax` and nothing below matters.
 */
import type { CookieOptions } from 'express';
import { env } from './env';

export const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
export const CSRF_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * The attributes that form a cookie's identity.
 *
 * These must be identical when setting and when clearing, so they live in one
 * object that both paths spread.
 */
const identity: CookieOptions = {
  // Cross-site cookies are HTTPS-only by spec, so `none` forces `secure` on
  // regardless of NODE_ENV. Locally over http, `lax` keeps this false.
  secure: env.cookieSecure,
  sameSite: env.COOKIE_SAMESITE,
  path: '/',
  ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
};

/** Session token. Not readable by script — XSS must not be able to lift it. */
export const sessionCookieOptions: CookieOptions = {
  ...identity,
  httpOnly: true,
  maxAge: SESSION_MAX_AGE_MS,
};

/** CSRF token. Readable by design: the frontend has to echo it back. */
export const csrfCookieOptions: CookieOptions = {
  ...identity,
  httpOnly: false,
  maxAge: CSRF_MAX_AGE_MS,
};

/** Passed to `res.clearCookie`, so the attributes match what was set. */
export const clearCookieOptions: CookieOptions = { ...identity };
