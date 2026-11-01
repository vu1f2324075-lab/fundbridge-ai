/**
 * Request validation.
 *
 * Every endpoint that accepts input validates it against a Zod schema and then
 * works only with the *parsed* result. Unknown keys are stripped rather than
 * passed through, so a client cannot smuggle extra fields into a Prisma write
 * (e.g. posting `role: "ADMIN"` to a profile update).
 */
import type { RequestHandler } from 'express';
import { ZodError, type ZodTypeAny } from 'zod';
import { ValidationError } from '../lib/errors';

export interface ValidationSchemas {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

/** Flattens Zod issues into `{ "field.path": "message" }` for the UI. */
function formatIssues(error: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    // First issue per field wins — forms show one message per input.
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}

export function validate(schemas: ValidationSchemas): RequestHandler {
  return (req, _res, next) => {
    try {
      if (schemas.params) req.params = schemas.params.parse(req.params) as typeof req.params;
      if (schemas.query) req.query = schemas.query.parse(req.query) as typeof req.query;
      if (schemas.body) req.body = schemas.body.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        return next(new ValidationError('Please correct the highlighted fields.', { fields: formatIssues(err) }));
      }
      next(err);
    }
  };
}
