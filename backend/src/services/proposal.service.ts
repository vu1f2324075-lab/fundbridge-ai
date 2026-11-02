/**
 * Proposal pipeline: upload, extract, analyse.
 *
 * The status column drives the whole flow, so a failure is a recorded state
 * rather than a lost request:
 *
 *   UPLOADED -> EXTRACTING -> EXTRACTED -> ANALYSING -> ANALYSED
 *                     |                        |
 *            EXTRACTION_FAILED          ANALYSIS_FAILED
 *
 * Extraction and analysis both depend on the AI service. When it is unreachable
 * the proposal is stored and marked, and the user is told why — the upload is
 * never silently discarded, and the failure is recoverable by retrying.
 */
import { prisma } from '../lib/prisma';
import { NotFoundError, PreconditionFailedError, ValidationError } from '../lib/errors';
import { serialize, decimalToNumber } from '../lib/serialize';
import { logger } from '../lib/logger';
import * as ai from './aiService.client';
import { validateUpload } from '../lib/upload';
import { deleteFile, readFile, writeFile } from '../lib/storage';
import { invalidateDerivedAnalysis } from './business.service';
import { recalculateReadiness } from './readiness.service';
import type { Prisma } from '../../generated/prisma';

/**
 * Fields safe to return to the owner.
 *
 * `extractedText` is excluded because it can be megabytes. `fileName` is
 * excluded because it holds the same value as `storageKey` — selecting it put
 * the storage key into every list and detail response, which defeated the rule
 * that the key never leaves the server. The two columns are redundant; the
 * duplicate is left in the schema for now and dropped in a later migration.
 */
