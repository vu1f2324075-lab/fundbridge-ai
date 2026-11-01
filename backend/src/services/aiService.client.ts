/**
 * Client for the Python AI service.
 *
 * Every method degrades rather than throwing. The platform must remain usable
 * when the AI service is down: deterministic scoring, readiness and matching all
 * work without it, so an outage here reduces capability instead of breaking the
 * product.
 *
 * That contract is expressed in the return types — each returns a result object
 * carrying either a value or an `unavailable` reason, so a caller cannot
 * accidentally treat an outage as success.
 */
import { env } from '../config/env';
import { logger } from '../lib/logger';

export type AiResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: string };

function unavailable<T>(reason: string): AiResult<T> {
  return { ok: false, reason };
}

export interface AiHealth {
  status: string;
  version: string;
  embeddings_available: boolean;
  embedding_model: string | null;
  embedding_dim: number;
  llm_available: boolean;
  llm_model: string | null;
}

export interface ExtractedDocument {
  text: string;
  word_count: number;
  page_count: number | null;
  sections: Record<string, string>;
  detected_sections: string[];
  missing_sections: string[];
  likely_scanned: boolean;
  warnings: string[];
}

export interface ProposalAnalysisResult {
  scores: {
    overall: number;
    clarity: number;
    completeness: number;
    structure: number;
    market_evidence: number;
    financial: number;
    funding_justification: number;
    team: number;
  };
  strengths: string[];
  weaknesses: string[];
  missing_sections: string[];
  suggestions: Array<{
    area: string;
    issue: string;
    suggestion: string;
    why_it_matters: string;
    severity: 'HIGH' | 'MEDIUM' | 'LOW';
  }>;
  detected_sections: string[];
  word_count: number;
  llm_assisted: boolean;
  model_version: string;
  llm_note: string | null;
}

export interface SectionSuggestion {
  section: string;
  draft: string | null;
  guidance: string[];
  missing_facts: string[];
  llm_assisted: boolean;
  llm_note: string | null;
}

export interface TextChunk {
  index: number;
  text: string;
  heading: string | null;
  token_estimate: number;
}

export interface GroundedExplanation {
  narrative: string | null;
  citations: Array<{
    chunk_id: string;
    document_title: string;
    source_url: string;
    last_verified_at: string | null;
  }>;
  llm_assisted: boolean;
  llm_note: string | null;
}

/**
 * Performs one request against the AI service.
 *
 * `AbortSignal.timeout` bounds every call: an AI service that accepts a
 * connection and then hangs would otherwise occupy a Node request indefinitely.
 */
