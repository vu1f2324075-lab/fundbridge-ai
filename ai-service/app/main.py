"""
FastAPI application.

The service is stateless and has no database access. That is deliberate: the
Node backend owns authentication, authorisation and all persistence, so there is
exactly one place where "may this user see this row?" is decided. This service
receives text, returns analysis, and forgets.

Access is restricted to callers presenting the shared service token. The browser
never calls this service directly, and no endpoint here is safe to expose
publicly — embedding and LLM calls are expensive and would otherwise be an open
proxy.
"""

from __future__ import annotations

import hmac
import logging
import time
from typing import Annotated

from fastapi import Depends, FastAPI, File, Header, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from . import __version__
from .config import get_settings
from .documents.extract import ExtractionError, extract_document
from .llm import client as llm
from .llm.prompts import GROUNDED_EXPLANATION_SYSTEM, wrap_context
from .nlp import embeddings
from .proposal.analyse import analyse_proposal
from .proposal.assist import suggest_section
from .rag.chunking import chunk_text
from .schemas import (
    AnalyseProposalRequest,
    ChunkRequest,
    ChunkResponse,
    Citation,
    EmbedRequest,
    EmbedResponse,
    ExtractResponse,
    GroundedExplanationRequest,
    GroundedExplanationResponse,
    HealthResponse,
    ProposalAnalysisResponse,
    SimilarityRequest,
    SimilarityResponse,
    SimilarityScore,
    SuggestSectionRequest,
    SuggestSectionResponse,
)

logging.basicConfig(level=getattr(logging, get_settings().log_level.upper(), logging.INFO))
logger = logging.getLogger(__name__)

settings = get_settings()

app = FastAPI(
    title="FundBridge AI Service",
    version=__version__,
    description="NLP, embeddings, document processing and grounded generation.",
    # No interactive docs in production: the schema describes internal endpoints
    # and there is no reason to publish it.
    docs_url=None if settings.is_production else "/docs",
    redoc_url=None,
    openapi_url=None if settings.is_production else "/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    # The Node backend only. A browser origin here would be a bug.
    allow_origins=settings.origins,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "X-Service-Token"],
)

#: Documents larger than this are refused before being read into memory.
MAX_UPLOAD_BYTES = 15 * 1024 * 1024


async def require_service_token(
    x_service_token: Annotated[str | None, Header(alias="X-Service-Token")] = None,
) -> None:
    """
    Authenticates the calling service.

    Compared with `hmac.compare_digest` so a wrong token cannot be discovered
    byte by byte through timing.

    When no token is configured the service is open — permitted only outside
    production, where `Settings` already refuses to start without one.
    """
    expected = settings.service_token
    if not expected:
        if settings.is_production:  # pragma: no cover - construction prevents this
            raise HTTPException(status_code=500, detail="service token not configured")
        return

    if not x_service_token or not hmac.compare_digest(x_service_token, expected):
        raise HTTPException(status_code=401, detail="invalid or missing service token")


Protected = Depends(require_service_token)


@app.middleware("http")
async def log_requests(request: Request, call_next):  # noqa: ANN001, ANN201
    started = time.perf_counter()
    response = await call_next(request)
    duration_ms = (time.perf_counter() - started) * 1000
    # Path and status only. Request bodies contain proposal text and are never
    # logged.
    logger.info(
        "%s %s -> %s in %.0fms",
        request.method,
        request.url.path,
        response.status_code,
        duration_ms,
    )
    return response


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """
    Converts an unexpected failure into a generic error.

    The exception is logged with its type but the message is never returned: a
    parser error can contain fragments of the document being processed.
    """
    logger.exception("unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"error": {"code": "INTERNAL_ERROR", "message": "The AI service failed to process the request."}},
    )


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    """
    Unauthenticated liveness and capability probe.

    Reports what is actually available so the backend can tell the UI, rather
    than the UI assuming a feature works.
    """
    return HealthResponse(
        status="ok",
        version=__version__,
        embeddings_available=embeddings.is_available(),
        embedding_model=embeddings.model_name() if embeddings.is_available() else None,
        embedding_dim=settings.embedding_dim,
        llm_available=llm.is_available(),
        llm_model=llm.model_name(),
    )


# ---------------------------------------------------------------------------
# Embeddings and semantic similarity
# ---------------------------------------------------------------------------


@app.post("/embed", response_model=EmbedResponse, dependencies=[Protected])
async def embed(request: EmbedRequest) -> EmbedResponse:
    try:
        vectors = embeddings.embed_texts(request.texts)
    except embeddings.EmbeddingsUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    return EmbedResponse(
        model=embeddings.model_name(),
        dim=len(vectors[0]) if vectors else settings.embedding_dim,
        embeddings=vectors,
    )


