/**
 * Express application assembly.
 *
 * Middleware order is load-bearing and is the reason the security controls
 * actually apply:
 *   1. trust proxy      — so `req.ip` is the client, not the load balancer,
 *                         which rate limiting depends on being correct
 *   2. helmet           — security headers on every response, including errors
 *   3. cors             — rejects disallowed origins before any work is done
 *   4. body parsers     — with size caps, so a huge body is refused early
 *   5. cookies          — needed by authenticate and csrf
 *   6. request context  — correlation id, available to every later log line
 *   7. rate limit       — before routes, so throttling costs nothing
 *   8. csrf             — before routes, after cookies
 *   9. routes
 *  10. 404 + errors     — last, so they catch everything above
 *
 * Exported separately from `index.ts` so tests can drive it with Supertest
 * without binding a port.
 */
import express, { type Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import { apiRouter } from './routes';
import { requestId, httpLogger, logUser } from './middleware/requestContext';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { generalLimiter } from './middleware/rateLimit';
import { verifyCsrf } from './middleware/csrf';
import { optionalAuthenticate } from './middleware/authenticate';

export function createApp(): Express {
  const app = express();

  // Only enabled behind a known proxy. Trusting forwarded headers
  // unconditionally would let any client spoof its IP and defeat rate limiting.
  if (env.TRUST_PROXY) app.set('trust proxy', 1);

  // Hides the framework from trivial fingerprinting.
  app.disable('x-powered-by');

  app.use(
    helmet({
      // This is a JSON API: it serves no HTML, so the strictest possible policy
      // is also the cheapest. The frontend ships its own CSP.
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'none'"],
          frameAncestors: ["'none'"],
          baseUri: ["'none'"],
          formAction: ["'none'"],
        },
      },
      // Uploaded files are served with Content-Disposition: attachment; this
      // stops a browser from sniffing one into something executable.
      noSniff: true,
      referrerPolicy: { policy: 'no-referrer' },
      crossOriginResourcePolicy: { policy: 'same-site' },
      hsts: env.isProduction ? { maxAge: 15_552_000, includeSubDomains: true } : false,
    }),
  );

  app.use(
    cors({
      // Explicit allowlist with a callback rather than `origin: true`, which
      // would reflect any origin and, with credentials enabled, defeat the
      // same-origin policy entirely.
      origin: (origin, callback) => {
        // Same-origin and non-browser clients (curl, server-to-server) send no
        // Origin header.
        if (!origin) return callback(null, true);
        if (env.corsOrigins.includes(origin)) return callback(null, true);
        callback(new Error('Origin not allowed by CORS'));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'X-CSRF-Token', 'X-Request-Id', 'Authorization'],
      exposedHeaders: ['X-Request-Id'],
      maxAge: 600,
    }),
  );

  // JSON bodies are small by design; proposal files go through multer, which
  // enforces its own, larger limit.
  app.use(express.json({ limit: '256kb' }));
  app.use(express.urlencoded({ extended: false, limit: '256kb' }));
  app.use(cookieParser());

  app.use(requestId);
  app.use(httpLogger);

  // Liveness probe, mounted before rate limiting so monitoring is never
  // throttled. Reports no version or dependency detail to anonymous callers.
  app.get('/api/health', (_req, res) => {
    res.status(200).json({ data: { status: 'ok' } });
  });

  app.use(generalLimiter);

  // Resolves the session (if any) before CSRF so the check can tell
  // authenticated mutations from anonymous ones, and so rate limiting can
  // bucket per user.
  app.use(optionalAuthenticate);
  app.use(logUser);
  app.use(verifyCsrf);

  app.use('/api', apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
