/**
 * Retrieval-Augmented Generation.
 *
 * Node owns the index because Node owns the database. The AI service embeds and
 * chunks; this file stores, retrieves and enforces what may be retrieved.
 *
 * THE RULE THAT MATTERS: retrieval is restricted to chunks whose parent document
 * is PUBLISHED. An unverified draft can never be surfaced as authoritative
 * government information, which is the whole point of having a document
 * lifecycle. Every retrieved chunk carries its source URL and verification date
 * so the UI can show provenance rather than an unattributed assertion.
 */
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import * as ai from './aiService.client';
import type { Prisma } from '../../generated/prisma';

/** Must match the AI service's configured output width. */
const EMBEDDING_DIM = 384;

/**
 * Minimum raw cosine for a chunk to count as relevant.
 *
 * Deliberately not zero. See the note in `retrieve` — this model's baseline
 * similarity between unrelated text is high enough that a low threshold returns
 * noise dressed up as evidence.
 */
const MIN_COSINE_SIMILARITY = 0.35;

const CHUNK_SIZE = 900;
const CHUNK_OVERLAP = 150;

export interface RetrievedChunk {
  chunkId: string;
  documentId: string;
  schemeId: string | null;
  schemeName: string | null;
  documentTitle: string;
  sourceUrl: string;
  sourceType: string;
  lastVerifiedAt: Date | null;
  heading: string | null;
  text: string;
  /** Cosine similarity rescaled to [0,1]. */
  similarity: number;
}

/** Shape returned by the raw retrieval query. */
interface RetrievalRow {
  chunkId: string;
  documentId: string;
  schemeId: string | null;
  schemeName: string | null;
  documentTitle: string;
  sourceUrl: string;
  sourceType: string;
  lastVerifiedAt: Date | null;
  heading: string | null;
  text: string;
  dot: number | null;
}

/**
 * Builds the retrieval text for a scheme and indexes it.
 *
 * A scheme with no attached PDF still needs to be retrievable, so its curated
 * record is rendered as prose and indexed. The structured record remains the
 * authority for matching — this text exists only for retrieval.
 */
export async function indexScheme(schemeId: string): Promise<{
  indexed: boolean;
  chunks: number;
  reason?: string;
}> {
  const scheme = await prisma.governmentScheme.findUnique({
    where: { id: schemeId },
    select: {
      id: true,
      name: true,
      provider: true,
      ministry: true,
      department: true,
      level: true,
      schemeType: true,
      description: true,
      fundingDescription: true,
      supportedIndustries: true,
      supportedStages: true,
      supportedLocations: true,
      supportedPurposes: true,
      eligibilityCriteria: true,
      requiredDocuments: true,
      applicationProcess: true,
      officialSourceUrl: true,
      status: true,
      lastVerifiedAt: true,
    },
  });

  if (!scheme) return { indexed: false, chunks: 0, reason: 'Scheme not found.' };

  // Only published schemes are indexed. Indexing a draft would put unverified
  // text one retrieval away from being quoted as official.
  if (scheme.status !== 'PUBLISHED') {
    return {
      indexed: false,
      chunks: 0,
      reason: `Scheme status is ${scheme.status}; only PUBLISHED schemes are indexed.`,
    };
  }

  const sections: string[] = [];
  const add = (label: string, value: unknown): void => {
    if (value === null || value === undefined) return;
    if (Array.isArray(value)) {
      const items = value.filter(Boolean).map(String);
      if (items.length) sections.push(`${label}: ${items.join(', ')}`);
      return;
    }
    const text = String(value).trim();
    if (text) sections.push(`${label}: ${text}`);
  };

  add('Scheme', scheme.name);
  add('Provider', scheme.provider);
  add('Ministry', scheme.ministry);
  add('Department', scheme.department);
  add('Level', scheme.level);
  add('Scheme type', scheme.schemeType);
  add('Description', scheme.description);
  add('Funding', scheme.fundingDescription);
  add('Supported industries', scheme.supportedIndustries);
  add('Supported business stages', scheme.supportedStages);
  add('Supported locations', scheme.supportedLocations);
  add('Supported purposes', scheme.supportedPurposes);
  add('Eligibility criteria', scheme.eligibilityCriteria);
  add('Required documents', scheme.requiredDocuments);
  add('Application process', scheme.applicationProcess);

  const content = sections.join('\n\n');
  if (!content.trim()) {
    return { indexed: false, chunks: 0, reason: 'Scheme record has no indexable content.' };
  }

  const document = await prisma.schemeDocument.upsert({
    where: { id: `scheme-record-${scheme.id}` },
    create: {
      // Deterministic id so re-indexing replaces rather than duplicates.
      id: `scheme-record-${scheme.id}`,
      schemeId: scheme.id,
      title: `${scheme.name} — scheme record`,
      sourceType: 'SCHEME_RECORD',
      sourceUrl: scheme.officialSourceUrl,
      publisher: scheme.ministry ?? scheme.provider,
      status: 'PUBLISHED',
      content,
      wordCount: content.split(/\s+/).length,
      lastVerifiedAt: scheme.lastVerifiedAt,
    },
    update: {
      title: `${scheme.name} — scheme record`,
      sourceUrl: scheme.officialSourceUrl,
      publisher: scheme.ministry ?? scheme.provider,
      status: 'PUBLISHED',
      content,
      wordCount: content.split(/\s+/).length,
      lastVerifiedAt: scheme.lastVerifiedAt,
    },
    select: { id: true },
  });

  return indexDocument(document.id);
}

