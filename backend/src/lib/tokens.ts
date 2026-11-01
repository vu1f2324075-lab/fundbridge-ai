/**
 * Session tokens.
 *
 * A short JWT carries identity only — id, role and a token version. Anything
 * authorisation-relevant beyond the role is re-read from the database on each
 * request, so suspending a user or changing their role takes effect
 * immediately rather than when their token happens to expire.
 */
import jwt, { type SignOptions } from 'jsonwebtoken';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { env } from '../config/env';
import type { Role } from '../../generated/prisma';

const ISSUER = 'fundbridge-ai';
const AUDIENCE = 'fundbridge-web';

export interface SessionTokenPayload {
  sub: string;
  role: Role;
}

export function signSessionToken(payload: SessionTokenPayload): string {
  return jwt.sign({ role: payload.role }, env.JWT_SECRET, {
    subject: payload.sub,
    issuer: ISSUER,
    audience: AUDIENCE,
    expiresIn: env.JWT_EXPIRES_IN,
    algorithm: 'HS256',
  } as SignOptions);
}

/** Returns null for any invalid, expired, or wrongly-signed token. Callers
 *  cannot accidentally treat a verification failure as success. */
export function verifySessionToken(token: string): SessionTokenPayload | null {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET, {
      issuer: ISSUER,
      audience: AUDIENCE,
      // Pinned: without this, a token with `"alg":"none"` could be accepted.
      algorithms: ['HS256'],
    });
    if (typeof decoded === 'string' || !decoded.sub) return null;
    const role = (decoded as jwt.JwtPayload).role;
    if (typeof role !== 'string') return null;
    return { sub: decoded.sub, role: role as Role };
  } catch {
    return null;
  }
}

/** Random CSRF token for the double-submit cookie pattern. */
export function generateCsrfToken(): string {
  return randomBytes(32).toString('hex');
}

/** Constant-time comparison, so a mismatch cannot be found byte by byte. */
export function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