const proposalSelect = {
  id: true,
  businessId: true,
  originalName: true,
  fileType: true,
  fileSize: true,
  checksum: true,
  status: true,
  statusMessage: true,
  sections: true,
  wordCount: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ProposalSelect;

/**
 * Canonical API path for a proposal's stored file.
 *
 * Built from the proposal id, never from `storageKey` — the key stays out of
 * response bodies (see `getProposalForDownload`). The route behind this path is
 * authenticated and ownership-checked, so this is a stable reference to the
 * stored record, not a publicly fetchable link.
 */
function fileDownloadUrl(proposalId: string): string {
  return `/api/proposals/${proposalId}/download`;
}

/**
 * Stores an uploaded proposal.
 *
 * The database row is created only after the bytes are safely on disk, so a
 * failed write cannot leave a row pointing at a file that does not exist.
 */
export async function createProposal(
  businessId: string,
  file: Express.Multer.File,
): Promise<{ id: string; status: string }> {
  const validated = validateUpload(file);

  // A re-upload of the same bytes is almost always an accident.
  const duplicate = await prisma.proposal.findFirst({
    where: { businessId, checksum: validated.checksum },
    select: { id: true },
  });
  if (duplicate) {
    throw new ValidationError('You have already uploaded this exact file.');
  }

  await writeFile(validated.storageKey, file.buffer);

  try {
    const proposal = await prisma.proposal.create({
      data: {
        businessId,
        // Duplicates storageKey; see the note on `proposalSelect`. Written only
        // because the column is still NOT NULL.
        fileName: validated.storageKey,
        originalName: validated.displayName,
        fileType: validated.kind,
        storageKey: validated.storageKey,
        fileSize: validated.size,
        checksum: validated.checksum,
        status: 'UPLOADED',
      },
      select: { id: true, status: true },
    });
    return proposal;
  } catch (err) {
    // Roll back the file so a failed insert does not orphan it on disk.
    await deleteFile(validated.storageKey).catch(() => undefined);
    throw err;
  }
}

/**
 * Extracts text from a stored proposal.
 *
 * Idempotent: re-running on an already-extracted proposal simply re-extracts,
 * which is what a user retrying after an AI-service outage expects.
 */
export async function extractProposal(proposalId: string): Promise<{
  status: string;
  message: string | null;
  wordCount: number | null;
  detectedSections: string[];
}> {
  const proposal = await prisma.proposal.findUnique({
    where: { id: proposalId },
    select: { id: true, storageKey: true, fileType: true, originalName: true },
  });
  if (!proposal) throw new NotFoundError('Proposal');

  await prisma.proposal.update({
    where: { id: proposalId },
    data: { status: 'EXTRACTING', statusMessage: null },
  });

  let buffer: Buffer;
  try {
    buffer = await readFile(proposal.storageKey);
  } catch (err) {
    logger.error({ proposalId, err }, 'stored proposal file could not be read');
    await prisma.proposal.update({
      where: { id: proposalId },
      data: {
        status: 'EXTRACTION_FAILED',
        statusMessage: 'The stored file could not be read. Please upload it again.',
      },
    });
    return {
      status: 'EXTRACTION_FAILED',
      message: 'The stored file could not be read. Please upload it again.',
      wordCount: null,
      detectedSections: [],
    };
  }

  const mimeType =
    proposal.fileType === 'pdf'
      ? 'application/pdf'
      : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

  const result = await ai.extractDocument(buffer, proposal.originalName, mimeType);

  if (!result.ok) {
    await prisma.proposal.update({
      where: { id: proposalId },
      data: { status: 'EXTRACTION_FAILED', statusMessage: result.reason },
    });
    return { status: 'EXTRACTION_FAILED', message: result.reason, wordCount: null, detectedSections: [] };
  }

  const extracted = result.value;

  // A parsed-but-empty document is a failure, not a success with no text: an
  // analysis of nothing would produce a confident-looking zero.
  if (extracted.likely_scanned || extracted.word_count < 50) {
    const message =
      extracted.warnings[0] ??
      'Very little text could be read from this file. If it is a scanned document, upload a text-based version.';
    await prisma.proposal.update({
      where: { id: proposalId },
      data: {
        status: 'EXTRACTION_FAILED',
        statusMessage: message,
        extractedText: extracted.text,
        wordCount: extracted.word_count,
      },
    });
    return {
      status: 'EXTRACTION_FAILED',
      message,
      wordCount: extracted.word_count,
      detectedSections: extracted.detected_sections,
    };
  }

  await prisma.proposal.update({
    where: { id: proposalId },
    data: {
      status: 'EXTRACTED',
      statusMessage: extracted.warnings.length > 0 ? extracted.warnings.join(' ') : null,
      extractedText: extracted.text,
      wordCount: extracted.word_count,
      sections: extracted.sections as unknown as Prisma.InputJsonValue,
    },
  });

  return {
    status: 'EXTRACTED',
    message: extracted.warnings[0] ?? null,
    wordCount: extracted.word_count,
    detectedSections: extracted.detected_sections,
  };
}

/**
 * Analyses an extracted proposal and stores the result.
 *
 * Scores arrive from the AI service's deterministic analyser, never from the
 * LLM. `llmAssisted` records whether a model phrased the narrative, so a reader
 * can tell which parts were model-written.
 */
export async function analyseProposal(proposalId: string): Promise<{
  status: string;
  message: string | null;
  analysisId?: string;
}> {
  const proposal = await prisma.proposal.findUnique({
    where: { id: proposalId },
    select: {
      id: true,
      businessId: true,
      status: true,
      extractedText: true,
      business: {
        select: {
          industry: true,
          businessStage: true,
          fundingRequirement: { select: { amountRequired: true, currency: true } },
        },
      },
    },
  });
  if (!proposal) throw new NotFoundError('Proposal');

  if (!proposal.extractedText?.trim()) {
    throw new PreconditionFailedError(
      'This proposal has no extracted text yet. Run extraction before analysis.',
    );
  }

  await prisma.proposal.update({
    where: { id: proposalId },
    data: { status: 'ANALYSING', statusMessage: null },
  });

  const result = await ai.analyseProposal({
    text: proposal.extractedText,
    industry: proposal.business.industry,
    businessStage: proposal.business.businessStage,
    requestedAmount: proposal.business.fundingRequirement
      ? decimalToNumber(proposal.business.fundingRequirement.amountRequired)
      : null,
    currency: proposal.business.fundingRequirement?.currency ?? 'INR',
    useLlm: true,
  });

  if (!result.ok) {
    await prisma.proposal.update({
      where: { id: proposalId },
      data: { status: 'ANALYSIS_FAILED', statusMessage: result.reason },
    });
    return { status: 'ANALYSIS_FAILED', message: result.reason };
  }

  const a = result.value;

  const analysis = await prisma.proposalAnalysis.create({
    data: {
      proposalId,
      overallScore: a.scores.overall,
      clarityScore: a.scores.clarity,
      completenessScore: a.scores.completeness,
      structureScore: a.scores.structure,
      marketEvidenceScore: a.scores.market_evidence,
      financialScore: a.scores.financial,
      fundingJustificationScore: a.scores.funding_justification,
      teamScore: a.scores.team,
      identifiedStrengths: a.strengths,
      identifiedWeaknesses: a.weaknesses,
      missingSections: a.missing_sections,
      improvementSuggestions: a.suggestions as unknown as Prisma.InputJsonValue,
      llmAssisted: a.llm_assisted,
      modelVersion: a.model_version,
    },
    select: { id: true },
  });

  await prisma.proposal.update({
    where: { id: proposalId },
    data: { status: 'ANALYSED', statusMessage: a.llm_note },
  });

  // The proposal score feeds readiness, so the stored readiness row is now
  // computed from stale inputs and must be recalculated rather than shown.
  await invalidateDerivedAnalysis(proposal.businessId);

  // ...and then recomputed immediately, because this is the one invalidation
  // the user did not cause by editing a field. Analysing a proposal is work
  // they explicitly asked for, and leaving them on a dashboard reading "not
  // calculated yet" makes a completed job look like a failed one. The
  // no-stale-scores rule is still honoured: the row is rebuilt from the inputs
  // as they now stand, not restored.
  //
  // Scheme and investor matches are deliberately NOT rebuilt here. They
  // iterate the whole published catalogue and call the AI service per scheme,
  // which would add seconds to an upload; the dashboard offers an explicit
  // control for those instead.
  try {
    await recalculateReadiness(proposal.businessId);
  } catch (err) {
    // The analysis itself succeeded and is stored. A readiness failure must not
    // turn that into an error for the user — the dashboard will offer to
    // recalculate, which is the pre-existing behaviour.
    logger.warn(
      { businessId: proposal.businessId, err },
      'proposal analysed but readiness could not be recomputed',
    );
  }

  return { status: 'ANALYSED', message: a.llm_note, analysisId: analysis.id };
}

/** Upload, extract and analyse in sequence. Partial success is reported. */
export async function processProposal(
  businessId: string,
  file: Express.Multer.File,
): Promise<{
  proposalId: string;
  status: string;
  message: string | null;
  analysed: boolean;
}> {
  const created = await createProposal(businessId, file);

  const extraction = await extractProposal(created.id);
  if (extraction.status !== 'EXTRACTED') {
    return {
      proposalId: created.id,
      status: extraction.status,
      message: extraction.message,
      analysed: false,
    };
  }

  const analysis = await analyseProposal(created.id);
  return {
    proposalId: created.id,
    status: analysis.status,
    message: analysis.message,
    analysed: analysis.status === 'ANALYSED',
  };
}

export async function listProposals(businessId: string) {
  const proposals = serialize(
    await prisma.proposal.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
      select: {
        ...proposalSelect,
        analyses: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          // modelVersion is included because the list renders it next to the
          // score; without it the UI printed a separator and no value.
          select: {
            id: true,
            overallScore: true,
            llmAssisted: true,
            modelVersion: true,
            createdAt: true,
          },
        },
      },
    }),
  );
  return proposals.map((proposal) => ({ ...proposal, downloadUrl: fileDownloadUrl(proposal.id) }));
}

