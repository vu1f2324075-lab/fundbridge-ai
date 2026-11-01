/**
 * Authentication business logic.
 *
 * Kept free of Express types so it can be unit-tested directly and reused by
 * the seed script.
 */
import { prisma } from '../lib/prisma';
import { hashPassword, verifyPassword, dummyVerify } from '../lib/password';
import { ConflictError, InvalidCredentialsError, ForbiddenError, UnauthenticatedError } from '../lib/errors';
import type { RegisterInput } from '../validators/auth';
import type { Role, UserStatus } from '../../generated/prisma';

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: UserStatus;
  createdAt: Date;
  /** Present once onboarding has created the matching profile row. */
  businessProfileId?: string;
  investorProfileId?: string;
}

/**
 * Registers a user and their role-specific profile in one transaction, so a
 * failure cannot leave an account that has no profile to work with.
 */
export async function registerUser(input: RegisterInput): Promise<PublicUser> {
  const existing = await prisma.user.findUnique({ where: { email: input.email }, select: { id: true } });
  if (existing) {
    // Registration cannot avoid revealing that an address is taken — the user
    // has to be told. Login, which can, does not.
    throw new ConflictError('An account with that email already exists.');
  }

  const passwordHash = await hashPassword(input.password);

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash,
        // Taken from the validated enum, never from a raw request field.
        role: input.role,
      },
      select: { id: true, name: true, email: true, role: true, status: true, createdAt: true },
    });

    if (input.role === 'STARTUP' && input.businessName) {
      const profile = await tx.businessProfile.create({
        data: { userId: created.id, businessName: input.businessName, sourceType: 'USER' },
        select: { id: true },
      });
      return { ...created, businessProfileId: profile.id };
    }

    if (input.role === 'INVESTOR' && input.investorName) {
      const profile = await tx.investorProfile.create({
        data: {
          userId: created.id,
          investorName: input.investorName,
          investorType: 'OTHER',
          sourceType: 'USER',
        },
        select: { id: true },
      });
      return { ...created, investorProfileId: profile.id };
    }

    return created;
  });

  return user;
}

/**
 * Verifies credentials.
 *
 * A missing account still pays the cost of a bcrypt comparison, so response
 * time does not distinguish "no such user" from "wrong password", and both
 * raise the same error.
 */
export async function authenticateUser(email: string, password: string): Promise<PublicUser> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      createdAt: true,
      passwordHash: true,
      businessProfile: { select: { id: true } },
      investorProfile: { select: { id: true } },
    },
  });

  if (!user) {
    await dummyVerify();
    throw new InvalidCredentialsError();
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) throw new InvalidCredentialsError();

  // Checked after the password, so the suspension message cannot be used to
  // enumerate which addresses belong to suspended accounts.
  if (user.status === 'SUSPENDED') {
    throw new ForbiddenError('This account has been suspended. Please contact support.');
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt,
    ...(user.businessProfile ? { businessProfileId: user.businessProfile.id } : {}),
    ...(user.investorProfile ? { investorProfileId: user.investorProfile.id } : {}),
  };
}

export async function getUserById(userId: string): Promise<PublicUser | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      createdAt: true,
      businessProfile: { select: { id: true } },
      investorProfile: { select: { id: true } },
    },
  });
  if (!user) return null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt,
    ...(user.businessProfile ? { businessProfileId: user.businessProfile.id } : {}),
    ...(user.investorProfile ? { investorProfileId: user.investorProfile.id } : {}),
  };
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
  if (!user) throw new UnauthenticatedError();

  const ok = await verifyPassword(currentPassword, user.passwordHash);
  if (!ok) throw new InvalidCredentialsError('Your current password is incorrect.');

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
}
