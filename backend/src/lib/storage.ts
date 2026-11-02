/**
 * Proposal file storage.
 *
 * Two drivers behind one interface, chosen once from `STORAGE_DRIVER`:
 *
 *  - **local** — the filesystem. Correct for development and for a host with a
 *    mounted persistent disk.
 *  - **s3** — any S3-compatible object store. Built for Cloudflare R2, which
 *    speaks the S3 API, but nothing here is R2-specific.
 *
 * ## Why this is not optional in production
 *
 * A container filesystem is ephemeral. On Render the disk is replaced on every
 * deploy and on every restart, so with the local driver an uploaded proposal
 * survives until the next push and then disappears — while its database row
 * remains, pointing at a file that no longer exists. The failure is delayed and
 * looks like corruption rather than misconfiguration, which is why env.ts
 * refuses `local` in production unless it is acknowledged explicitly.
 *
 * ## What is deliberately absent
 *
 * No presigned URLs, and no public bucket. A presigned URL is a bearer token in
 * a query string: it leaks through history, logs and referrers, and it cannot
 * be revoked before it expires. Proposals are private to one business, so the
 * bytes are fetched server-side and streamed through the authenticated,
 * ownership-checked download route instead. The bucket itself should permit no
 * public access.
 */
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { env } from '../config/env';
import { logger } from './logger';
import { ValidationError } from './errors';

/** A storage key as `validateUpload` mints them: 32 random bytes + extension. */
const STORAGE_KEY_PATTERN = /^[a-f0-9]{64}\.(pdf|docx)$/;

/**
 * Rejects anything that is not a key this application generated.
 *
 * Keys are produced internally, so this should never fire. It is the backstop
 * that stops a key arriving from anywhere else — a tampered database row, some
 * future code path — from becoming a path traversal on the local driver or an
 * arbitrary object read on S3.
 */
export function assertStorageKey(storageKey: string): void {
  if (!STORAGE_KEY_PATTERN.test(storageKey)) {
    throw new ValidationError('Invalid file reference.');
  }
}

