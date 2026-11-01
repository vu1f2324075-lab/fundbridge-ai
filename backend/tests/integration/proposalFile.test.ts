/**
 * Proposal file storage and retrieval — integration tests against a real
 * database and a real filesystem.
 *
 * The AI service is deliberately unconfigured in the test environment
 * (`AI_SERVICE_URL: ''`), so extraction cannot succeed here. That is the point:
 * these tests cover the part of the pipeline that must hold whether or not the
 * AI service is reachable — the bytes are stored, a row describes them, and the
 * file comes back to its owner and to nobody else.
 *
 * The properties under test are the ones a reviewer would challenge:
 *
 *  - an upload whose analysis failed is still a stored, retrievable file;
 *  - `storageKey` never appears in a response body;
 *  - another business's owner gets 404, not 403 — a 403 would confirm that the
 *    id exists, which is an existence oracle;
 *  - the download is always `attachment`, never inline.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../src/app';
import { prisma, resetDatabase, disconnect } from '../helpers/db';
import { env } from '../../src/config/env';

let app: Express;

const OWNER = {
  name: 'Rahul Sharma',
  email: 'owner@buildtech.test',
  password: 'a-reasonably-long-passphrase',
  role: 'STARTUP' as const,
  businessName: 'BuildTech Solutions',
};

const OTHER_OWNER = {
  name: 'Priya Nair',
  email: 'owner@othercorp.test',
  password: 'a-reasonably-long-passphrase',
  role: 'STARTUP' as const,
  businessName: 'OtherCorp Industries',
};

/**
 * The smallest structurally valid PDF.
 *
 * Built here rather than read from a fixture so the test does not depend on a
 * binary file in the repository, and so the exact bytes are visible to anyone
 * reading the assertions about them.
 */
function minimalPdf(marker: string): Buffer {
  return Buffer.from(
    `%PDF-1.4\n` +
      `1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n` +
      `2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n` +
      `3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\n` +
      `% ${marker}\n` +
      `trailer<</Root 1 0 R>>\n%%EOF\n`,
    'ascii',
  );
}

interface Session {
  cookies: string[];
  csrf: string;
}

/** Registers an account and returns everything later requests need. */
async function registerAndSignIn(account: typeof OWNER): Promise<Session> {
  const res = await request(app).post('/api/auth/register').send(account);
  expect(res.status).toBe(201);

  const setCookie = res.headers['set-cookie'] as unknown as string[] | undefined;
  const cookies = (setCookie ?? []).map((c) => c.split(';')[0] as string);
  const csrf = (res.body as { data: { csrfToken: string } }).data.csrfToken;
  return { cookies, csrf };
}

function upload(session: Session, bytes: Buffer, filename: string) {
  return request(app)
    .post('/api/proposals/upload')
    .set('Cookie', session.cookies)
    .set('X-CSRF-Token', session.csrf)
    .attach('file', bytes, { filename, contentType: 'application/pdf' });
}

beforeAll(() => {
  app = createApp();
});

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  // Removes the files these tests wrote. The directory is test-only — see
  // STORAGE_LOCAL_DIR in tests/vitest.env.ts — so clearing it is safe.
  await fs
    .rm(path.resolve(process.cwd(), env.STORAGE_LOCAL_DIR), { recursive: true, force: true })
    .catch(() => undefined);
  await disconnect();
});