export async function getProposal(proposalId: string, businessId: string) {
  const proposal = await prisma.proposal.findFirst({
    // Scoped by businessId as well as id, so a valid id from another business
    // returns 404 rather than data.
    where: { id: proposalId, businessId },
    select: {
      ...proposalSelect,
      analyses: { orderBy: { createdAt: 'desc' } },
    },
  });
  if (!proposal) throw new NotFoundError('Proposal');
  return { ...serialize(proposal), downloadUrl: fileDownloadUrl(proposal.id) };
}

/**
 * Resolves a proposal for download.
 *
 * Kept separate from `getProposal` so the storage key never enters a response
 * body — it is needed only to locate the file on disk.
 */
export async function getProposalForDownload(
  proposalId: string,
  businessId: string,
): Promise<{ storageKey: string; originalName: string; fileType: string }> {
  const proposal = await prisma.proposal.findFirst({
    where: { id: proposalId, businessId },
    select: { storageKey: true, originalName: true, fileType: true },
  });
  if (!proposal) throw new NotFoundError('Proposal');
  return proposal;
}

/** Returns the extracted text for the proposal assistant. */
export async function getProposalText(proposalId: string, businessId: string): Promise<string> {
  const proposal = await prisma.proposal.findFirst({
    where: { id: proposalId, businessId },
    select: { extractedText: true },
  });
  if (!proposal) throw new NotFoundError('Proposal');
  if (!proposal.extractedText?.trim()) {
    throw new PreconditionFailedError('This proposal has no extracted text yet.');
  }
  return proposal.extractedText;
}

