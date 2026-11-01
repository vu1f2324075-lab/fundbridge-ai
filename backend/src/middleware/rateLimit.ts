/**
 * Rate limiting.
 *
 * Tiers reflect cost and risk rather than one global number (spec §25):
 * credential endpoints are limited tightly to blunt brute-force attempts, AI
 * and upload endpoints are limited because each call is expensive, and ordinary
 * reads get a generous allowance.
 *
 * Limiting is disabled under NODE_ENV=test so the suite is not throttled; the
 * limiter behaviour itself is covered by dedicated tests that enable it.
 */
import rateLimit, { type Options } from 'express-rate-limit';
import type { RequestHandler } from 'express';
import { env } from '../config/env';

const MINUTE = 60 * 1000;

function build(options: Partial<Options> & { windowMs: number; limit: number }): RequestHandler {
  if (env.isTest) return (_req, _res, next) => next();

  return rateLimit({
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    // Authenticated callers are bucketed per account, anonymous ones per IP, so
    // one user behind a shared NAT cannot exhaust everyone else's allowance.
    keyGenerator: (req) => req.user?.id ?? req.ip ?? 'unknown',
    handler: (_req, res) => {
      res.status(429).json({
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many requests. Please wait a moment and try again.',
          details: {},
        },
      });
    },
    ...options,
  });
}

/** Login and registration: 10 attempts per 15 minutes. */
export const authLimiter = build({
  windowMs: 15 * MINUTE,
  limit: 10,
  // Successful logins are not counted, so a legitimate user who signs in
  // repeatedly is never locked out.
  skipSuccessfulRequests: true,
});

/** Password change / reset: deliberately tighter than login. */
export const sensitiveLimiter = build({ windowMs: 60 * MINUTE, limit: 5 });

/** Analysis, matching recalculation, LLM calls — each is seconds of compute. */
export const aiLimiter = build({ windowMs: 10 * MINUTE, limit: 20 });

/** File uploads. */
export const uploadLimiter = build({ windowMs: 60 * MINUTE, limit: 30 });

/** Baseline for everything else. */
export const generalLimiter = build({ windowMs: MINUTE, limit: 300 });
