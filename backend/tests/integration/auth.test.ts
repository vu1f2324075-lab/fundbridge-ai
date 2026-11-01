/**
 * Authentication and authorisation — integration tests against a real database.
 *
 * These cover what the unit tests cannot: that a registration actually persists
 * a user and their profile together, that a session cookie issued by login is
 * accepted on the next request, and that the authorisation guards hold when the
 * rows genuinely exist.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../src/app';
import { prisma, resetDatabase, disconnect } from '../helpers/db';
import { CSRF_COOKIE } from '../../src/middleware/csrf';
import { SESSION_COOKIE } from '../../src/middleware/authenticate';

let app: Express;

const STARTUP = {
  name: 'Rahul Sharma',
  email: 'owner@buildtech.test',
  password: 'a-reasonably-long-passphrase',
  role: 'STARTUP' as const,
  businessName: 'BuildTech Solutions',
};

const INVESTOR = {
  name: 'Alpha Ventures Team',
  email: 'team@alpha.test',
  password: 'a-reasonably-long-passphrase',
  role: 'INVESTOR' as const,
  investorName: 'Alpha Ventures',
};

/** Pulls one cookie's value out of a Set-Cookie header array. */
function cookieValue(setCookie: string[] | undefined, name: string): string | undefined {
  const entry = setCookie?.find((c) => c.startsWith(`${name}=`));
  return entry?.split(';')[0]?.split('=')[1];
}

function cookieAttributes(setCookie: string[] | undefined, name: string): string {
  return setCookie?.find((c) => c.startsWith(`${name}=`)) ?? '';
}

beforeAll(() => {
  app = createApp();
});

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await disconnect();
});

describe('registration', () => {
  it('persists the user and their business profile in one transaction', async () => {
    const res = await request(app).post('/api/auth/register').send(STARTUP);

    expect(res.status).toBe(201);
    expect(res.body.data.user).toMatchObject({
      email: 'owner@buildtech.test',
      role: 'STARTUP',
      name: 'Rahul Sharma',
    });
    expect(res.body.data.user.businessProfileId).toBeTruthy();

    const stored = await prisma.user.findUnique({
      where: { email: 'owner@buildtech.test' },
      include: { businessProfile: true },
    });
    expect(stored?.businessProfile?.businessName).toBe('BuildTech Solutions');
    expect(stored?.businessProfile?.sourceType).toBe('USER');
  });

  it('never returns the password hash', async () => {
    const res = await request(app).post('/api/auth/register').send(STARTUP);
    expect(JSON.stringify(res.body)).not.toContain('$2a$');
    expect(res.body.data.user.passwordHash).toBeUndefined();
  });

  it('stores a bcrypt hash rather than the plaintext password', async () => {
    await request(app).post('/api/auth/register').send(STARTUP);
    const stored = await prisma.user.findUnique({ where: { email: 'owner@buildtech.test' } });
    expect(stored?.passwordHash).toMatch(/^\$2[aby]\$12\$/);
    expect(stored?.passwordHash).not.toContain('passphrase');
  });

  it('issues an httpOnly session cookie and a readable CSRF cookie', async () => {
    const res = await request(app).post('/api/auth/register').send(STARTUP);
    const setCookie = res.headers['set-cookie'] as unknown as string[];

    // The session must be unreadable to page scripts; the CSRF token must be
    // readable so the frontend can echo it.
    expect(cookieAttributes(setCookie, SESSION_COOKIE)).toMatch(/HttpOnly/i);
    expect(cookieAttributes(setCookie, CSRF_COOKIE)).not.toMatch(/HttpOnly/i);
    expect(cookieAttributes(setCookie, SESSION_COOKIE)).toMatch(/SameSite=Lax/i);
  });

  it('does not return the session token in the response body', async () => {
    const res = await request(app).post('/api/auth/register').send(STARTUP);
    // A token the page can read is a token XSS can steal.
    expect(res.body.data.token).toBeUndefined();
    expect(res.body.data.accessToken).toBeUndefined();
  });

  it('rejects a duplicate email', async () => {
    await request(app).post('/api/auth/register').send(STARTUP);
    const res = await request(app).post('/api/auth/register').send(STARTUP);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
    expect(await prisma.user.count()).toBe(1);
  });

  it('treats email case-insensitively when detecting duplicates', async () => {
    await request(app).post('/api/auth/register').send(STARTUP);
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...STARTUP, email: 'Owner@BuildTech.TEST' });

    expect(res.status).toBe(409);
    expect(await prisma.user.count()).toBe(1);
  });

  it('creates an investor profile for an INVESTOR registration', async () => {
    const res = await request(app).post('/api/auth/register').send(INVESTOR);

    expect(res.status).toBe(201);
    expect(res.body.data.user.investorProfileId).toBeTruthy();

    const stored = await prisma.investorProfile.findFirst({ where: { investorName: 'Alpha Ventures' } });
    // A self-registered investor starts unverified.
    expect(stored?.verification).toBe('UNVERIFIED');
    expect(stored?.sourceType).toBe('USER');
  });

  it('writes an audit entry', async () => {
    await request(app).post('/api/auth/register').send(STARTUP);
    const entry = await prisma.auditLog.findFirst({ where: { action: 'auth.register' } });
    expect(entry).toBeTruthy();
    // Audit metadata must never carry the password.
    expect(JSON.stringify(entry?.metadata)).not.toContain('passphrase');
  });
});

