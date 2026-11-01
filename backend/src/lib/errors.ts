/**
 * Application error types and the single API error shape.
 *
 * Every failure the client sees is serialised as (spec §31):
 *   { "error": { "code": "VALIDATION_ERROR", "message": "...", "details": {} } }
 *
 * Messages here are safe to show a user. Stack traces, SQL text, filesystem
 * paths and provider errors are logged server-side and never serialised —
 * `errorHandler` enforces that boundary.
 */

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHENTICATED'
  | 'INVALID_CREDENTIALS'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'PAYLOAD_TOO_LARGE'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'RATE_LIMITED'
  | 'CSRF_FAILED'
  | 'PRECONDITION_FAILED'
  | 'DEPENDENCY_UNAVAILABLE'
  | 'INTERNAL_ERROR';

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: unknown;
  /** True for errors that are part of normal operation (4xx) — logged at warn. */
  readonly expected: boolean;

  constructor(
    code: ErrorCode,
    message: string,
    status: number,
    options: { details?: unknown; expected?: boolean; cause?: unknown } = {},
  ) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.status = status;
    this.details = options.details;
    this.expected = options.expected ?? status < 500;
    if (options.cause !== undefined) this.cause = options.cause;
    Error.captureStackTrace?.(this, new.target);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'The submitted data is invalid.', details?: unknown) {
    super('VALIDATION_ERROR', message, 400, { details });
  }
}

export class UnauthenticatedError extends AppError {
  constructor(message = 'Authentication is required.') {
    super('UNAUTHENTICATED', message, 401);
  }
}

/**
 * Deliberately identical for "no such email" and "wrong password" so the
 * endpoint cannot be used to enumerate registered accounts.
 */
export class InvalidCredentialsError extends AppError {
  constructor(message = 'Email or password is incorrect.') {
    super('INVALID_CREDENTIALS', message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'You do not have access to this resource.') {
    super('FORBIDDEN', message, 403);
  }
}

/**
 * Used for resources that exist but belong to someone else, as well as for
 * genuinely missing ones: returning 404 rather than 403 keeps an attacker from
 * confirming that another user's record exists (spec §28).
 */
export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super('NOT_FOUND', `${resource} was not found.`, 404);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'That resource already exists.', details?: unknown) {
    super('CONFLICT', message, 409, { details });
  }
}

export class PreconditionFailedError extends AppError {
  constructor(message: string, details?: unknown) {
    super('PRECONDITION_FAILED', message, 412, { details });
  }
}

export class UnsupportedMediaTypeError extends AppError {
  constructor(message = 'That file type is not supported.', details?: unknown) {
    super('UNSUPPORTED_MEDIA_TYPE', message, 415, { details });
  }
}

export class PayloadTooLargeError extends AppError {
  constructor(message = 'The uploaded file is too large.', details?: unknown) {
    super('PAYLOAD_TOO_LARGE', message, 413, { details });
  }
}

export class CsrfError extends AppError {
  constructor(message = 'The request could not be verified. Please reload and try again.') {
    super('CSRF_FAILED', message, 403);
  }
}

/**
 * An optional downstream (AI service, LLM provider) is unreachable. Callers
 * degrade gracefully rather than failing the whole request (spec §40).
 */
export class DependencyUnavailableError extends AppError {
  constructor(dependency: string, options: { cause?: unknown } = {}) {
    super('DEPENDENCY_UNAVAILABLE', `${dependency} is currently unavailable. Please try again shortly.`, 503, {
      details: { dependency },
      cause: options.cause,
    });
  }
}

export const isAppError = (e: unknown): e is AppError => e instanceof AppError;

/** Generic 5xx. The message is intentionally content-free. */
export class InternalError extends AppError {
  constructor(message = 'Something went wrong on our end. Please try again.', options: { cause?: unknown } = {}) {
    super('INTERNAL_ERROR', message, 500, { expected: false, cause: options.cause });
  }
}

/** A required backing service (e.g. the database) could not be reached. */
export class ServiceUnavailableError extends AppError {
  constructor(message = 'The service is temporarily unavailable. Please try again shortly.') {
    super('DEPENDENCY_UNAVAILABLE', message, 503, { expected: false });
  }
}