/**
 * Chunks, embeds and stores one document.
 *
 * Chunks are replaced wholesale rather than diffed: a changed document produces
 * different boundaries, so matching old chunks to new ones is not meaningful.
 */
export async function indexDocument(documentId: string): Promise<{
  indexed: boolean;
  chunks: number;
  reason?: string;
}> {
  const document = await prisma.schemeDocument.findUnique({
    where: { id: documentId },
    select: { id: true, content: true, status: true },
  });

  if (!document) return { indexed: false, chunks: 0, reason: 'Document not found.' };
  if (!document.content?.trim()) {
    return { indexed: false, chunks: 0, reason: 'Document has no extracted content to index.' };
  }
  if (document.status !== 'PUBLISHED') {
    return {
      indexed: false,
      chunks: 0,
      reason: `Document status is ${document.status}; only PUBLISHED documents are indexed.`,
    };
  }

  const chunked = await ai.chunkText({
    text: document.content,
    chunkSize: CHUNK_SIZE,
    chunkOverlap: CHUNK_OVERLAP,
  });
  if (!chunked.ok) return { indexed: false, chunks: 0, reason: chunked.reason };
  if (chunked.value.chunks.length === 0) {
    return { indexed: false, chunks: 0, reason: 'Chunking produced no output.' };
  }

  const embedded = await ai.embed(chunked.value.chunks.map((c) => c.text));
  if (!embedded.ok) return { indexed: false, chunks: 0, reason: embedded.reason };

  const { embeddings, model, dim } = embedded.value;
  if (dim !== EMBEDDING_DIM) {
    // Storing a different width would make every future comparison return NULL.
    return {
      indexed: false,
      chunks: 0,
      reason: `AI service returned ${dim}-dimension vectors but the index expects ${EMBEDDING_DIM}.`,
    };
  }
  if (embeddings.length !== chunked.value.chunks.length) {
    return { indexed: false, chunks: 0, reason: 'Embedding count did not match chunk count.' };
  }

  await prisma.$transaction([
    prisma.schemeDocumentChunk.deleteMany({ where: { documentId } }),
    prisma.schemeDocumentChunk.createMany({
      data: chunked.value.chunks.map((chunk, i) => ({
        documentId,
        chunkIndex: chunk.index,
        text: chunk.text,
        heading: chunk.heading,
        tokenCount: chunk.token_estimate,
        embedding: embeddings[i] ?? [],
        embeddingModel: model,
      })),
    }),
    prisma.schemeDocument.update({
      where: { id: documentId },
      data: {
        embeddingModel: model,
        chunkSize: CHUNK_SIZE,
        chunkOverlap: CHUNK_OVERLAP,
        indexedAt: new Date(),
      },
    }),
  ]);

  return { indexed: true, chunks: chunked.value.chunks.length };
}

