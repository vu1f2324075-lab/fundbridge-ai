/**
 * Secure file upload.
 *
 * Uploaded proposals are untrusted input and are treated as hostile:
 *
 *  - **Memory, not disk, first.** Multer buffers in memory so nothing is
 *    written until the content has been validated. A disk-first pipeline writes
 *    the attacker's bytes before deciding whether to keep them.
 *  - **Magic bytes decide the type.** The extension and the browser-supplied
 *    MIME type are both attacker-controlled. A renamed executable is rejected
 *    on content, not on its name.
 *  - **The original filename never reaches the filesystem.** Storage names are
 *    random hex, so path traversal, reserved Windows device names, null bytes
 *    and overlong names are all structurally impossible.
 *  - **Storage lives outside any static directory.** Files are served only
 *    through an authenticated, ownership-checked route, so nothing is reachable
 *    by URL guessing.
 */
import crypto from 'node:crypto';
import path from 'node:path';
import multer from 'multer';
import { env } from '../config/env';
import { logger } from './logger';
import { PayloadTooLargeError, UnsupportedMediaTypeError, ValidationError } from './errors';

export const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

export const ALLOWED_EXTENSIONS = new Set(['.pdf', '.docx']);

/** Content signatures. A DOCX is a ZIP container, so it shares ZIP magic. */
const PDF_MAGIC = Buffer.from('%PDF-', 'ascii');
const ZIP_MAGICS = [
  Buffer.from([0x50, 0x4b, 0x03, 0x04]),
  Buffer.from([0x50, 0x4b, 0x05, 0x06]),
  Buffer.from([0x50, 0x4b, 0x07, 0x08]),
];

export type DetectedKind = 'pdf' | 'docx' | null;

/** Identifies a file from its leading bytes, ignoring its declared type. */
export function sniffKind(buffer: Buffer): DetectedKind {
  if (buffer.length < 4) return null;
  if (buffer.subarray(0, PDF_MAGIC.length).equals(PDF_MAGIC)) return 'pdf';
  if (ZIP_MAGICS.some((magic) => buffer.subarray(0, magic.length).equals(magic))) return 'docx';
  return null;
}

/**
 * A DOCX must contain this entry. Checked so a plain ZIP — or a ZIP full of
 * executables — cannot pass as a Word document on magic bytes alone.
 */
export function looksLikeDocx(buffer: Buffer): boolean {
  // Scanning the first 64KB is enough: the entry name appears in the local file
  // header, near the start of a real DOCX.
  const head = buffer.subarray(0, Math.min(buffer.length, 65_536)).toString('latin1');
  return head.includes('[Content_Types].xml') || head.includes('word/document.xml');
}

/**
 * Multer instance for a single proposal file.
 *
 * The limits block an attack before any handler runs: `files: 1` prevents a
 * multi-file flood, and `fields`/`parts` bound the multipart parser itself.
 */
export const proposalUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: env.MAX_UPLOAD_BYTES,
    files: 1,
    fields: 5,
    parts: 10,
    headerPairs: 50,
  },
  fileFilter: (_req, file, callback) => {
    // A cheap pre-filter only. The authoritative check is on content, after the
    // bytes have arrived.
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      callback(new UnsupportedMediaTypeError('Only PDF and Word (.docx) files can be uploaded.'));
      return;
    }
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      callback(new UnsupportedMediaTypeError('Only PDF and Word (.docx) files can be uploaded.'));
      return;
    }
    callback(null, true);
  },
}).single('file');

export interface ValidatedUpload {
  kind: 'pdf' | 'docx';
  mimeType: string;
  /** Random storage name. Never derived from user input. */
  storageKey: string;
  /** Sanitised original name, for display only. */
  displayName: string;
  size: number;
  checksum: string;
}

/** Strips everything that could be dangerous, keeping a readable label. */
export function sanitiseDisplayName(original: string): string {
  const base = path.basename(original || 'proposal');
  const cleaned = base
    // Control characters including the null byte used to truncate paths.
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[^\w.\- ]/g, '_')
    .replace(/\s+/g, ' ')
    .trim();

  const safe = cleaned.length > 0 ? cleaned : 'proposal';
  return safe.length > 160 ? safe.slice(0, 160) : safe;
}

/**
 * Validates an uploaded buffer and produces its storage identity.
 *
 * Throws rather than returning a flag, so a caller cannot forget to check.
 */
export function validateUpload(file: Express.Multer.File): ValidatedUpload {
  if (!file.buffer || file.buffer.length === 0) {
    throw new ValidationError('The uploaded file is empty.');
  }
  if (file.buffer.length > env.MAX_UPLOAD_BYTES) {
    throw new PayloadTooLargeError('The uploaded file is larger than the allowed limit.');
  }

  const kind = sniffKind(file.buffer);
  if (kind === null) {
    // The content is neither a PDF nor a ZIP, whatever the name claimed.
    throw new UnsupportedMediaTypeError(
      'That file is not a readable PDF or Word document. Check the file and try again.',
    );
  }

  if (kind === 'docx' && !looksLikeDocx(file.buffer)) {
    throw new UnsupportedMediaTypeError(
      'That file is a ZIP archive but not a Word document. Upload a .docx or PDF file.',
    );
  }

  // Cross-check the declared type against the content. A mismatch is reported
  // as unsupported rather than silently trusted either way.
  const declaredExt = path.extname(file.originalname || '').toLowerCase();
  const expectedExt = kind === 'pdf' ? '.pdf' : '.docx';
  if (declaredExt !== expectedExt) {
    logger.warn(
      { declaredExt, detected: kind },
      'upload extension did not match detected content type',
    );
    throw new UnsupportedMediaTypeError(
      'The file contents do not match its extension. Upload the original PDF or Word file.',
    );
  }

  return {
    kind,
    mimeType: kind === 'pdf' ? 'application/pdf' : ALLOWED_MIME_TYPES.values().next().value!,
    // 32 random bytes: unguessable, and no part of it comes from user input.
    storageKey: `${crypto.randomBytes(32).toString('hex')}${expectedExt}`,
    displayName: sanitiseDisplayName(file.originalname),
    size: file.buffer.length,
    // Lets a duplicate upload be recognised, and detects storage corruption.
    checksum: crypto.createHash('sha256').update(file.buffer).digest('hex'),
  };
}

/**
 * Translates multer's own errors into application errors.
 *
 * Without this a size-limit rejection surfaces as an opaque 500 instead of a
 * 413 the user can understand.
 */
export function translateMulterError(err: unknown): Error {
  if (err instanceof multer.MulterError) {
    switch (err.code) {
      case 'LIMIT_FILE_SIZE':
        return new PayloadTooLargeError(
          `The file is larger than the ${Math.round(env.MAX_UPLOAD_BYTES / (1024 * 1024))}MB limit.`,
        );
      case 'LIMIT_FILE_COUNT':
      case 'LIMIT_UNEXPECTED_FILE':
        return new ValidationError('Upload exactly one file, in the "file" field.');
      case 'LIMIT_PART_COUNT':
      case 'LIMIT_FIELD_COUNT':
        return new ValidationError('The upload contained too many parts.');
      default:
        return new ValidationError('The upload could not be read.');
    }
  }
  return err instanceof Error ? err : new ValidationError('The upload could not be read.');
}
