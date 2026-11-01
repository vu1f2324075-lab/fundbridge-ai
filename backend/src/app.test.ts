/**
 * Middleware-stack tests.
 *
 * These drive the real Express app over HTTP with Supertest but deliberately
 * exercise only paths that short-circuit before any database call, so they run
 * without a live PostgreSQL instance. Route behaviour that needs the database
 * is covered by the integration suite.
 */
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from './app';

const app = createApp();

describe('health', () => {
  it('reports ok and leaks no version or dependency detail', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: { status: 'ok' } });
  });
});

describe('security headers', () => {
  it('sets a restrictive CSP and removes the framework fingerprint', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['content-security-policy']).toContain("default-src 'none'");
    expect(res.headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['referrer-policy']).toBe('no-referrer');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('returns a correlation id on every response', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-request-id']).toMatch(/^[\w-]{1,64}$/);
  });

  it('reflects a well-formed inbound request id but rejects a malformed one', async () => {
    const good = await request(app).get('/api/health').set('X-Request-Id', 'trace-abc-123');
    expect(good.headers['x-request-id']).toBe('trace-abc-123');

    // Header injection attempt must not be echoed back verbatim.
    const bad = await request(app).get('/api/health').set('X-Request-Id', 'bad value;with=junk');
    expect(bad.headers['x-request-id']).not.toBe('bad value;with=junk');
  });
});

describe('CORS', () => {
  it('allows the configured origin with credentials', async () => {
    const res = await request(app).get('/api/health').set('Origin', 'http://localhost:5173');
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  it('does not grant access to an unlisted origin', async () => {
    const res = await request(app).get('/api/health').set('Origin', 'https://evil.example');
    // The browser-enforced control is the absence of this header.
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('never reflects a wildcard origin', async () => {
    const res = await request(app).get('/api/health').set('Origin', 'http://localhost:5173');
    expect(res.headers['access-control-allow-origin']).not.toBe('*');
  });
});

describe('error envelope', () => {
  it('returns the documented shape for an unknown route', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error).toMatchObject({ code: 'NOT_FOUND' });
    expect(res.body.error.message).toContain('was not found');
    expect(res.body.error.requestId).toBeTruthy();
  });

  it('does not expose a stack trace or internal paths for an expected error', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expect(res.body.error.stack).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain('node_modules');
  });
});

describe('authentication guard', () => {
  it('rejects /api/auth/me without a session, before touching the database', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('rejects a forged session cookie', async () => {
    const res = await request(app).get('/api/auth/me').set('Cookie', 'fb_session=not.a.real.token');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });
});

describe('request validation', () => {
  it('rejects a self-assigned ADMIN role at registration', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Mallory',
      email: 'mallory@evil.example',
      password: 'a-reasonably-long-passphrase',
      role: 'ADMIN',
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.fields).toHaveProperty('role');
  });

  it('rejects unexpected fields rather than silently dropping them', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Mallory',
      email: 'mallory@evil.example',
      password: 'a-reasonably-long-passphrase',
      role: 'STARTUP',
      businessName: 'Evil Corp',
      passwordHash: 'injected-hash-value',
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('reports one message per invalid field', async () => {
    const res = await request(app).post('/api/auth/register').send({ name: 'x', email: 'nope', password: 'short' });
    expect(res.status).toBe(400);
    const fields = res.body.error.details.fields as Record<string, string>;
    expect(Object.keys(fields).sort()).toEqual(['email', 'name', 'password', 'role']);
  });
});

describe('body size limit', () => {
  it('refuses an oversized JSON body', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ email: 'a@b.com', password: 'x'.repeat(400_000) }));
    expect(res.status).toBe(413);
  });

  it('reports malformed JSON as a client error, not a server error', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email": "a@b.com", "password":');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('CSRF protection', () => {
  it('rejects a state-changing request that carries a session cookie but no matching header', async () => {
    const res = await request(app)
      .post('/api/auth/password')
      .set('Cookie', 'fb_session=some.session.value; fb_csrf=abc123')
      .send({ currentPassword: 'old-passphrase', newPassword: 'new-long-passphrase' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CSRF_FAILED');
  });

  it('rejects a mismatched double-submit token', async () => {
    const res = await request(app)
      .post('/api/auth/password')
      .set('Cookie', 'fb_session=some.session.value; fb_csrf=abc123')
      .set('X-CSRF-Token', 'different-value')
      .send({ currentPassword: 'old-passphrase', newPassword: 'new-long-passphrase' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CSRF_FAILED');
  });

  it('does not require a CSRF token for anonymous mutations such as login', async () => {
    // No session cookie means there is no cross-site request to forge; these
    // routes are protected by rate limiting instead.
    const res = await request(app).post('/api/auth/login').send({ email: 'nobody@example.com', password: '' });
    // Reaches validation rather than being blocked by CSRF.
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('allows safe methods without a token', async () => {
    const res = await request(app).get('/api/health').set('Cookie', 'fb_session=x; fb_csrf=y');
    expect(res.status).toBe(200);
  });
});

describe('CSRF exemption for session entry points', () => {
  /**
   * Regression: a user holding a stale session cookie with no matching CSRF
   * cookie must still be able to sign in. Before this, the login POST was
   * treated as an authenticated mutation and rejected, locking the user out with
   * no recourse but clearing cookies by hand.
   */
  it('allows login while a stale session cookie is present and the CSRF cookie is gone', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Cookie', 'fb_session=stale.invalid.token')
      .send({ email: 'someone@example.test', password: 'a-reasonably-long-passphrase' });

    // Reaches authentication rather than being blocked by CSRF.
    expect(res.status).not.toBe(403);
    expect(res.body.error?.code).not.toBe('CSRF_FAILED');
  });

  it('allows registration under the same conditions', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .set('Cookie', 'fb_session=stale.invalid.token')
      .send({ name: 'x', email: 'bad', password: 'short' });

    // Reaches validation, not CSRF.
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('allows logout so a stuck session can always be cleared', async () => {
    const res = await request(app).post('/api/auth/logout').set('Cookie', 'fb_session=stale.invalid.token');
    expect(res.status).toBe(204);
  });

  it('still enforces CSRF on every other authenticated mutation', async () => {
    const res = await request(app)
      .post('/api/auth/password')
      .set('Cookie', 'fb_session=some.session.value; fb_csrf=abc123')
      .send({ currentPassword: 'old-passphrase', newPassword: 'new-long-passphrase' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CSRF_FAILED');
  });
});
