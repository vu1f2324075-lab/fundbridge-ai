/**
 * Assigns every request a correlation id and logs its outcome.
 *
 * The id is echoed in the `X-Request-Id` response header and included in error
 * bodies, so a user-reported failure can be found in the logs without the error
 * message itself having to carry internal detail.
 */
import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';
import pinoHttp from 'pino-http';
import { logger } from '../lib/logger';

export const requestId: RequestHandler = (req, res, next) => {
  // An inbound header is accepted for tracing across services but sanitised:
  // it is reflected into a response header and must not carry control
  // characters or unbounded length.
  const inbound = req.header('x-request-id');
  const safe = inbound && /^[\w-]{1,64}$/.test(inbound) ? inbound : randomUUID();
  req.requestId = safe;
  res.setHeader('X-Request-Id', safe);
  next();
};

export const httpLogger = pinoHttp({
  logger,
  genReqId: (req) => (req as { requestId?: string }).requestId ?? randomUUID(),
  // Only non-sensitive request metadata is serialised; `redact` in logger.ts is
  // the backstop for anything that slips through.
  serializers: {
    req: (req) => ({ id: req.id, method: req.method, url: req.url }),
    res: (res) => ({ statusCode: res.statusCode }),
  },
  customLogLevel: (_req, res, err) => {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  customSuccessMessage: (req, res) => `${req.method} ${req.url} ${res.statusCode}`,
  autoLogging: {
    ignore: (req) => req.url === '/api/health' || req.url === '/health',
  },
});

/** Attaches the authenticated user id to the request log line, once known. */
export const logUser: RequestHandler = (req, _res, next) => {
  if (req.user && 'log' in req && req.log) {
    req.log = req.log.child({ userId: req.user.id, role: req.user.role });
  }
  next();
};
