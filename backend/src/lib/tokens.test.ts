import { describe, it, expect } from 'vitest';
import jwt from 'jsonwebtoken';
import { signSessionToken, verifySessionToken, generateCsrfToken, safeCompare } from './tokens';

const SECRET = 'test-only-secret-at-least-32-characters-long';

describe('session tokens', () => {
  it('round-trips subject and role', () => {
    const token = signSessionToken({ sub: 'user_123', role: 'STARTUP' });
    expect(verifySessionToken(token)).toEqual({ sub: 'user_123', role: 'STARTUP' });
  });

  it('does not embed the email or any other profile data', () => {
    const token = signSessionToken({ sub: 'user_123', role: 'ADMIN' });
    const decoded = jwt.decode(token) as Record<string, unknown>;
    expect(Object.keys(decoded).sort()).toEqual(['aud', 'exp', 'iat', 'iss', 'role', 'sub']);
  });

  it('rejects a tampered payload', () => {
    const token = signSessionToken({ sub: 'user_123', role: 'STARTUP' });
    const [header, , signature] = token.split('.');
    const forgedPayload = Buffer.from(
      JSON.stringify({ sub: 'user_123', role: 'ADMIN', iss: 'fundbridge-ai', aud: 'fundbridge-web' }),
    ).toString('base64url');
    // Privilege escalation by rewriting the role must fail the signature check.
    expect(verifySessionToken(`${header}.${forgedPayload}.${signature}`)).toBeNull();
  });

  it('rejects a token signed with a different secret', () => {
    const foreign = jwt.sign({ role: 'ADMIN' }, 'some-other-secret-that-is-long-enough', {
      subject: 'user_123',
      issuer: 'fundbridge-ai',
      audience: 'fundbridge-web',
    });
    expect(verifySessionToken(foreign)).toBeNull();
  });

  it('rejects an unsigned "alg: none" token', () => {
    // The classic algorithm-confusion attack; blocked by pinning algorithms.
    const unsigned = jwt.sign({ role: 'ADMIN' }, '', {
      algorithm: 'none',
      subject: 'user_123',
      issuer: 'fundbridge-ai',
      audience: 'fundbridge-web',
    });
    expect(verifySessionToken(unsigned)).toBeNull();
  });

  it('rejects an expired token', () => {
    const expired = jwt.sign({ role: 'STARTUP' }, SECRET, {
      subject: 'user_123',
      issuer: 'fundbridge-ai',
      audience: 'fundbridge-web',
      expiresIn: '-1s',
    });
    expect(verifySessionToken(expired)).toBeNull();
  });

  it('rejects a token issued for a different audience', () => {
    const wrongAudience = jwt.sign({ role: 'STARTUP' }, SECRET, {
      subject: 'user_123',
      issuer: 'fundbridge-ai',
      audience: 'some-other-app',
    });
    expect(verifySessionToken(wrongAudience)).toBeNull();
  });

  it('rejects structurally invalid input', () => {
    for (const bad of ['', 'not.a.token', 'a.b', '....']) {
      expect(verifySessionToken(bad)).toBeNull();
    }
  });
});

describe('csrf tokens', () => {
  it('generates distinct 64-character hex tokens', () => {
    const a = generateCsrfToken();
    const b = generateCsrfToken();
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toBe(b);
  });
});

describe('safeCompare', () => {
  it('matches identical strings and rejects differing ones', () => {
    expect(safeCompare('abc123', 'abc123')).toBe(true);
    expect(safeCompare('abc123', 'abc124')).toBe(false);
  });

  it('returns false for length mismatches without throwing', () => {
    // timingSafeEqual requires equal lengths; the guard must handle it.
    expect(safeCompare('short', 'much-longer-value')).toBe(false);
    expect(safeCompare('', 'x')).toBe(false);
    expect(safeCompare('', '')).toBe(true);
  });
});
