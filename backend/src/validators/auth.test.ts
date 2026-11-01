import { describe, it, expect } from 'vitest';
import { registerSchema, loginSchema, changePasswordSchema, emailSchema } from './auth';

const validRegistration = {
  name: 'Rahul Sharma',
  email: 'rahul@buildtech.example',
  password: 'a-reasonably-long-passphrase',
  role: 'STARTUP' as const,
  businessName: 'BuildTech Solutions',
};

describe('emailSchema', () => {
  it('normalises case and surrounding whitespace', () => {
    // Without this, Rahul@X.com and rahul@x.com could both register.
    expect(emailSchema.parse('  Rahul@BuildTech.Example  ')).toBe('rahul@buildtech.example');
  });

  it('rejects malformed addresses', () => {
    for (const bad of ['', 'not-an-email', 'a@', '@b.com', 'a b@c.com']) {
      expect(emailSchema.safeParse(bad).success).toBe(false);
    }
  });
});

describe('registerSchema', () => {
  it('accepts a valid startup registration', () => {
    expect(registerSchema.safeParse(validRegistration).success).toBe(true);
  });

  it('refuses a self-assigned ADMIN role', () => {
    // Privilege escalation at signup: ADMIN is not in the enum at all.
    const result = registerSchema.safeParse({ ...validRegistration, role: 'ADMIN' });
    expect(result.success).toBe(false);
  });

  it('strips nothing and instead rejects unexpected fields', () => {
    // `.strict()` means an attacker cannot smuggle extra columns into the
    // Prisma write by appending keys.
    const result = registerSchema.safeParse({ ...validRegistration, status: 'ACTIVE', passwordHash: 'x' });
    expect(result.success).toBe(false);
  });

  it('requires a business name for STARTUP and an investor name for INVESTOR', () => {
    const noBusiness = registerSchema.safeParse({ ...validRegistration, businessName: undefined });
    expect(noBusiness.success).toBe(false);

    const investor = registerSchema.safeParse({
      name: 'Alpha Ventures',
      email: 'team@alpha.example',
      password: 'a-reasonably-long-passphrase',
      role: 'INVESTOR',
      investorName: 'Alpha Ventures',
    });
    expect(investor.success).toBe(true);

    const investorNoName = registerSchema.safeParse({
      name: 'Alpha Ventures',
      email: 'team@alpha.example',
      password: 'a-reasonably-long-passphrase',
      role: 'INVESTOR',
    });
    expect(investorNoName.success).toBe(false);
  });

  it('enforces the minimum password length', () => {
    const result = registerSchema.safeParse({ ...validRegistration, password: 'short' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toMatch(/at least 10/);
    }
  });

  it('rejects well-known weak passwords', () => {
    expect(registerSchema.safeParse({ ...validRegistration, password: 'password123' }).success).toBe(false);
    expect(registerSchema.safeParse({ ...validRegistration, password: 'FundBridge123' }).success).toBe(false);
  });

  it('rejects a whitespace-only password', () => {
    expect(registerSchema.safeParse({ ...validRegistration, password: '              ' }).success).toBe(false);
  });
});

describe('loginSchema', () => {
  it('accepts any non-empty password so older credentials still work', () => {
    // Applying the registration policy here would lock out users who signed up
    // before it tightened, and would leak the policy to unauthenticated callers.
    const result = loginSchema.safeParse({ email: 'rahul@buildtech.example', password: 'old' });
    expect(result.success).toBe(true);
  });

  it('rejects an empty password and unexpected fields', () => {
    expect(loginSchema.safeParse({ email: 'rahul@buildtech.example', password: '' }).success).toBe(false);
    expect(
      loginSchema.safeParse({ email: 'rahul@buildtech.example', password: 'x', role: 'ADMIN' }).success,
    ).toBe(false);
  });
});

describe('changePasswordSchema', () => {
  it('requires the new password to differ from the current one', () => {
    const same = 'a-reasonably-long-passphrase';
    expect(changePasswordSchema.safeParse({ currentPassword: same, newPassword: same }).success).toBe(false);
  });

  it('applies the full password policy to the new password', () => {
    expect(
      changePasswordSchema.safeParse({ currentPassword: 'whatever-it-was', newPassword: 'short' }).success,
    ).toBe(false);
  });

  it('accepts a valid change', () => {
    expect(
      changePasswordSchema.safeParse({
        currentPassword: 'the-old-passphrase',
        newPassword: 'a-brand-new-passphrase',
      }).success,
    ).toBe(true);
  });
});
