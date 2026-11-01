/**
 * Central error handling — the only place an error becomes a response body.
 *
 * Guarantees (spec §31):
 *   - Clients get `{ error: { code, message, details } }` and nothing else.
 *   - Stack traces, SQL text, filesystem paths and provider messages are
 *     logged server-side and never serialised.
 *   - An unrecognised error is a 500 with a generic message, never a leaked
 *     `err.message` that might quote a query or a path.
 */
import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import {
  AppError,
  ConflictError,
  InternalError,
  NotFoundError,
  PayloadTooLargeError,
  ServiceUnavailableError,
  UnsupportedMediaTypeError,
  ValidationError,
  isAppError,
} from '../lib/errors';
import { Prisma } from '../../generated/prisma';
import { logger } from '../lib/logger';
import { env } from '../config/env';

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new NotFoundError(`Route ${req.method} ${req.path}`));
};

/**
 * Maps body-parser failures onto application errors.
 *
 * Without this, a request body over the size cap reaches the generic branch and
 * is reported as a 500 — telling the client the server broke when in fact the
 * request was rejected correctly. Malformed JSON has the same problem.
 */
function translateBodyParser(err: unknown): AppError | null {
  if (!err || typeof err !== 'object' || !('type' in err)) return null;
  const type = (err as { type?: string }).type;

  switch (type) {
    case 'entity.too.large':
      return new PayloadTooLargeError('The request body is too large.');
    case 'entity.parse.failed':
      return new ValidationError('The request body is not valid JSON.');
    case 'encoding.unsupported':
      return new UnsupportedMediaTypeError('That content encoding is not supported.');
    case 'request.aborted':
    case 'request.size.invalid':
    case 'parameters.too.many':
      return new ValidationError('The request could not be read.');
    default:
      return null;
  }
}

/** Maps Prisma's error codes onto user-safe application errors. */
function translatePrisma(err: unknown): AppError | null {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002': {
        const target = err.meta?.['target'];
        const fields = Array.isArray(target) ? target.join(', ') : undefined;
        return new ConflictError('That value is already in use.', fields ? { fields } : undefined);
      }
      case 'P2025':
        return new NotFoundError('Record');
      case 'P2003':
        return new ValidationError('A referenced record does not exist.');
      default:
        // Unmapped Prisma codes must not surface `err.message`, which can
        // include column names and parameter values.
        return null;
    }
  }
  if (err instanceof Prisma.PrismaClientValidationError) {
    return new ValidationError('The request could not be processed.');
  }
  if (err instanceof Prisma.PrismaClientInitializationError) {
    return new ServiceUnavailableError();
  }
  return null;
}

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  let appError: AppError;

  if (isAppError(err)) {
    appError = err;
  } else if (err instanceof ZodError) {
    appError = new ValidationError('The submitted data is invalid.');
  } else {
    appError = translateBodyParser(err) ?? translatePrisma(err) ?? new InternalError();
  }

  const logPayload = {
    requestId: req.requestId,
    code: appError.code,
    status: appError.status,
    method: req.method,
    path: req.path,
    userId: req.user?.id,
    // Full detail stays server-side.
    err: appError.expected ? { message: appError.message } : err,
  };

  if (appError.expected) logger.warn(logPayload, 'request failed');
  else logger.error(logPayload, 'unhandled error');

  if (res.headersSent) return;

  res.status(appError.status).json({
    error: {
      code: appError.code,
      message: appError.message,
      details: appError.details ?? {},
      requestId: req.requestId,
      // Stack traces are available in development only, and only for 5xx.
      ...(env.isProduction || appError.expected ? {} : { stack: (err as Error)?.stack }),
    },
  });
};
