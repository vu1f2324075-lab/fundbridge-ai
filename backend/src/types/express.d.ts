/**
 * Request augmentation.
 *
 * `req.user` is populated only by the `authenticate` middleware, from a
 * verified token plus a fresh database read. Nothing else writes it, so a
 * handler that sees `req.user` can trust it.
 */
import type { Role, UserStatus } from '../../generated/prisma';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: Role;
  status: UserStatus;
  /** Set when the user owns a business profile — the ownership checks read it. */
  businessProfileId?: string;
  /** Set when the user owns an investor profile. */
  investorProfileId?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      requestId: string;
    }
  }
}

export {};
