/**
 * Saved opportunities.
 *
 * Scoped to the signed-in user, not to their business profile, so the same
 * mechanism works for an investor saving businesses later.
 */
import { prisma } from '../lib/prisma';
import { ConflictError, NotFoundError, ValidationError } from '../lib/errors';
import { serialize } from '../lib/serialize';
import type { OpportunityType } from '../../generated/prisma';

/**
 * Saves a reference after checking the target exists and is visible.
 *
 * Without this check a user could store a reference to an archived or unpublished
 * scheme and see a permanently broken row in their saved list.
 */
export async function saveOpportunity(
  userId: string,
  input: { opportunityType: OpportunityType; opportunityId: string; notes?: string | null },
) {
  if (input.opportunityType === 'SCHEME') {
    const scheme = await prisma.governmentScheme.findFirst({
      where: { id: input.opportunityId, status: 'PUBLISHED' },
      select: { id: true },
    });
    if (!scheme) throw new ValidationError('That scheme could not be found.');
  } else {
    const investor = await prisma.investorProfile.findFirst({
      where: { id: input.opportunityId, active: true },
      select: { id: true },
    });
    if (!investor) throw new ValidationError('That investor could not be found.');
  }

  const existing = await prisma.savedOpportunity.findUnique({
    where: {
      userId_opportunityType_opportunityId: {
        userId,
        opportunityType: input.opportunityType,
        opportunityId: input.opportunityId,
      },
    },
    select: { id: true },
  });
  if (existing) throw new ConflictError('You have already saved this opportunity.');

  return serialize(
    await prisma.savedOpportunity.create({
      data: {
        userId,
        opportunityType: input.opportunityType,
        opportunityId: input.opportunityId,
        notes: input.notes ?? null,
      },
    }),
  );
}

/**
 * The user's saved items, hydrated with their targets.
 *
 * Hydration is done in two batched queries rather than per row, and a target
 * that has since been unpublished comes back as `target: null` so the UI can
 * show "no longer available" instead of crashing on a missing field.
 */
export async function listSavedOpportunities(userId: string) {
  const saved = await prisma.savedOpportunity.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });

  const schemeIds = saved.filter((s) => s.opportunityType === 'SCHEME').map((s) => s.opportunityId);
  const investorIds = saved.filter((s) => s.opportunityType === 'INVESTOR').map((s) => s.opportunityId);

  const [schemes, investors] = await Promise.all([
    schemeIds.length
      ? prisma.governmentScheme.findMany({
          where: { id: { in: schemeIds }, status: 'PUBLISHED' },
          select: {
            id: true,
            name: true,
            provider: true,
            schemeType: true,
            level: true,
            minFunding: true,
            maxFunding: true,
            officialSourceUrl: true,
            applicationUrl: true,
            lastVerifiedAt: true,
          },
        })
      : Promise.resolve([]),
    investorIds.length
      ? prisma.investorProfile.findMany({
          where: { id: { in: investorIds }, active: true },
          select: {
            id: true,
            investorName: true,
            investorType: true,
            minInvestment: true,
            maxInvestment: true,
            industries: true,
            verification: true,
          },
        })
      : Promise.resolve([]),
  ]);

  const schemeById = new Map(schemes.map((s) => [s.id, s]));
  const investorById = new Map(investors.map((i) => [i.id, i]));

  return serialize(
    saved.map((s) => ({
      ...s,
      target:
        s.opportunityType === 'SCHEME'
          ? (schemeById.get(s.opportunityId) ?? null)
          : (investorById.get(s.opportunityId) ?? null),
    })),
  );
}

export async function deleteSavedOpportunity(userId: string, savedId: string): Promise<void> {
  // Scoped by userId so one user cannot delete another's saved row.
  const result = await prisma.savedOpportunity.deleteMany({ where: { id: savedId, userId } });
  if (result.count === 0) throw new NotFoundError('Saved opportunity');
}
