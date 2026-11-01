/**
 * API route table.
 *
 * Routers are mounted as each feature lands. A route that does not exist yet is
 * simply absent — there are no stub endpoints returning fabricated payloads
 * (master spec rule 14). `/api/meta` tells the frontend which capabilities are
 * actually available so it can render honest empty states.
 */
import { Router } from 'express';
import { authRouter } from './auth.routes';
import { businessRouter, savedRouter, schemeRouter } from './business.routes';
import { assistantRouter, proposalRouter } from './proposal.routes';
import { investorRouter } from './investor.routes';
import { adminRouter } from './admin.routes';
import { publicRouter } from './public.routes';
import { env } from '../config/env';
import {
  FUNDING_PURPOSE_VOCABULARY,
  INDUSTRY_VOCABULARY,
} from '../config/matching';

export const apiRouter = Router();

// Unauthenticated and read-only. Published government scheme facts only; see
// public.routes.ts for why this is separate from the authenticated catalogue.
apiRouter.use('/public', publicRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/business', businessRouter);
apiRouter.use('/schemes', schemeRouter);
apiRouter.use('/saved', savedRouter);
apiRouter.use('/proposals', proposalRouter);
apiRouter.use('/assistant', assistantRouter);
apiRouter.use('/investor', investorRouter);
apiRouter.use('/admin', adminRouter);

/**
 * Controlled vocabularies and feature availability.
 *
 * The frontend reads its dropdown options from here rather than hardcoding
 * them, so adding an industry does not require a frontend change (master spec
 * §50). `features` reports what is genuinely implemented, so the UI never shows
 * a control for something that cannot work.
 */
apiRouter.get('/meta', (_req, res) => {
  res.status(200).json({
    data: {
      vocabularies: {
        industries: INDUSTRY_VOCABULARY,
        fundingPurposes: FUNDING_PURPOSE_VOCABULARY,
        businessTypes: [
          'PROPRIETORSHIP',
          'PARTNERSHIP',
          'LLP',
          'PRIVATE_LIMITED',
          'PUBLIC_LIMITED',
          'FPO',
          'SOCIETY',
          'TRUST',
          'SELF_HELP_GROUP',
          'OTHER',
        ],
        businessStages: ['IDEA', 'PROTOTYPE', 'EARLY', 'GROWTH', 'EXPANSION', 'MATURE'],
        productStatuses: ['CONCEPT', 'IN_DEVELOPMENT', 'PILOT', 'LAUNCHED', 'SCALING'],
        fundingTypes: ['EQUITY', 'DEBT', 'GRANT', 'SUBSIDY', 'LOAN', 'GUARANTEE', 'ANY_SUITABLE', 'OTHER'],
      },
      features: {
        readiness: true,
        schemeMatching: true,
        actionPlan: true,
        savedOpportunities: true,
        investorMatching: true,
        adminModule: true,
        // These need the Python AI service. Reported from configuration so the
        // UI can show an accurate state rather than offering a control that
        // would fail.
        semanticMatching: env.aiServiceEnabled,
        proposalUpload: env.aiServiceEnabled,
        proposalAnalysis: env.aiServiceEnabled,
        ragExplanations: env.aiServiceEnabled,
        proposalAssistant: env.aiServiceEnabled,
      },
      disclaimer:
        'FundBridge AI is a decision-support and discovery platform. Information and match results do not guarantee eligibility, funding, approval or investment. Verify current requirements with the official source before applying.',
    },
  });
});