async function call<T>(
  path: string,
  init: { method: 'GET' | 'POST'; body?: unknown; formData?: FormData; timeoutMs?: number },
): Promise<AiResult<T>> {
  if (!env.aiServiceEnabled || !env.AI_SERVICE_URL) {
    return unavailable('The AI service is not configured.');
  }

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (env.AI_SERVICE_TOKEN) headers['X-Service-Token'] = env.AI_SERVICE_TOKEN;
  if (init.body !== undefined) headers['Content-Type'] = 'application/json';

  try {
    const response = await fetch(`${env.AI_SERVICE_URL}${path}`, {
      method: init.method,
      headers,
      body: init.formData ?? (init.body === undefined ? undefined : JSON.stringify(init.body)),
      signal: AbortSignal.timeout(init.timeoutMs ?? env.AI_SERVICE_TIMEOUT_MS),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      let detail = '';
      try {
        const parsed = JSON.parse(text) as { detail?: string; error?: { message?: string } };
        detail = parsed.detail ?? parsed.error?.message ?? '';
      } catch {
        detail = '';
      }

      // 422 means the service understood the request and rejected the input —
      // that message is written for the end user and is safe to pass through.
      // Anything else is an internal condition the user cannot act on.
      if (response.status === 422 && detail) {
        logger.info({ path, status: response.status }, 'ai service rejected input');
        return unavailable(detail);
      }

      logger.warn({ path, status: response.status }, 'ai service returned an error');
      return unavailable('The AI service could not process the request.');
    }

    return { ok: true, value: (await response.json()) as T };
  } catch (err) {
    const name = err instanceof Error ? err.name : 'Unknown';
    // Logged without the message: a fetch error can echo back the target URL
    // and internal network detail.
    logger.warn({ path, error: name }, 'ai service unreachable');
    return unavailable(
      name === 'TimeoutError'
        ? 'The AI service took too long to respond.'
        : 'The AI service is currently unreachable.',
    );
  }
}

/** Liveness and capability probe. Short timeout — it must not block a page load. */
export async function health(): Promise<AiResult<AiHealth>> {
  return call<AiHealth>('/health', { method: 'GET', timeoutMs: 5_000 });
}

/** Embeds texts. Vectors are L2-normalised, so cosine is a dot product. */
export async function embed(texts: string[]): Promise<AiResult<{ model: string; dim: number; embeddings: number[][] }>> {
  if (texts.length === 0) return { ok: true, value: { model: '', dim: 0, embeddings: [] } };
  return call('/embed', { method: 'POST', body: { texts } });
}

export async function similarity(
  query: string,
  candidates: string[],
): Promise<AiResult<{ model: string; scores: Array<{ index: number; score: number }> }>> {
  if (candidates.length === 0) return { ok: true, value: { model: '', scores: [] } };
  return call('/similarity', { method: 'POST', body: { query, candidates } });
}

/**
 * Extracts text from a document.
 *
 * The buffer is sent rather than a path: the AI service has no filesystem access
 * to this application's storage, which keeps private uploads inaccessible to it
 * except for the bytes deliberately passed in.
 */
export async function extractDocument(
  buffer: Buffer,
  filename: string,
  mimeType: string,
): Promise<AiResult<ExtractedDocument>> {
  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(buffer)], { type: mimeType }), filename);
  // Extraction of a large PDF is slower than a JSON round trip.
  return call<ExtractedDocument>('/documents/extract', { method: 'POST', formData: form, timeoutMs: 120_000 });
}

export async function analyseProposal(input: {
  text: string;
  industry?: string | null;
  businessStage?: string | null;
  requestedAmount?: number | null;
  currency?: string | null;
  useLlm?: boolean;
}): Promise<AiResult<ProposalAnalysisResult>> {
  return call<ProposalAnalysisResult>('/proposal/analyse', {
    method: 'POST',
    body: {
      text: input.text,
      industry: input.industry ?? null,
      business_stage: input.businessStage ?? null,
      requested_amount: input.requestedAmount ?? null,
      currency: input.currency ?? null,
      use_llm: input.useLlm ?? true,
    },
  });
}

export async function suggestSection(input: {
  section: string;
  currentText?: string | null;
  knownFacts: Record<string, string>;
}): Promise<AiResult<SectionSuggestion>> {
  return call<SectionSuggestion>('/proposal/section', {
    method: 'POST',
    body: {
      section: input.section,
      current_text: input.currentText ?? null,
      known_facts: input.knownFacts,
    },
  });
}

export async function chunkText(input: {
  text: string;
  chunkSize?: number;
  chunkOverlap?: number;
}): Promise<AiResult<{ chunks: TextChunk[] }>> {
  return call('/rag/chunk', {
    method: 'POST',
    body: {
      text: input.text,
      chunk_size: input.chunkSize ?? 900,
      chunk_overlap: input.chunkOverlap ?? 150,
    },
  });
}

/**
 * Asks the AI service to phrase an already-computed explanation.
 *
 * The explanation object is authoritative and the service has no scoring logic,
 * so this cannot change a score — it can only add prose or fail.
 */
export async function groundedExplanation(input: {
  explanation: unknown;
  context: Array<{
    chunk_id: string;
    scheme_id?: string | null;
    scheme_name?: string | null;
    document_title: string;
    source_url: string;
    source_type: string;
    last_verified_at?: string | null;
    text: string;
    similarity: number;
  }>;
  question?: string;
}): Promise<AiResult<GroundedExplanation>> {
  return call<GroundedExplanation>('/rag/explain', {
    method: 'POST',
    body: {
      explanation: input.explanation,
      context: input.context,
      ...(input.question ? { question: input.question } : {}),
    },
  });
}