/** Re-indexes every published scheme. Driven from the admin screen. */
export async function reindexAll(): Promise<{
  schemes: number;
  indexed: number;
  chunks: number;
  failures: Array<{ schemeId: string; reason: string }>;
}> {
  const schemes = await prisma.governmentScheme.findMany({
    where: { status: 'PUBLISHED' },
    select: { id: true },
  });

  let indexed = 0;
  let chunks = 0;
  const failures: Array<{ schemeId: string; reason: string }> = [];

  // Sequential on purpose: each scheme triggers an embedding call, and firing
  // them all at once would overwhelm a single-process AI service.
  for (const scheme of schemes) {
    const result = await indexScheme(scheme.id);
    if (result.indexed) {
      indexed += 1;
      chunks += result.chunks;
    } else {
      failures.push({ schemeId: scheme.id, reason: result.reason ?? 'unknown' });
    }
  }

  logger.info({ schemes: schemes.length, indexed, chunks }, 'rag reindex complete');
  return { schemes: schemes.length, indexed, chunks, failures };
}

/**
 * Retrieves the most similar published chunks for a query.
 *
 * The similarity is computed in SQL by `fb_dot_product`, which is exact rather
 * than approximate. `$queryRaw` is a tagged template, so every value is
 * parameterised — the embedding array cannot be used for injection.
 */
export async function retrieve(
  query: string,
  options: { limit?: number; schemeId?: string; minCosine?: number } = {},
): Promise<{ chunks: RetrievedChunk[]; available: boolean; reason?: string }> {
  const limit = Math.min(20, Math.max(1, options.limit ?? 6));
  // Thresholded on RAW cosine, not on the rescaled display score.
  //
  // all-MiniLM-L6-v2 compresses similarities: two completely unrelated English
  // sentences still score around 0.25-0.30 raw cosine, which becomes 0.62-0.65
  // once rescaled to [0,1]. Thresholding the rescaled value at 0.5 therefore
  // filtered almost nothing, and an unrelated question came back with
  // confident-looking citations. 0.35 raw is the point where this model starts
  // to indicate genuine topical overlap.
  const minCosine = options.minCosine ?? MIN_COSINE_SIMILARITY;

  const embedded = await ai.embed([query]);
  if (!embedded.ok) return { chunks: [], available: false, reason: embedded.reason };

  const vector = embedded.value.embeddings[0];
  if (!vector || vector.length !== EMBEDDING_DIM) {
    return { chunks: [], available: false, reason: 'Query embedding had an unexpected width.' };
  }

  const rows = options.schemeId
    ? await prisma.$queryRaw<RetrievalRow[]>`
        SELECT c.id              AS "chunkId",
               c."documentId"    AS "documentId",
               d."schemeId"      AS "schemeId",
               s.name            AS "schemeName",
               d.title           AS "documentTitle",
               d."sourceUrl"     AS "sourceUrl",
               d."sourceType"::text AS "sourceType",
               d."lastVerifiedAt" AS "lastVerifiedAt",
               c.heading         AS "heading",
               c.text            AS "text",
               fb_dot_product(c.embedding, ${vector}::double precision[]) AS "dot"
        FROM "SchemeDocumentChunk" c
        JOIN "SchemeDocument" d ON d.id = c."documentId"
        LEFT JOIN "GovernmentScheme" s ON s.id = d."schemeId"
        WHERE d.status = 'PUBLISHED'
          AND d."schemeId" = ${options.schemeId}
          AND array_length(c.embedding, 1) = ${EMBEDDING_DIM}
        ORDER BY "dot" DESC NULLS LAST
        LIMIT ${limit}
      `
    : await prisma.$queryRaw<RetrievalRow[]>`
        SELECT c.id              AS "chunkId",
               c."documentId"    AS "documentId",
               d."schemeId"      AS "schemeId",
               s.name            AS "schemeName",
               d.title           AS "documentTitle",
               d."sourceUrl"     AS "sourceUrl",
               d."sourceType"::text AS "sourceType",
               d."lastVerifiedAt" AS "lastVerifiedAt",
               c.heading         AS "heading",
               c.text            AS "text",
               fb_dot_product(c.embedding, ${vector}::double precision[]) AS "dot"
        FROM "SchemeDocumentChunk" c
        JOIN "SchemeDocument" d ON d.id = c."documentId"
        LEFT JOIN "GovernmentScheme" s ON s.id = d."schemeId"
        WHERE d.status = 'PUBLISHED'
          AND array_length(c.embedding, 1) = ${EMBEDDING_DIM}
        ORDER BY "dot" DESC NULLS LAST
        LIMIT ${limit}
      `;

  const chunks: RetrievedChunk[] = rows
    // A null dot means the stored vector had a different width, so the
    // comparison is meaningless rather than merely low.
    .filter((r): r is RetrievalRow & { dot: number } => r.dot !== null)
    // Thresholded on the raw cosine BEFORE rescaling for display.
    .filter((r) => r.dot >= minCosine)
    .map((r) => ({
      chunkId: r.chunkId,
      documentId: r.documentId,
      schemeId: r.schemeId,
      schemeName: r.schemeName,
      documentTitle: r.documentTitle,
      sourceUrl: r.sourceUrl,
      sourceType: r.sourceType,
      lastVerifiedAt: r.lastVerifiedAt,
      heading: r.heading,
      text: r.text,
      // Dot product of normalised vectors is cosine in [-1,1]; rescaled so a
      // displayed similarity is never negative.
      similarity: Math.max(0, Math.min(1, (r.dot + 1) / 2)),
    }));

  return { chunks, available: true };
}

