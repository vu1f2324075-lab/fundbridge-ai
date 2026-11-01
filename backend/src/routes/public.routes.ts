/**
 * Unauthenticated, read-only endpoints for the marketing site.
 *
 * WHY THIS EXISTS
 * ---------------
 * The landing page needs to show real government schemes to a visitor who has
 * not signed in. `/api/schemes` is behind `authenticate`, and it should stay
 * that way. The alternative — hardcoding scheme names into the frontend — is
 * exactly the fabrication this project forbids, so a narrow public endpoint is
 * the honest option.
 *
 * WHAT IT MAY EXPOSE
 * ------------------
 * Published government scheme records only. These are public government facts
 * already published on official portals, carrying no user data of any kind.
 *
 * The projection below is an allowlist, not an exclusion list: a field that is
 * not named here cannot leak, including when the Prisma model gains new columns
 * later. Nothing here touches User, BusinessProfile, Proposal or any other
 * owned record.
 *
 * Only PUBLISHED schemes are returned, so a draft or an unverified placeholder
 * can never be presented to the public as though it were confirmed.
 */
import { Router, type Request, type Response } from 'express';
import { asyncHandler, ok } from '../lib/http';
import { generalLimiter } from '../middleware/rateLimit';
import { prisma } from '../lib/prisma';
import { serialize } from '../lib/serialize';

export const publicRouter = Router();

publicRouter.use(generalLimiter);

/** Allowlisted public fields. Adding to this list is a deliberate decision. */
const publicSchemeSelect = {
  id: true,
  slug: true,
  name: true,
  provider: true,
  ministry: true,
  level: true,
  schemeType: true,
  minFunding: true,
  maxFunding: true,
  fundingDescription: true,
  description: true,
  officialSourceUrl: true,
  applicationUrl: true,
  sourceType: true,
  lastVerifiedAt: true,
} as const;

/**
 * Published schemes for the public scheme explorer.
 *
 * Capped at a small page rather than paginated: this serves a landing-page
 * preview, and anything more belongs behind sign-in where the full catalogue
 * and the matching engine live.
 */
publicRouter.get(
  '/schemes',
  asyncHandler(async (_req: Request, res: Response) => {
    const [schemes, total] = await Promise.all([
      prisma.governmentScheme.findMany({
        where: { status: 'PUBLISHED' },
        select: publicSchemeSelect,
        // Genuinely sourced records first, so a synthetic demonstration record
        // is never the first thing a visitor sees.
        orderBy: [{ sourceType: 'asc' }, { name: 'asc' }],
        take: 24,
      }),
      prisma.governmentScheme.count({ where: { status: 'PUBLISHED' } }),
    ]);

    ok(res, {
      schemes: serialize(schemes),
      total,
      // Stated so the UI can be honest about the dataset's real composition
      // rather than implying the catalogue is complete or fully verified.
      verifiedCount: schemes.filter((s) => s.sourceType === 'OFFICIAL_SOURCE').length,
      syntheticCount: schemes.filter((s) => s.sourceType === 'SYNTHETIC').length,
      disclaimer:
        'Scheme information is reproduced from official sources and may change. Confirm current eligibility and terms with the official source before applying.',
    });
  }),
);
