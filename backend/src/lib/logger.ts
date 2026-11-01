/**
 * Structured logging.
 *
 * Spec §32 forbids logging passwords, API keys, JWT secrets, auth tokens and
 * sensitive financial information. Rather than relying on every call site to
 * remember that, the redaction list below strips those paths centrally — so a
 * careless `logger.info({ body })` cannot leak a password.
 */
import pino from 'pino';
import { env } from '../config/env';

/** Paths scrubbed from every log record before it is written. */
const REDACTED_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-csrf-token"]',
  'res.headers["set-cookie"]',
  'password',
  'passwordHash',
  'currentPassword',
  'newPassword',
  'confirmPassword',
  'token',
  'accessToken',
  'refreshToken',
  'csrfToken',
  'apiKey',
  'secret',
  '*.password',
  '*.passwordHash',
  '*.token',
  '*.apiKey',
  'body.password',
  'body.currentPassword',
  'body.newPassword',
];

export const logger = pino({
  level: env.isTest ? 'silent' : env.LOG_LEVEL,
  redact: { paths: REDACTED_PATHS, censor: '[redacted]' },
  base: { service: 'fundbridge-api' },
  formatters: {
    level: (label) => ({ level: label }),
  },
  // Human-readable in development; newline-delimited JSON everywhere else so
  // production logs stay machine-parseable.
  transport: env.isDevelopment
    ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname,service' } }
    : undefined,
});

export type Logger = typeof logger;
