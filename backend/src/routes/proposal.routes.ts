/**
 * Proposal routes.
 *
 * The multer middleware is wrapped so its own errors (size limit, too many
 * parts) become proper application errors instead of opaque 500s.
 */
import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import * as controller from '../controllers/proposal.controller';
import { authenticate } from '../middleware/authenticate';
import { requireOwnBusiness, requireProposalOwnership } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { aiLimiter, uploadLimiter } from '../middleware/rateLimit';
import { proposalUpload, translateMulterError } from '../lib/upload';
import { idParamSchema } from '../validators/business';

/** Runs multer and converts its errors. */
const handleUpload: RequestHandler = (req, res, next) => {
  proposalUpload(req, res, (err: unknown) => {
    if (err) {
      next(translateMulterError(err));
      return;
    }
    next();
  });
};

const suggestSectionSchema = z
  .object({
    section: z.string().trim().min(1).max(64),
    currentText: z.string().max(20_000).nullable().optional(),
  })
  .strict();

const askSchema = z
  .object({
    question: z.string().trim().min(5, 'Ask a question of at least five characters').max(500),
    schemeId: z.string().trim().min(1).max(64).optional(),
  })
  .strict();

export const proposalRouter = Router();

proposalRouter.use(authenticate, requireOwnBusiness);

proposalRouter.get('/', controller.list);

// Rate-limited twice over: uploads are expensive to store, and the pipeline
// immediately calls the AI service.
proposalRouter.post('/upload', uploadLimiter, aiLimiter, handleUpload, controller.upload);

proposalRouter.get('/:id', validate({ params: idParamSchema }), requireProposalOwnership(), controller.detail);

proposalRouter.get(
  '/:id/download',
  validate({ params: idParamSchema }),
  requireProposalOwnership(),
  controller.download,
);

proposalRouter.post(
  '/:id/extract',
  validate({ params: idParamSchema }),
  requireProposalOwnership(),
  aiLimiter,
  controller.extract,
);

proposalRouter.post(
  '/:id/analyse',
  validate({ params: idParamSchema }),
  requireProposalOwnership(),
  aiLimiter,
  controller.analyse,
);

proposalRouter.delete(
  '/:id',
  validate({ params: idParamSchema }),
  requireProposalOwnership(),
  controller.remove,
);

/** Proposal assistant: section drafting and grounded scheme questions. */
export const assistantRouter = Router();
assistantRouter.use(authenticate, requireOwnBusiness);

assistantRouter.post(
  '/section',
  aiLimiter,
  validate({ body: suggestSectionSchema }),
  controller.suggestSection,
);

assistantRouter.post('/ask', aiLimiter, validate({ body: askSchema }), controller.askSchemes);