describe('login', () => {
  beforeEach(async () => {
    await request(app).post('/api/auth/register').send(STARTUP);
  });

  it('accepts correct credentials and records the login time', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: STARTUP.email, password: STARTUP.password });

    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe(STARTUP.email);

    const stored = await prisma.user.findUnique({ where: { email: STARTUP.email } });
    expect(stored?.lastLoginAt).toBeInstanceOf(Date);
  });

  it('is case-insensitive on the email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'OWNER@BUILDTECH.TEST', password: STARTUP.password });
    expect(res.status).toBe(200);
  });

  it('rejects a wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: STARTUP.email, password: 'not-the-right-passphrase' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('returns an identical error for an unknown email, so accounts cannot be enumerated', async () => {
    const unknown = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@nowhere.test', password: 'not-the-right-passphrase' });
    const wrongPassword = await request(app)
      .post('/api/auth/login')
      .send({ email: STARTUP.email, password: 'not-the-right-passphrase' });

    expect(unknown.status).toBe(wrongPassword.status);
    expect(unknown.body.error.code).toBe(wrongPassword.body.error.code);
    expect(unknown.body.error.message).toBe(wrongPassword.body.error.message);
  });

  it('audits a failed attempt without storing the attempted password', async () => {
    await request(app).post('/api/auth/login').send({ email: STARTUP.email, password: 'wrong-passphrase-here' });

    const entry = await prisma.auditLog.findFirst({ where: { action: 'auth.login_failed' } });
    expect(entry).toBeTruthy();
    expect(JSON.stringify(entry?.metadata)).not.toContain('wrong-passphrase-here');
  });

  it('refuses a suspended account', async () => {
    await prisma.user.update({ where: { email: STARTUP.email }, data: { status: 'SUSPENDED' } });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: STARTUP.email, password: STARTUP.password });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});