/** Index statistics for the admin knowledge-base screen. */
export async function getIndexStats(): Promise<{
  documents: number;
  publishedDocuments: number;
  chunks: number;
  embeddedChunks: number;
  schemesIndexed: number;
  schemesPublished: number;
  embeddingModels: string[];
  lastIndexedAt: Date | null;
}> {
  const [documents, publishedDocuments, chunks, embeddedRows, schemesPublished, latest, models] =
    await Promise.all([
      prisma.schemeDocument.count(),
      prisma.schemeDocument.count({ where: { status: 'PUBLISHED' } }),
      prisma.schemeDocumentChunk.count(),
      prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*)::bigint AS count
        FROM "SchemeDocumentChunk"
        WHERE array_length(embedding, 1) = ${EMBEDDING_DIM}
      `,
      prisma.governmentScheme.count({ where: { status: 'PUBLISHED' } }),
      prisma.schemeDocument.findFirst({
        where: { indexedAt: { not: null } },
        orderBy: { indexedAt: 'desc' },
        select: { indexedAt: true },
      }),
      prisma.schemeDocument.findMany({
        where: { embeddingModel: { not: null } },
        select: { embeddingModel: true },
        distinct: ['embeddingModel'],
      }),
    ]);

  const schemesIndexed = await prisma.schemeDocument.count({
    where: { schemeId: { not: null }, indexedAt: { not: null } },
  });

  return {
    documents,
    publishedDocuments,
    chunks,
    embeddedChunks: Number(embeddedRows[0]?.count ?? 0),
    schemesIndexed,
    schemesPublished,
    embeddingModels: models.map((m) => m.embeddingModel).filter((m): m is string => Boolean(m)),
    lastIndexedAt: latest?.indexedAt ?? null,
  };
}

/** Clears the whole index. Used before a re-index with a different model. */
export async function clearIndex(): Promise<{ deletedChunks: number }> {
  const { count } = await prisma.schemeDocumentChunk.deleteMany({});
  await prisma.schemeDocument.updateMany({
    data: { indexedAt: null, embeddingModel: null } as Prisma.SchemeDocumentUpdateManyMutationInput,
  });
  return { deletedChunks: count };
}
