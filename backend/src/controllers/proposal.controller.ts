/**
 * Proposal endpoints.
 *
 * Every handler scopes to the caller's own business, and the download route
 * streams through an ownership check rather than exposing a path.
 */
import type { Request, Response } from 'express';
import { asyncHandler, noContent, ok } from '../lib/http';
import { ForbiddenError, ValidationError } from '../lib/errors';
import * as proposalService from '../services/proposal.service';
import * as ragService from '../services/rag.service';
import { readFile } from '../lib/storage';
import { recordAudit } from '../services/audit.service';

function businessId(req: Request): string {
  const id = req.user?.businessProfileId;
  if (!id) throw new ForbiddenError('A business profile is required for this action.');
  return id;
}

export const upload = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) throw new ValidationError('Attach a PDF or Word document in the "file" field.');

  const id = businessId(req);
  const result = await proposalService.processProposal(id, req.file);

  await recordAudit({
    actorId: req.user?.id,
    action: 'proposal.uploaded',
    entity: 'Proposal',
    entityId: result.proposalId,
    // Size and type only. The filename can contain personal information and
    // the content certainly can.
    metadata: { status: result.status, sizeBytes: req.file.size, fileType: req.file.mimetype },
    ip: req.ip,
  });

  if (result.analysed) {
    await recordAudit({
      actorId: req.user?.id,
      action: 'proposal.analysed',
      entity: 'Proposal',
      entityId: result.proposalId,
      ip: req.ip,
    });
  }

  // 201 even on a partial pipeline: the file WAS stored, and the status says
  // what happened next. Returning an error would imply the upload was lost.
  ok(res, { proposal: result }, 201);
});

export const list = asyncHandler(async (req: Request, res: Response) => {
  ok(res, { proposals: await proposalService.listProposals(businessId(req)) });
});

export const detail = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params['id'] as string;
  ok(res, { proposal: await proposalService.getProposal(id, businessId(req)) });
});

export const extract = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params['id'] as string;
  // Ownership was verified by requireProposalOwnership on the route.
  ok(res, { result: await proposalService.extractProposal(id) });
});

export const analyse = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params['id'] as string;
  const result = await proposalService.analyseProposal(id);

  if (result.status === 'ANALYSED') {
    await recordAudit({
      actorId: req.user?.id,
      action: 'proposal.analysed',
      entity: 'Proposal',
      entityId: id,
      ip: req.ip,
    });
  }

  ok(res, { result });
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await proposalService.deleteProposal(req.params['id'] as string, businessId(req));
  noContent(res);
});

/**
 * Streams the original file back to its owner.
 *
 * Content-Disposition is always `attachment` and the type is forced, so a
 * browser cannot be induced to render an uploaded file inline — which is what
 * turns a stored-file endpoint into a stored-XSS vector.
 */
export const download = asyncHandler(async (req: Request, res: Response) => {
  const proposal = await proposalService.getProposalForDownload(
    req.params['id'] as string,
    businessId(req),
  );
  const buffer = await readFile(proposal.storageKey);

  res.setHeader(
    'Content-Type',
    proposal.fileType === 'pdf'
      ? 'application/pdf'
      : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  );
  // The filename is quoted and already sanitised; a header-injection attempt
  // could not have survived `sanitiseDisplayName`.
  res.setHeader('Content-Disposition', `attachment; filename="${proposal.originalName}"`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'private, no-store');
  res.send(buffer);
});

/** Section drafting assistance. */
export const suggestSection = asyncHandler(async (req: Request, res: Response) => {
  const { section, currentText } = req.body as { section: string; currentText?: string | null };
  const result = await proposalService.suggestProposalSection(businessId(req), {
    section,
    currentText: currentText ?? null,
  });

  if ('unavailable' in result) {
    // 503, not 500: the request was valid and the feature is simply offline.
    res.status(503).json({
      error: { code: 'DEPENDENCY_UNAVAILABLE', message: result.unavailable, details: {} },
    });
    return;
  }

  ok(res, { suggestion: result });
});

/**
 * Retrieval-augmented answer about schemes.
 *
 * Retrieval is restricted to PUBLISHED documents inside the service, so this
 * endpoint cannot surface unverified text. Citations are always returned, even
 * when the narrative is not, so the user can read the source directly.
 */
export const askSchemes = asyncHandler(async (req: Request, res: Response) => {
  const { question, schemeId } = req.body as { question: string; schemeId?: string };

  const retrieval = await ragService.retrieve(question, {
    limit: 6,
    ...(schemeId ? { schemeId } : {}),
  });

  if (!retrieval.available) {
    res.status(503).json({
      error: {
        code: 'DEPENDENCY_UNAVAILABLE',
        message: retrieval.reason ?? 'Retrieval is currently unavailable.',
        details: {},
      },
    });
    return;
  }

  if (retrieval.chunks.length === 0) {
    ok(res, {
      answer: {
        narrative: null,
        citations: [],
        // Said plainly: no grounded context means no answer, rather than an
        // ungrounded one.
        note: 'No official source material matched that question closely enough to answer from. Nothing has been generated, because an answer without a source would not be verifiable.',
      },
    });
    return;
  }

  const { groundedExplanation } = await import('../services/aiService.client');
  const result = await groundedExplanation({
    explanation: { question, retrievedChunks: retrieval.chunks.length },
    context: retrieval.chunks.map((c) => ({
      chunk_id: c.chunkId,
      scheme_id: c.schemeId,
      scheme_name: c.schemeName,
      document_title: c.documentTitle,
      source_url: c.sourceUrl,
      source_type: c.sourceType,
      last_verified_at: c.lastVerifiedAt?.toISOString() ?? null,
      text: c.text,
      similarity: c.similarity,
    })),
    question,
  });

  ok(res, {
    answer: {
      narrative: result.ok ? result.value.narrative : null,
      citations: retrieval.chunks.map((c) => ({
        chunkId: c.chunkId,
        schemeId: c.schemeId,
        schemeName: c.schemeName,
        documentTitle: c.documentTitle,
        sourceUrl: c.sourceUrl,
        lastVerifiedAt: c.lastVerifiedAt,
        similarity: Math.round(c.similarity * 100) / 100,
        excerpt: c.text.slice(0, 600),
      })),
      note: result.ok ? result.value.llm_note : result.reason,
    },
  });
});
