/**
 * Password hashing.
 *
 * bcrypt via `bcryptjs` (pure JavaScript, so no native toolchain is required on
 * Windows). Cost 12 is roughly 250ms per hash on current hardware — slow enough
 * to make offline cracking expensive, fast enough for interactive login.
 */
import bcrypt from 'bcryptjs';

const COST = 12;

/** Upper bound on input length: bcrypt only reads the first 72 bytes, and
 *  accepting megabyte-long passwords would be a cheap CPU-exhaustion vector. */
export const MAX_PASSWORD_LENGTH = 200;
export const MIN_PASSWORD_LENGTH = 10;

export async function hashPassword(plain: string): Promise<string> {
  if (plain.length > MAX_PASSWORD_LENGTH) {
    throw new Error(`Password exceeds ${MAX_PASSWORD_LENGTH} characters`);
  }
  return bcrypt.hash(plain, COST);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  if (!hash || plain.length > MAX_PASSWORD_LENGTH) return false;
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    // A malformed stored hash must read as "wrong password", never as an error
    // that distinguishes this account from any other.
    return false;
  }
}

/**
 * A real hash at the production cost factor, computed once at startup so
 * `dummyVerify` burns genuinely comparable CPU. Generating it beats embedding a
 * literal, which would silently stop costing anything if it were ever malformed.
 */
const TIMING_EQUALISATION_HASH = bcrypt.hashSync('timing-equalisation', COST);

/**
 * Burns roughly the same CPU as a real verification. Called when login is
 * attempted for an address that has no account, so that response time does not
 * reveal whether the email is registered.
 */
export async function dummyVerify(): Promise<void> {
  await bcrypt.compare('timing-equalisation', TIMING_EQUALISATION_HASH);
}