describe('session', () => {
  let session: string;
  let csrf: string;

  beforeEach(async () => {
    const res = await request(app).post('/api/auth/register').send(STARTUP);
    const setCookie = res.headers['set-cookie'] as unknown as string[];
    session = cookieValue(setCookie, SESSION_COOKIE) ?? '';
    csrf = cookieValue(setCookie, CSRF_COOKIE) ?? '';
    expect(session).toBeTruthy();
  });

  it('authenticates /api/auth/me with the issued cookie', async () => {
    const res = await request(app).get('/api/auth/me').set('Cookie', `${SESSION_COOKIE}=${session}`);

    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe(STARTUP.email);
    expect(res.body.data.user.businessProfileId).toBeTruthy();
  });

  it('stops accepting the session once the user is deleted', async () => {
    await prisma.user.delete({ where: { email: STARTUP.email } });

    // The JWT is still cryptographically valid; the per-request database read
    // is what invalidates it.
    const res = await request(app).get('/api/auth/me').set('Cookie', `${SESSION_COOKIE}=${session}`);
    expect(res.status).toBe(401);
  });

  it('rejects a still-valid token as soon as the account is suspended', async () => {
    await prisma.user.update({ where: { email: STARTUP.email }, data: { status: 'SUSPENDED' } });

    const res = await request(app).get('/api/auth/me').set('Cookie', `${SESSION_COOKIE}=${session}`);
    expect(res.status).toBe(403);
  });

  it('clears both cookies on logout', async () => {
    const res = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', `${SESSION_COOKIE}=${session}; ${CSRF_COOKIE}=${csrf}`)
      .set('X-CSRF-Token', csrf);

    expect(res.status).toBe(204);
    const setCookie = (res.headers['set-cookie'] as unknown as string[]) ?? [];
    expect(setCookie.some((c) => c.startsWith(`${SESSION_COOKIE}=;`))).toBe(true);
    expect(setCookie.some((c) => c.startsWith(`${CSRF_COOKIE}=;`))).toBe(true);
  });
});

describe('password change', () => {
  let session: string;
  let csrf: string;

  beforeEach(async () => {
    const res = await request(app).post('/api/auth/register').send(STARTUP);
    const setCookie = res.headers['set-cookie'] as unknown as string[];
    session = cookieValue(setCookie, SESSION_COOKIE) ?? '';
    csrf = cookieValue(setCookie, CSRF_COOKIE) ?? '';
  });

  it('changes the password when the current one is correct', async () => {
    const res = await request(app)
      .post('/api/auth/password')
      .set('Cookie', `${SESSION_COOKIE}=${session}; ${CSRF_COOKIE}=${csrf}`)
      .set('X-CSRF-Token', csrf)
      .send({ currentPassword: STARTUP.password, newPassword: 'an-entirely-new-passphrase' });

    expect(res.status).toBe(204);

    const oldLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: STARTUP.email, password: STARTUP.password });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: STARTUP.email, password: 'an-entirely-new-passphrase' });
    expect(newLogin.status).toBe(200);
  });

  it('refuses when the current password is wrong', async () => {
    const res = await request(app)
      .post('/api/auth/password')
      .set('Cookie', `${SESSION_COOKIE}=${session}; ${CSRF_COOKIE}=${csrf}`)
      .set('X-CSRF-Token', csrf)
      .send({ currentPassword: 'not-my-password', newPassword: 'an-entirely-new-passphrase' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('is blocked without the CSRF header even with a valid session', async () => {
    const res = await request(app)
      .post('/api/auth/password')
      .set('Cookie', `${SESSION_COOKIE}=${session}; ${CSRF_COOKIE}=${csrf}`)
      .send({ currentPassword: STARTUP.password, newPassword: 'an-entirely-new-passphrase' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CSRF_FAILED');

    // And the password must be unchanged.
    const stillWorks = await request(app)
      .post('/api/auth/login')
      .send({ email: STARTUP.email, password: STARTUP.password });
    expect(stillWorks.status).toBe(200);
  });
});

describe('role separation', () => {
  it('gives a startup no investor profile and an investor no business profile', async () => {
    const startup = await request(app).post('/api/auth/register').send(STARTUP);
    const investor = await request(app).post('/api/auth/register').send(INVESTOR);

    expect(startup.body.data.user.businessProfileId).toBeTruthy();
    expect(startup.body.data.user.investorProfileId).toBeUndefined();

    expect(investor.body.data.user.investorProfileId).toBeTruthy();
    expect(investor.body.data.user.businessProfileId).toBeUndefined();
  });

  it('cannot be escalated to ADMIN through the registration endpoint', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ ...STARTUP, role: 'ADMIN' });

    expect(await prisma.user.count({ where: { role: 'ADMIN' } })).toBe(0);
  });
});