export interface StorageDriver {
  readonly name: 'local' | 's3';
  put(storageKey: string, buffer: Buffer, contentType: string): Promise<void>;
  get(storageKey: string): Promise<Buffer>;
  remove(storageKey: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Local filesystem

/** Absolute storage root. */
function storageRoot(): string {
  return path.resolve(process.cwd(), env.STORAGE_LOCAL_DIR);
}

/**
 * Resolves a key to an absolute path, refusing anything outside the root.
 *
 * Exported because the integration tests assert on the bytes actually written.
 */
export function resolveStoragePath(storageKey: string): string {
  assertStorageKey(storageKey);

  const root = storageRoot();
  const resolved = path.resolve(root, storageKey);

  // `path.resolve` has already collapsed any `..`, so an inequality here means
  // the key tried to escape.
  if (resolved !== path.join(root, storageKey)) {
    logger.error({ storageKey }, 'storage path escaped the storage root');
    throw new ValidationError('Invalid file reference.');
  }
  return resolved;
}

const localDriver: StorageDriver = {
  name: 'local',

  async put(storageKey, buffer) {
    const target = resolveStoragePath(storageKey);
    await fs.mkdir(path.dirname(target), { recursive: true });
    // 0o600: readable only by the process owner, and nothing serves this
    // directory statically. 'wx' fails rather than overwriting, so a key
    // collision becomes an error instead of silent data loss.
    await fs.writeFile(target, buffer, { mode: 0o600, flag: 'wx' });
  },

  async get(storageKey) {
    return fs.readFile(resolveStoragePath(storageKey));
  },

  async remove(storageKey) {
    try {
      await fs.unlink(resolveStoragePath(storageKey));
    } catch (err) {
      // Already gone is success for a delete.
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    }
  },
};

// ---------------------------------------------------------------------------
// S3-compatible object storage

/**
 * Built on first use and then reused.
 *
 * Lazy because `@aws-sdk/client-s3` is a large module that a local deployment
 * must not pay to load. The `import()` sits inside the driver so a
 * configuration error surfaces at the first upload rather than at module load,
 * where it would take the whole process down.
 */
let s3ClientPromise: Promise<import('@aws-sdk/client-s3').S3Client> | null = null;

async function s3Client() {
  if (!s3ClientPromise) {
    s3ClientPromise = (async () => {
      const { S3Client } = await import('@aws-sdk/client-s3');
      return new S3Client({
        // R2 ignores the region but the SDK requires one; 'auto' is what
        // Cloudflare documents.
        region: env.S3_REGION,
        endpoint: env.S3_ENDPOINT,
        // R2 is virtual-host style by default. Path style stays available for
        // MinIO and other self-hosted stores.
        forcePathStyle: env.S3_FORCE_PATH_STYLE,
        credentials: {
          accessKeyId: env.S3_ACCESS_KEY_ID as string,
          secretAccessKey: env.S3_SECRET_ACCESS_KEY as string,
        },
      });
    })();
  }
  return s3ClientPromise;
}

const s3Driver: StorageDriver = {
  name: 's3',

  async put(storageKey, buffer, contentType) {
    assertStorageKey(storageKey);
    const client = await s3Client();
    const { PutObjectCommand } = await import('@aws-sdk/client-s3');

    await client.send(
      new PutObjectCommand({
        Bucket: env.S3_BUCKET as string,
        Key: storageKey,
        Body: buffer,
        ContentType: contentType,
        // Belt and braces with the download route's own header: even if an
        // object were somehow fetched directly, a browser must not render it.
        ContentDisposition: 'attachment',
      }),
    );
  },

  async get(storageKey) {
    assertStorageKey(storageKey);
    const client = await s3Client();
    const { GetObjectCommand } = await import('@aws-sdk/client-s3');

    const res = await client.send(
      new GetObjectCommand({ Bucket: env.S3_BUCKET as string, Key: storageKey }),
    );
    if (!res.Body) throw new Error('stored object returned no body');

    // Buffers the whole object. Uploads are capped at MAX_UPLOAD_BYTES (10MB by
    // default) so this is bounded; it would have to become a stream if that
    // limit ever grew substantially.
    return Buffer.from(await res.Body.transformToByteArray());
  },

  async remove(storageKey) {
    assertStorageKey(storageKey);
    const client = await s3Client();
    const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');

    // S3 delete is idempotent: removing a missing key succeeds, which is the
    // behaviour the local driver emulates above.
    await client.send(
      new DeleteObjectCommand({ Bucket: env.S3_BUCKET as string, Key: storageKey }),
    );
  },
};

// ---------------------------------------------------------------------------
// Selection

export const storage: StorageDriver = env.STORAGE_DRIVER === 's3' ? s3Driver : localDriver;

/**
 * Content type for a key, from its extension.
 *
 * Derived from the key rather than accepted from the caller, so a stored
 * object's type can never disagree with what its extension claims.
 */
export function contentTypeForKey(storageKey: string): string {
  assertStorageKey(storageKey);
  return storageKey.endsWith('.pdf')
    ? 'application/pdf'
    : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
}

/** Writes a validated upload. */
export async function writeFile(storageKey: string, buffer: Buffer): Promise<void> {
  await storage.put(storageKey, buffer, contentTypeForKey(storageKey));
}

/** Reads a stored file whole. */
export async function readFile(storageKey: string): Promise<Buffer> {
  return storage.get(storageKey);
}

/** Removes a stored file. Missing is success. */
export async function deleteFile(storageKey: string): Promise<void> {
  return storage.remove(storageKey);
}

/**
 * Checks stored bytes against the checksum recorded at upload.
 *
 * Not used on the download path — it would double the work on every request.
 * Exposed for an integrity sweep over stored proposals.
 */
export function checksumMatches(buffer: Buffer, expected: string): boolean {
  const actual = crypto.createHash('sha256').update(buffer).digest('hex');
  // Both sides are fixed-length hex, so a constant-time compare is meaningful
  // and cannot throw on a length mismatch.
  return (
    actual.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected))
  );
}
