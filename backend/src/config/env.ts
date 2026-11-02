/**
 * Environment configuration — validated once, at startup.
 *
 * The process refuses to boot when a required variable is missing or unsafe
 * (master spec §46: "Validate required environment variables at application
 * startup. Fail safely if required secrets are missing."). Importing anything
 * else before this module has run is a bug: every other module reads `env`.
 */
import path from 'node:path';
import dotenv from 'dotenv';
import { z } from 'zod';

// backend/.env first, then repo-root .env as a fallback for shared values.
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const PLACEHOLDER_SECRETS = new Set([
  'replace-me-with-a-long-random-string',
  'changeme',
  'secret',
  'development',
]);

const booleanish = z
  .enum(['true', 'false', '1', '0'])
  .transform((v) => v === 'true' || v === '1');

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().max(65535).default(4000),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),

    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

    // A short secret is a real vulnerability, not a style preference: 32 bytes
    // of entropy is the floor for HS256.
    JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
    JWT_EXPIRES_IN: z.string().default('7d'),

    /** Comma-separated allowlist. Never `*` — credentials are sent with cookies. */
    CORS_ORIGIN: z.string().default('http://localhost:5173'),

    STORAGE_DRIVER: z.enum(['local']).default('local'),
    STORAGE_LOCAL_DIR: z.string().default('./storage/proposals'),
    MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(10 * 1024 * 1024),

    /** Blank disables AI calls; deterministic scoring still works (spec §40). */
    AI_SERVICE_URL: z.string().url().optional().or(z.literal('')),
    AI_SERVICE_TIMEOUT_MS: z.coerce.number().int().positive().default(60_000),
    AI_SERVICE_TOKEN: z.string().optional(),

    // zod 4's `.default()` takes the output type, so this is `false` and not
    // the string 'false' that the enum accepts on the input side.
    TRUST_PROXY: booleanish.default(false),
  })
  .superRefine((val, ctx) => {
    if (val.NODE_ENV === 'production') {
      if (PLACEHOLDER_SECRETS.has(val.JWT_SECRET.toLowerCase())) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['JWT_SECRET'],
          message: 'JWT_SECRET is still the placeholder value — refusing to start in production',
        });
      }
      if (val.CORS_ORIGIN.includes('*')) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['CORS_ORIGIN'],
          message: 'Wildcard CORS origin is not allowed in production',
        });
      }
      if (val.CORS_ORIGIN.includes('localhost')) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['CORS_ORIGIN'],
          message: 'CORS_ORIGIN still points at localhost in production',
        });
      }
    }
  });

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  // Printed without values so a CI log never leaks a partially-set secret.
  const lines = parsed.error.issues.map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`);
  // eslint-disable-next-line no-console -- the logger itself depends on this module
  console.error(
    ['', 'Invalid environment configuration:', ...lines, '', 'See .env.example for the full list.', ''].join('\n'),
  );
  process.exit(1);
}

const raw = parsed.data;

export const env = {
  ...raw,
  isProduction: raw.NODE_ENV === 'production',
  isTest: raw.NODE_ENV === 'test',
  isDevelopment: raw.NODE_ENV === 'development',
  /** Parsed CORS allowlist. */
  corsOrigins: raw.CORS_ORIGIN.split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  /** True when the Python AI service is configured; gates optional AI features. */
  aiServiceEnabled: Boolean(raw.AI_SERVICE_URL),
} as const;

export type Env = typeof env;