export async function deleteProposal(proposalId: string, businessId: string): Promise<void> {
  const proposal = await prisma.proposal.findFirst({
    where: { id: proposalId, businessId },
    select: { id: true, storageKey: true },
  });
  if (!proposal) throw new NotFoundError('Proposal');

  // Row first, then the file. If the unlink fails the row is already gone, so
  // the user sees the delete succeed and an orphaned file is a cleanup concern
  // rather than a visible failure.
  await prisma.proposal.delete({ where: { id: proposal.id } });
  await deleteFile(proposal.storageKey).catch((err) => {
    logger.warn({ proposalId, err }, 'proposal row deleted but file remained');
  });

  await invalidateDerivedAnalysis(businessId);
}

/**
 * Section drafting assistance.
 *
 * Facts are read from the database and passed explicitly, because the assistant
 * is permitted to use only what it is given — anything else it needs is reported
 * as a missing fact rather than invented.
 */
export async function suggestProposalSection(
  businessId: string,
  input: { section: string; currentText?: string | null },
): Promise<ai.SectionSuggestion | { unavailable: string }> {
  const business = await prisma.businessProfile.findUnique({
    where: { id: businessId },
    include: { fundingRequirement: true },
  });
  if (!business) throw new NotFoundError('Business profile');

  const facts: Record<string, string> = {};
  const add = (key: string, value: unknown): void => {
    if (value === null || value === undefined) return;
    if (Array.isArray(value)) {
      const items = value.filter(Boolean).map(String);
      if (items.length) facts[key] = items.join(', ');
      return;
    }
    const text = String(value).trim();
    if (text) facts[key] = text;
  };

  add('businessName', business.businessName);
  add('industry', business.industry);
  add('businessStage', business.businessStage);
  add('problem', business.problem);
  add('solution', business.solution);
  add('targetCustomer', business.targetCustomer);
  add('productStatus', business.productStatus);
  add('customerCount', business.customerCount);
  add('customers', business.customers);
  add('partnerships', business.partnerships);
  add('teamSize', business.teamSize);
  add('founderExperience', business.founderExperience);
  add('teamStrength', business.teamStrength);
  add('annualRevenue', decimalToNumber(business.annualRevenue));
  add('annualExpenses', decimalToNumber(business.annualExpenses));
  add('profitLoss', decimalToNumber(business.profitLoss));
  add('existingDebt', decimalToNumber(business.existingDebt));
  add('marketSize', decimalToNumber(business.marketSize));
  add('growthRate', business.growthRate);

  if (business.fundingRequirement) {
    add('amountRequired', decimalToNumber(business.fundingRequirement.amountRequired));
    add('fundingType', business.fundingRequirement.fundingType);
    add('purpose', business.fundingRequirement.purpose);
    add('preferredTimeline', business.fundingRequirement.preferredTimeline);
  }

  const result = await ai.suggestSection({
    section: input.section,
    currentText: input.currentText ?? null,
    knownFacts: facts,
  });

  if (!result.ok) return { unavailable: result.reason };
  return result.value;
}
