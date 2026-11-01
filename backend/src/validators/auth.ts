/**
 * Auth request schemas.
 *
 * `.strict()` everywhere: a request carrying unexpected keys is rejected rather
 * than silently trimmed, which keeps `role` injection on registration from
 * being a thing that nearly works.
 */
import { z } from 'zod';
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from '../lib/password';

/** Lowercased and trimmed so `A@b.com` and `a@b.com` cannot both register. */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(254)
  .email('Enter a valid email address');

/**
 * Length is the dominant factor in password strength, so the floor is 10 rather
 * than the customary 8. A character-class requirement is deliberately not
 * imposed — it pushes users toward predictable substitutions — but the most
 * common passwords are rejected outright.
 */
const COMMON_PASSWORDS = new Set([
  'password123',
  'password1234',
  '1234567890',
  'qwertyuiop',
  'iloveyou123',
  'administrator',
  'fundbridge123',
]);

export const passwordSchema = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters`)
  .max(MAX_PASSWORD_LENGTH, `Use at most ${MAX_PASSWORD_LENGTH} characters`)
  .refine((p) => !COMMON_PASSWORDS.has(p.toLowerCase()), 'Choose a less predictable password')
  .refine((p) => p.trim().length > 0, 'Password cannot be only whitespace');

export const registerSchema = z
  .object({
    name: z.string().trim().min(2, 'Enter your name').max(120),
    email: emailSchema,
    password: passwordSchema,
    // ADMIN is absent by design: administrators are provisioned by the seed
    // script or promoted by an existing admin, never self-assigned at signup.
    role: z.enum(['STARTUP', 'INVESTOR'], {
      errorMap: () => ({ message: 'Choose whether you are a business or an investor' }),
    }),
    /** Required for STARTUP so the business profile row can be created atomically. */
    businessName: z.string().trim().min(2).max(200).optional(),
    /** Required for INVESTOR, for the same reason. */
    investorName: z.string().trim().min(2).max(200).optional(),
  })
  .strict()
  .superRefine((val, ctx) => {
    if (val.role === 'STARTUP' && !val.businessName) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['businessName'], message: 'Enter your business name' });
    }
    if (val.role === 'INVESTOR' && !val.investorName) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['investorName'], message: 'Enter your investor or firm name' });
    }
  });

export const loginSchema = z
  .object({
    email: emailSchema,
    // Not `passwordSchema`: login must accept whatever the user stored, even if
    // the policy has since tightened. Validating it here would leak the policy
    // and reject legitimate older passwords.
    password: z.string().min(1, 'Enter your password').max(MAX_PASSWORD_LENGTH),
  })
  .strict();

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password').max(MAX_PASSWORD_LENGTH),
    newPassword: passwordSchema,
  })
  .strict()
  .refine((v) => v.currentPassword !== v.newPassword, {
    path: ['newPassword'],
    message: 'Choose a password different from your current one',
  });

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