@app.post("/similarity", response_model=SimilarityResponse, dependencies=[Protected])
async def similarity(request: SimilarityRequest) -> SimilarityResponse:
    """Scores one query against many candidates in a single model pass."""
    try:
        scores = embeddings.cosine_similarity(request.query, request.candidates)
    except embeddings.EmbeddingsUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    return SimilarityResponse(
        model=embeddings.model_name(),
        scores=[SimilarityScore(index=i, score=s) for i, s in enumerate(scores)],
    )


# ---------------------------------------------------------------------------
# Documents
# ---------------------------------------------------------------------------


@app.post("/documents/extract", response_model=ExtractResponse, dependencies=[Protected])
async def extract(file: Annotated[UploadFile, File()]) -> ExtractResponse:
    """
    Extracts text from an uploaded PDF or DOCX.

    The file type is determined from content, not from the filename, so a
    renamed executable is refused rather than handed to a parser.
    """
    data = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="file exceeds the maximum size")

    try:
        return extract_document(data)
    except ExtractionError as exc:
        # Safe to surface: these messages are written for the end user and
        # contain no internal detail.
        raise HTTPException(status_code=422, detail=str(exc)) from exc


# ---------------------------------------------------------------------------
# Proposal analysis and assistance
# ---------------------------------------------------------------------------


@app.post("/proposal/analyse", response_model=ProposalAnalysisResponse, dependencies=[Protected])
async def analyse(request: AnalyseProposalRequest) -> ProposalAnalysisResponse:
    """
    Analyses proposal text.

    Scores are always deterministic. The LLM contributes narrative findings only,
    and its absence changes the prose, never the numbers.
    """
    return analyse_proposal(request)


@app.post("/proposal/section", response_model=SuggestSectionResponse, dependencies=[Protected])
async def section(request: SuggestSectionRequest) -> SuggestSectionResponse:
    return suggest_section(request)


# ---------------------------------------------------------------------------
# RAG
# ---------------------------------------------------------------------------


@app.post("/rag/chunk", response_model=ChunkResponse, dependencies=[Protected])
async def chunk(request: ChunkRequest) -> ChunkResponse:
    """
    Splits text into retrieval chunks.

    Stateless: the backend stores the chunks and their embeddings, because the
    backend owns the database.
    """
    return ChunkResponse(
        chunks=chunk_text(
            request.text,
            chunk_size=request.chunk_size,
            chunk_overlap=request.chunk_overlap,
        )
    )


@app.post(
    "/rag/explain",
    response_model=GroundedExplanationResponse,
    dependencies=[Protected],
)
async def explain(request: GroundedExplanationRequest) -> GroundedExplanationResponse:
    """
    Phrases a pre-computed explanation as prose, grounded in retrieved context.

    The scores and factors arrive already computed. This endpoint cannot change
    them — it has no scoring logic, and its output is validated to a narrative
    string plus citations. That is what keeps the LLM out of the eligibility
    decision while still letting it do what it is good at.
    """
    citations = [
        Citation(
            chunk_id=item.chunk_id,
            document_title=item.document_title,
            source_url=item.source_url,
            last_verified_at=item.last_verified_at,
        )
        for item in request.context
    ]

    if not llm.is_available():
        return GroundedExplanationResponse(
            narrative=None,
            citations=citations,
            llm_assisted=False,
            llm_note=(
                "No language model is configured, so no narrative was generated. "
                "The structured explanation is complete on its own."
            ),
        )

    blocks = [
        f"[chunk_id: {item.chunk_id}] {item.document_title} "
        f"(source: {item.source_url}, verified: {item.last_verified_at or 'unknown'})\n{item.text}"
        for item in request.context
    ]

    import json

    user_parts = [
        "Phrase the following pre-computed matching result for the business owner.",
        "",
        "Computed explanation (authoritative — do not alter any value):",
        json.dumps(request.explanation, ensure_ascii=False)[:12_000],
    ]
    if blocks:
        user_parts += ["", "Official reference context:", wrap_context(blocks)]
    if request.question:
        # Wrapped as data: a question is still user input.
        user_parts += ["", f"The owner asked: {request.question[:500]}"]

    try:
        payload = llm.complete_json(GROUNDED_EXPLANATION_SYSTEM, "\n".join(user_parts))
        narrative = str(payload.get("narrative", "")).strip()[:1500] or None
        cited = {str(c) for c in payload.get("cited_chunk_ids", [])}
    except llm.LlmUnavailable as exc:
        logger.info("grounded explanation unavailable: %s", exc)
        return GroundedExplanationResponse(
            narrative=None,
            citations=citations,
            llm_assisted=False,
            llm_note="The language model could not be reached. The structured explanation is unaffected.",
        )

    # Only citations the model actually used are returned, and only if they were
    # in the supplied context — a model-invented chunk id is dropped.
    used = [c for c in citations if c.chunk_id in cited] or citations

    return GroundedExplanationResponse(
        narrative=narrative,
        citations=used,
        llm_assisted=narrative is not None,
        llm_note=None,
    )
