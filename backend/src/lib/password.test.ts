import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, dummyVerify, MAX_PASSWORD_LENGTH } from './password';

describe('password hashing', () => {
  it('produces a bcrypt hash that is not the plaintext', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(hash).not.toContain('correct horse');
    expect(hash).toMatch(/^\$2[aby]\$12\$/); // bcrypt, cost 12
  });

  it('produces a different hash each time for the same password', async () => {
    const [a, b] = await Promise.all([hashPassword('same-password-here'), hashPassword('same-password-here')]);
    // Distinct salts: two users with one password must not share a hash.
    expect(a).not.toBe(b);
  });

  it('verifies a correct password', async () => {
    const hash = await hashPassword('correct horse battery staple');
    await expect(verifyPassword('correct horse battery staple', hash)).resolves.toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hash = await hashPassword('correct horse battery staple');
    await expect(verifyPassword('Correct horse battery staple', hash)).resolves.toBe(false);
    await expect(verifyPassword('', hash)).resolves.toBe(false);
  });

  it('returns false rather than throwing for a malformed stored hash', async () => {
    // A corrupted column must read as "wrong password", never as a 500 that
    // distinguishes this account from any other.
    await expect(verifyPassword('anything', 'not-a-bcrypt-hash')).resolves.toBe(false);
    await expect(verifyPassword('anything', '')).resolves.toBe(false);
  });

  it('refuses to hash an over-long password', async () => {
    // Unbounded input would be a cheap CPU-exhaustion vector.
    await expect(hashPassword('x'.repeat(MAX_PASSWORD_LENGTH + 1))).rejects.toThrow(/exceeds/);
  });

  it('rejects an over-long password at verification without hashing it', async () => {
    const hash = await hashPassword('correct horse battery staple');
    await expect(verifyPassword('x'.repeat(MAX_PASSWORD_LENGTH + 1), hash)).resolves.toBe(false);
  });

  it('dummyVerify completes, so unknown emails still cost a comparison', async () => {
    await expect(dummyVerify()).resolves.toBeUndefined();
  });
});