describe('storing an uploaded proposal', () => {
  it('stores the file and records it even though analysis cannot run', async () => {
    const session = await registerAndSignIn(OWNER);
    const bytes = minimalPdf('stored-anyway');

    const res = await upload(session, bytes, 'business-plan.pdf');

    // 201, not an error: the file WAS stored. Reporting a failure here would
    // tell the user their upload was lost when it was not.
    expect(res.status).toBe(201);
    expect(res.body.data.proposal.status).toBe('EXTRACTION_FAILED');

    const row = await prisma.proposal.findFirstOrThrow({
      select: { originalName: true, fileType: true, fileSize: true, checksum: true, storageKey: true },
    });
    expect(row.originalName).toBe('business-plan.pdf');
    expect(row.fileType).toBe('pdf');
    expect(row.fileSize).toBe(bytes.length);
    expect(row.checksum).toMatch(/^[a-f0-9]{64}$/);

    // The bytes on disk are the bytes that arrived.
    const onDisk = await fs.readFile(
      path.resolve(process.cwd(), env.STORAGE_LOCAL_DIR, row.storageKey),
    );
    expect(onDisk.equals(bytes)).toBe(true);
  });

  it('refuses a second upload of identical bytes', async () => {
    const session = await registerAndSignIn(OWNER);
    const bytes = minimalPdf('duplicate');

    expect((await upload(session, bytes, 'plan.pdf')).status).toBe(201);

    const second = await upload(session, bytes, 'plan-copy.pdf');
    expect(second.status).toBe(400);
    expect(await prisma.proposal.count()).toBe(1);
  });

  it('rejects a file whose contents are not what its extension claims', async () => {
    const session = await registerAndSignIn(OWNER);
    const notAPdf = Buffer.from('MZ\x90\x00 this is an executable, not a document', 'latin1');

    const res = await request(app)
      .post('/api/proposals/upload')
      .set('Cookie', session.cookies)
      .set('X-CSRF-Token', session.csrf)
      .attach('file', notAPdf, { filename: 'plan.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(415);
    expect(await prisma.proposal.count()).toBe(0);
  });
});

describe('the file reference in API responses', () => {
  it('returns a downloadUrl built from the proposal id', async () => {
    const session = await registerAndSignIn(OWNER);
    await upload(session, minimalPdf('url'), 'plan.pdf');

    const list = await request(app).get('/api/proposals').set('Cookie', session.cookies);
    expect(list.status).toBe(200);

    const proposal = list.body.data.proposals[0];
    expect(proposal.downloadUrl).toBe(`/api/proposals/${proposal.id}/download`);

    const detail = await request(app)
      .get(`/api/proposals/${proposal.id}`)
      .set('Cookie', session.cookies);
    expect(detail.body.data.proposal.downloadUrl).toBe(proposal.downloadUrl);
  });

  it('never exposes the storage key', async () => {
    const session = await registerAndSignIn(OWNER);
    await upload(session, minimalPdf('no-key'), 'plan.pdf');

    const { storageKey } = await prisma.proposal.findFirstOrThrow({ select: { storageKey: true } });

    const list = await request(app).get('/api/proposals').set('Cookie', session.cookies);
    const id = list.body.data.proposals[0].id as string;
    const detail = await request(app).get(`/api/proposals/${id}`).set('Cookie', session.cookies);

    // Serialised whole, so a key nested anywhere in the payload still fails.
    expect(JSON.stringify(list.body)).not.toContain(storageKey);
    expect(JSON.stringify(detail.body)).not.toContain(storageKey);
    expect(JSON.stringify(list.body)).not.toContain('storageKey');
  });
});

describe('downloading a stored proposal', () => {
  it('returns the exact bytes to the owner, as an attachment', async () => {
    const session = await registerAndSignIn(OWNER);
    const bytes = minimalPdf('exact-bytes');
    await upload(session, bytes, 'plan.pdf');

    const list = await request(app).get('/api/proposals').set('Cookie', session.cookies);
    const id = list.body.data.proposals[0].id as string;

    const res = await request(app)
      .get(`/api/proposals/${id}/download`)
      .set('Cookie', session.cookies);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    expect(Buffer.from(res.body as Buffer).equals(bytes)).toBe(true);

    // Always an attachment. Serving an uploaded file inline is what turns a
    // stored-file endpoint into a stored-XSS vector, so this must not drift.
    expect(res.headers['content-disposition']).toMatch(/^attachment;/);
    expect(res.headers['content-disposition']).toContain('plan.pdf');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['cache-control']).toContain('no-store');
  });

  it('rejects an unauthenticated download', async () => {
    const session = await registerAndSignIn(OWNER);
    await upload(session, minimalPdf('anon'), 'plan.pdf');
    const list = await request(app).get('/api/proposals').set('Cookie', session.cookies);
    const id = list.body.data.proposals[0].id as string;

    const res = await request(app).get(`/api/proposals/${id}/download`);
    expect(res.status).toBe(401);
  });

  it('gives another business 404 rather than 403, so the id is not confirmed', async () => {
    const owner = await registerAndSignIn(OWNER);
    await upload(owner, minimalPdf('tenancy'), 'plan.pdf');
    const list = await request(app).get('/api/proposals').set('Cookie', owner.cookies);
    const id = list.body.data.proposals[0].id as string;

    const stranger = await registerAndSignIn(OTHER_OWNER);

    const download = await request(app)
      .get(`/api/proposals/${id}/download`)
      .set('Cookie', stranger.cookies);
    const detail = await request(app)
      .get(`/api/proposals/${id}`)
      .set('Cookie', stranger.cookies);

    expect(download.status).toBe(404);
    expect(detail.status).toBe(404);

    // And the stranger's own list is unaffected by the other business's upload.
    const strangerList = await request(app).get('/api/proposals').set('Cookie', stranger.cookies);
    expect(strangerList.body.data.proposals).toHaveLength(0);
  });

  it('404s an id that does not exist at all', async () => {
    const session = await registerAndSignIn(OWNER);
    const res = await request(app)
      .get('/api/proposals/clw0000000000000000000000/download')
      .set('Cookie', session.cookies);
    expect(res.status).toBe(404);
  });
});
